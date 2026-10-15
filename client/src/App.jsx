import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BriefcaseBusiness, CalendarClock, Check, ChevronDown, CircleDollarSign,
  Clock3, Download, Filter, LayoutDashboard, List, LoaderCircle, Plus, Search, Users,
  X, TrendingUp, Phone, Mail, CalendarDays, ArrowUpRight, Pencil, Trash2, MessageSquareText,
  AlertTriangle,
} from 'lucide-react';

const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const priorities = ['Low', 'Medium', 'High'];
const sources = ['Website', 'Referral', 'LinkedIn', 'Event', 'Cold Outreach', 'Partner'];
const blankLead = {
  fullName: '', company: '', email: '', phone: '', source: 'Website', industry: '',
  estimatedDealValue: '', priority: 'Medium', owner: '', stage: 'New',
};
const apiUrl = (import.meta.env.VITE_API_URL || '/api/leads').replace(/\/$/, '');

async function request(path = '', options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.warning || payload.error || 'Request failed. Please try again.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(Number(value) || 0);

const dateLabel = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => (
  value ? new Date(value).toLocaleDateString(undefined, options) : '—'
);

function IconMetric({ icon: Icon, label, value, note, color }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${color}`}><Icon size={19} /></div>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}</div>
      <p className="metric-note">{note}</p>
    </div>
  );
}

function LeadDialog({ initial, onClose, onSave, busy }) {
  const [form, setForm] = useState(() => ({ ...blankLead, ...initial }));
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.fullName.trim()) return setError('Enter the lead’s full name.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError('Enter a valid email address.');
    }
    try {
      await onSave({
        ...form,
        fullName: form.fullName.trim(),
        estimatedDealValue: Number(form.estimatedDealValue) || 0,
      });
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title">
        <header className="dialog-header">
          <div><span className="eyebrow">{initial?._id ? 'LEAD PROFILE' : 'NEW OPPORTUNITY'}</span>
            <h2 id="lead-dialog-title">{initial?._id ? 'Edit lead' : 'Add a lead'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Full name *<input autoFocus value={form.fullName} onChange={set('fullName')} placeholder="e.g. Alex Morgan" required /></label>
            <label>Company<input value={form.company} onChange={set('company')} placeholder="Company name" /></label>
            <label>Email<input type="email" value={form.email} onChange={set('email')} placeholder="alex@company.com" /></label>
            <label>Phone<input value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" /></label>
            <label>Lead source<select value={form.source} onChange={set('source')}>{sources.map((source) => <option key={source}>{source}</option>)}</select></label>
            <label>Industry<input value={form.industry} onChange={set('industry')} placeholder="Technology" /></label>
            <label>Deal value<input type="number" min="0" value={form.estimatedDealValue ?? ''} onChange={set('estimatedDealValue')} placeholder="0" /></label>
            <label>Priority<select value={form.priority} onChange={set('priority')}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label>Owner<input value={form.owner} onChange={set('owner')} placeholder="Assign owner" /></label>
            <label>Stage<select value={form.stage} onChange={set('stage')}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          </div>
          <footer className="dialog-actions">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />}{initial?._id ? 'Save changes' : 'Create lead'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function LeadDetail({ lead, onClose, onEdit, onDelete, onUpdated }) {
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState({ dueDate: '', type: 'Call', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const orderedActivity = [...(lead.activityTimeline || [])].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  );
  const tasks = [...(lead.followUps || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  async function addFollowUp(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await request(`/${lead._id}/follow-ups`, {
        method: 'POST',
        body: JSON.stringify({ ...followUp, dueDate: new Date(followUp.dueDate).toISOString() }),
      });
      onUpdated(result.lead);
      setFollowUp({ dueDate: '', type: 'Call', note: '' });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await request(`/${lead._id}/notes`, {
        method: 'POST', body: JSON.stringify({ text: note.trim() }),
      });
      onUpdated(result.lead);
      setNote('');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function toggleFollowUp(task) {
    try {
      const result = await request(`/${lead._id}/follow-ups/${task._id}`, {
        method: 'PATCH', body: JSON.stringify({ completed: !task.completed }),
      });
      onUpdated(result.lead);
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <div className="overlay detail-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="detail-panel" role="dialog" aria-modal="true" aria-label={`${lead.fullName} lead details`}>
        <div className="detail-top">
          <span className="eyebrow">LEAD DETAILS</span>
          <div className="detail-actions">
            <button className="icon-button" onClick={() => onEdit(lead)} aria-label="Edit lead"><Pencil size={17} /></button>
            <button className="icon-button danger-icon" onClick={() => onDelete(lead)} aria-label="Delete lead"><Trash2 size={17} /></button>
            <button className="icon-button" onClick={onClose} aria-label="Close details"><X size={19} /></button>
          </div>
        </div>
        <div className="profile">
          <div className="avatar large">{lead.fullName?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
          <div><h2>{lead.fullName}</h2><p>{lead.company || 'No company'} <span className="dot">·</span> {lead.owner || 'Unassigned'}</p></div>
          <span className={`stage-pill ${lead.stage?.toLowerCase()}`}>{lead.stage}</span>
        </div>
        <div className="detail-value"><span>Estimated deal value</span><strong>{money(lead.estimatedDealValue)}</strong></div>
        <div className="detail-facts">
          <div><span>Email</span><a href={`mailto:${lead.email}`}>{lead.email || '—'}</a></div>
          <div><span>Phone</span><a href={`tel:${lead.phone}`}>{lead.phone || '—'}</a></div>
          <div><span>Source</span><b>{lead.source || '—'}</b></div>
          <div><span>Industry</span><b>{lead.industry || '—'}</b></div>
          <div><span>Priority</span><b>{lead.priority}</b></div>
          <div><span>Added</span><b>{dateLabel(lead.createdAt)}</b></div>
        </div>
        <section className="detail-section">
          <div className="section-heading"><h3><CalendarClock size={17} /> Follow-ups</h3><span>{tasks.length}</span></div>
          <form className="followup-form" onSubmit={addFollowUp}>
            <div className="form-grid compact">
              <label>Due date<input type="datetime-local" required value={followUp.dueDate} onChange={(event) => setFollowUp({ ...followUp, dueDate: event.target.value })} /></label>
              <label>Type<select value={followUp.type} onChange={(event) => setFollowUp({ ...followUp, type: event.target.value })}><option>Call</option><option>Email</option><option>Meeting</option></select></label>
            </div>
            <input aria-label="Follow-up note" placeholder="What should happen?" required value={followUp.note} onChange={(event) => setFollowUp({ ...followUp, note: event.target.value })} />
            <button className="button button-primary small-button" disabled={busy}><Plus size={15} /> Schedule follow-up</button>
          </form>
          <div className="task-list">
            {!tasks.length && <p className="empty-copy">No follow-ups scheduled.</p>}
            {tasks.map((task) => (
              <label key={task._id} className={`task-row ${task.completed ? 'task-done' : ''}`}>
                <input type="checkbox" checked={task.completed} onChange={() => toggleFollowUp(task)} />
                <span className="task-type">{task.type === 'Call' ? <Phone size={14} /> : task.type === 'Email' ? <Mail size={14} /> : <CalendarDays size={14} />}</span>
                <span className="task-copy"><b>{task.note}</b><small>{dateLabel(task.dueDate, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>
              </label>
            ))}
          </div>
        </section>
        <section className="detail-section">
          <div className="section-heading"><h3><MessageSquareText size={17} /> Notes</h3><span>{lead.notes?.length || 0}</span></div>
          <form className="note-form" onSubmit={addNote}>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note to this lead..." rows="2" />
            <button className="button button-quiet small-button" disabled={busy}>Add note</button>
          </form>
          <div className="notes-list">
            {(lead.notes || []).map((item) => <article className="note-item" key={item._id}><p>{item.text}</p><time>{dateLabel(item.createdAt)}</time></article>)}
            {!lead.notes?.length && <p className="empty-copy">No notes yet. Keep useful context here.</p>}
          </div>
        </section>
        <section className="detail-section timeline-section">
          <div className="section-heading"><h3><Activity size={17} /> Activity timeline</h3></div>
          <div className="timeline">
            {!orderedActivity.length && <p className="empty-copy">Activity will appear here.</p>}
            {orderedActivity.map((item) => <div className="timeline-entry" key={item._id}><span className="timeline-mark" /><div><b>{item.description}</b><time>{dateLabel(item.timestamp, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div></div>)}
          </div>
        </section>
        {error && <div className="inline-error" role="alert">{error}</div>}
      </aside>
    </div>
  );
}

function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeWarning, setNoticeWarning] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ stage: '', priority: '', source: '', owner: '', sort: 'newest' });
  const [dialogLead, setDialogLead] = useState(null);
  const [detailLeadId, setDetailLeadId] = useState(null);

  const loadLeads = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request();
      setLeads(Array.isArray(result) ? result : []);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = leads.filter((lead) => {
      const matchesSearch = !query || [lead.fullName, lead.company, lead.email, lead.phone, lead.owner]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesSearch
        && (!filters.stage || lead.stage === filters.stage)
        && (!filters.priority || lead.priority === filters.priority)
        && (!filters.source || lead.source === filters.source)
        && (!filters.owner || lead.owner === filters.owner);
    });
    if (filters.sort === 'dealValue') result.sort((a, b) => b.estimatedDealValue - a.estimatedDealValue);
    if (filters.sort === 'newest') result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filters.sort === 'nextFollowUp') {
      const due = (lead) => Math.min(...(lead.followUps || []).filter((task) => !task.completed).map((task) => new Date(task.dueDate).getTime()), Infinity);
      result.sort((a, b) => due(a) - due(b));
    }
    return result;
  }, [filters, leads, search]);
  const detailLead = leads.find((lead) => lead._id === detailLeadId);
  const followUpItems = leads.flatMap((lead) => (lead.followUps || []).map((task) => ({ ...task, lead })))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const wonValue = leads.filter((lead) => lead.stage === 'Won').reduce((sum, lead) => sum + Number(lead.estimatedDealValue || 0), 0);
  const openValue = leads.filter((lead) => !['Won', 'Lost'].includes(lead.stage)).reduce((sum, lead) => sum + Number(lead.estimatedDealValue || 0), 0);
  const converted = leads.filter((lead) => lead.stage === 'Won').length;
  const overdue = leads.flatMap((lead) => lead.followUps || [])
    .filter((task) => !task.completed && new Date(task.dueDate) < new Date()).length;
  const conversion = leads.length ? Math.round((converted / leads.length) * 100) : 0;
  const owners = [...new Set(leads.map((lead) => lead.owner).filter(Boolean))].sort();
  const stageTotals = stages.map((stage) => ({
    stage, count: leads.filter((lead) => lead.stage === stage).length,
  }));

  async function saveLead(values) {
    setBusy(true);
    try {
      if (dialogLead?._id) {
        const { lead } = await request(`/${dialogLead._id}`, { method: 'PUT', body: JSON.stringify(values) });
        setLeads((current) => current.map((item) => item._id === lead._id ? lead : item));
        setNotice('Lead updated.'); setNoticeWarning(false);
      } else {
        const result = await request('', { method: 'POST', body: JSON.stringify(values) });
        setLeads((current) => [result.lead, ...current]);
        setNotice('Lead created.'); setNoticeWarning(false);
      }
      setDialogLead(null);
    } catch (saveError) {
      if (saveError.status === 409) {
        setNotice(saveError.payload?.warning || saveError.message);
        setNoticeWarning(true);
      }
      throw saveError;
    } finally { setBusy(false); }
  }

  async function changeStage(lead, stage) {
    if (lead.stage === stage) return;
    try {
      const { lead: updated } = await request(`/${lead._id}`, { method: 'PUT', body: JSON.stringify({ stage }) });
      setLeads((current) => current.map((item) => item._id === updated._id ? updated : item));
      setNotice(`Moved ${lead.fullName} to ${stage}.`); setNoticeWarning(false);
    } catch (requestError) { setError(requestError.message); }
  }

  async function toggleFollowUp(task) {
    try {
      const { lead } = await request(`/${task.lead._id}/follow-ups/${task._id}`, {
        method: 'PATCH', body: JSON.stringify({ completed: !task.completed }),
      });
      updateLead(lead);
    } catch (requestError) { setError(requestError.message); }
  }

  async function deleteLead(lead) {
    if (!window.confirm(`Delete ${lead.fullName}? This cannot be undone.`)) return;
    try {
      await request(`/${lead._id}`, { method: 'DELETE' });
      setLeads((current) => current.filter((item) => item._id !== lead._id));
      setDetailLeadId(null); setNotice('Lead deleted.'); setNoticeWarning(false);
    } catch (requestError) { setError(requestError.message); }
  }

  function updateLead(updated) {
    setLeads((current) => current.map((lead) => lead._id === updated._id ? updated : lead));
  }

  function exportCsv() {
    const columns = ['fullName', 'company', 'email', 'phone', 'source', 'industry', 'estimatedDealValue', 'priority', 'owner', 'stage', 'notes'];
    const cell = (value) => {
      let text = String(value ?? '');
      if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [columns.join(','), ...filteredLeads.map((lead) => columns.map((key) => (
      cell(key === 'notes' ? (lead.notes || []).map((note) => note.text).join('; ') : lead[key])
    )).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'leadflow-leads.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand"><span className="brand-mark"><Activity size={20} /></span><span>Lead<span>Flow</span><small>SMART SALES CRM</small></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          {[['Dashboard', LayoutDashboard], ['Leads', Users], ['Follow-ups', CalendarClock]].map(([label, Icon]) => (
            <button key={label} className={`nav-link ${activeTab === label ? 'selected' : ''}`} onClick={() => setActiveTab(label)}>
              <Icon size={18} /><span>{label}</span>{label === 'Follow-ups' && overdue > 0 && <i className="nav-count">{overdue}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="user-avatar">LF</div><div className="user-meta"><b>LeadFlow workspace</b><span>Sales team</span></div><ChevronDown size={16} /></div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeTab}</strong></div>
          <div className="topbar-actions"><span className="today-label">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><div className="avatar">LF</div></div>
        </header>
        <div className="content-wrap">
          <div className="page-heading">
            <div><span className="eyebrow">SALES OVERVIEW</span><h1>{activeTab === 'Dashboard' ? 'Good work starts here.' : activeTab}</h1><p>A clear view of your pipeline, people, and next steps.</p></div>
            <div className="heading-actions"><button className="button button-quiet" onClick={exportCsv}><Download size={16} /> Export CSV</button><button className="button button-primary" onClick={() => setDialogLead({ ...blankLead })}><Plus size={17} /> Add lead</button></div>
          </div>
          {notice && <button className={`notice ${noticeWarning ? 'notice-warning' : ''}`} role={noticeWarning ? 'alert' : 'status'} onClick={() => setNotice('')}>{noticeWarning ? <AlertTriangle size={15} /> : <Check size={15} />}{notice}<X size={14} /></button>}
          {error && <div className="alert-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button><button className="retry-link" onClick={loadLeads}>Retry</button></div>}
          <section className="metrics-grid">
            <IconMetric icon={Users} label="Total leads" value={leads.length} note="Across all pipeline stages" color="lavender" />
            <IconMetric icon={CircleDollarSign} label="Open pipeline value" value={money(openValue)} note="Excludes won and lost deals" color="mint" />
            <IconMetric icon={TrendingUp} label="Won deal value" value={money(wonValue)} note={`${converted} closed-won ${converted === 1 ? 'deal' : 'deals'}`} color="peach" />
            <IconMetric icon={ArrowUpRight} label="Conversion rate" value={`${conversion}%`} note="Won leads / total leads" color="blue" />
            <IconMetric icon={Clock3} label="Overdue follow-ups" value={overdue} note={overdue ? 'Needs your attention' : 'You are all caught up'} color="rose" />
          </section>
          <section className="stage-summary">
            <div className="section-heading"><div><span className="eyebrow">PIPELINE HEALTH</span><h2>Leads by stage</h2></div><button className="text-button" onClick={() => setActiveTab('Leads')}>View pipeline <ArrowUpRight size={15} /></button></div>
            <div className="stage-strip">{stageTotals.map(({ stage, count }) => <button key={stage} className="stage-summary-item" onClick={() => { setFilters((current) => ({ ...current, stage: current.stage === stage ? '' : stage })); setActiveTab('Leads'); }}><span className={`stage-dot ${stage.toLowerCase()}`} /><span>{stage}</span><b>{count}</b></button>)}</div>
          </section>
          <section className="leads-section">
            <div className="leads-heading">
              <div><span className="eyebrow">{activeTab === 'Follow-ups' ? 'TASK MANAGEMENT' : 'YOUR PIPELINE'}</span><h2>{activeTab === 'Follow-ups' ? 'Follow-ups' : 'Lead pipeline'} <span className="count-pill">{filteredLeads.length}</span></h2></div>
              <div className="view-toggle"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} aria-label="Kanban view"><BriefcaseBusiness size={17} /></button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} aria-label="Table view"><List size={17} /></button></div>
            </div>
            <div className="toolbar">
              <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads..." /></label>
              <label className="filter-select"><Filter size={15} /><select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><option value="">All stages</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              <label className="filter-select"><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
              <label className="filter-select"><select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}><option value="">All sources</option>{[...new Set([...sources, ...leads.map((lead) => lead.source).filter(Boolean)])].sort().map((source) => <option key={source}>{source}</option>)}</select></label>
              <label className="filter-select"><select value={filters.owner} onChange={(event) => setFilters({ ...filters, owner: event.target.value })}><option value="">All owners</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
              <label className="filter-select sort-select"><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Newest first</option><option value="dealValue">Deal value</option><option value="nextFollowUp">Next follow-up</option></select></label>
            </div>
            {loading ? <div className="loading-state"><LoaderCircle className="spin" size={22} />Loading your leads...</div>
              : activeTab === 'Follow-ups' ? <div className="followups-page">
                {followUpItems.filter((item) => !item.completed).map((item) => {
                  const isOverdue = new Date(item.dueDate) < new Date();
                  return <article className={`followup-card ${isOverdue ? 'overdue-card' : ''}`} key={item._id}>
                    <label className="followup-check"><input type="checkbox" checked={item.completed} onChange={() => toggleFollowUp(item)} /><span /></label>
                    <div className={`followup-type-icon ${item.type?.toLowerCase()}`}>{item.type === 'Call' ? <Phone size={17} /> : item.type === 'Email' ? <Mail size={17} /> : <CalendarDays size={17} />}</div>
                    <div className="followup-content"><div className="followup-line"><b>{item.note}</b><span className={`followup-status ${isOverdue ? 'late' : ''}`}>{isOverdue ? 'Overdue' : 'Upcoming'}</span></div><p><button onClick={() => setDetailLeadId(item.lead._id)}>{item.lead.fullName}</button><span> · {item.lead.company || 'No company'}</span></p></div>
                    <time>{dateLabel(item.dueDate, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </article>;
                })}
                {!followUpItems.some((item) => !item.completed) && <div className="empty-results"><div className="empty-icon"><Check size={21} /></div><h3>You’re all caught up</h3><p>Schedule follow-ups from a lead’s detail panel to keep momentum going.</p></div>}
              </div>
              : view === 'board' ? <div className="kanban">{stages.map((stage) => {
                const stageLeads = filteredLeads.filter((lead) => lead.stage === stage);
                return <section className="kanban-column" key={stage}><div className="kanban-title"><span className={`stage-dot ${stage.toLowerCase()}`} /><b>{stage}</b><i>{stageLeads.length}</i><span className="column-value">{money(stageLeads.reduce((sum, lead) => sum + Number(lead.estimatedDealValue || 0), 0))}</span></div>
                  <div className="kanban-cards">{stageLeads.map((lead) => <article className="lead-card" key={lead._id}>
                    <button className="card-open" onClick={() => setDetailLeadId(lead._id)}><div className="card-top"><span className={`priority-tag ${lead.priority?.toLowerCase()}`}>{lead.priority}</span><span className="card-value">{money(lead.estimatedDealValue)}</span></div><h3>{lead.fullName}</h3><p>{lead.company || lead.email || 'No company details'}</p><div className="card-footer"><span className="avatar tiny">{lead.owner?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2) || '?'}</span><small>{lead.owner || 'Unassigned'}</small><span className="card-source">{lead.source}</span></div></button>
                    <label className="move-stage">Move to<select aria-label={`Move ${lead.fullName} to a stage`} value={lead.stage} onChange={(event) => changeStage(lead, event.target.value)}>{stages.map((option) => <option key={option}>{option}</option>)}</select></label>
                  </article>)}
                  {!stageLeads.length && <div className="empty-column">No leads in this stage</div>}</div></section>;
              })}</div> : <div className="table-wrap"><table><thead><tr><th>Lead</th><th>Stage</th><th>Deal value</th><th>Priority</th><th>Owner</th><th>Source</th><th>Next follow-up</th><th /></tr></thead><tbody>{filteredLeads.map((lead) => {
                const next = (lead.followUps || []).filter((task) => !task.completed).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
                return <tr key={lead._id}><td><button className="table-lead" onClick={() => setDetailLeadId(lead._id)}><span className="avatar tiny">{lead.fullName?.[0]}</span><span><b>{lead.fullName}</b><small>{lead.company || lead.email || '—'}</small></span></button></td><td><select className={`table-stage ${lead.stage?.toLowerCase()}`} value={lead.stage} onChange={(event) => changeStage(lead, event.target.value)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></td><td className="money-cell">{money(lead.estimatedDealValue)}</td><td><span className={`priority-tag ${lead.priority?.toLowerCase()}`}>{lead.priority}</span></td><td>{lead.owner || '—'}</td><td>{lead.source || '—'}</td><td>{next ? dateLabel(next.dueDate, { month: 'short', day: 'numeric' }) : '—'}</td><td><button className="icon-button" onClick={() => setDialogLead(lead)} aria-label="Edit lead"><Pencil size={15} /></button></td></tr>;
              })}</tbody></table></div>}
            {!loading && !error && !filteredLeads.length && activeTab !== 'Follow-ups' && <div className="empty-results"><div className="empty-icon"><Users size={21} /></div><h3>{leads.length ? 'No matching leads' : 'Your pipeline starts here'}</h3><p>{leads.length ? 'Try a different search or clear some filters.' : 'Add your first lead to start building a thoughtful sales pipeline.'}</p>{!leads.length && <button className="button button-primary" onClick={() => setDialogLead({ ...blankLead })}><Plus size={16} /> Add your first lead</button>}</div>}
          </section>
          <footer className="app-footer"><span>LeadFlow CRM</span><span>Small steps, stronger relationships.</span></footer>
        </div>
      </main>
      {dialogLead && <LeadDialog key={dialogLead._id || 'new'} initial={dialogLead} onClose={() => setDialogLead(null)} onSave={saveLead} busy={busy} />}
      {detailLead && <LeadDetail key={detailLead._id} lead={detailLead} onClose={() => setDetailLeadId(null)} onEdit={(lead) => { setDetailLeadId(null); setDialogLead(lead); }} onDelete={deleteLead} onUpdated={updateLead} />}
    </div>
  );
}

export default App;
