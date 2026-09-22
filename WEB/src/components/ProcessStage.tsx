import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { formatDate } from '../utils/formatDate';
import './ProcessStage.css';

/**
 * One stage of the line: plasma, tinker or buffing. They behave identically -
 * pieces come in from the stage before, go out either on our own floor or to a
 * vendor, and vendor work is priced from that vendor's rate card for this
 * stage (a flat charge per piece, or a rate per inch of the product's height).
 *
 * A job stays `in_progress` until the work comes back. Only then do its pieces
 * become available to the next stage, which is also what makes the count of
 * pieces currently sitting at a vendor meaningful.
 */

export type Stage = 'plasma' | 'tinker' | 'buffing';

interface StageConfig {
  label: string;
  /** Where this stage's pieces come from, for wording the empty states */
  source: string;
  /** Wording for the button that starts a job */
  action: string;
}

const STAGE_CONFIG: Record<Stage, StageConfig> = {
  plasma: { label: 'Plasma', source: 'cutting', action: 'Send to Plasma' },
  tinker: { label: 'Tinker', source: 'plasma', action: 'Send to Tinker' },
  buffing: { label: 'Buffing', source: 'tinker', action: 'Send to Buffing' },
};

interface ProcessLine {
  id?: number;
  product_id: number | string;
  product_name?: string;
  unit?: string;
  quantity: number | string;
  charge_type?: string;
  height_inches?: number;
  rate?: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  unpriced?: boolean;
}

interface ProcessJob {
  id?: number;
  job_number?: string;
  job_date: string;
  mode: 'in_house' | 'vendor';
  vendor_id?: number | string | null;
  vendor_name?: string;
  work_status?: string;
  completed_date?: string;
  status?: string;
  notes?: string;
  total_quantity?: number;
  total_cost?: number;
  line_count?: number;
  items: ProcessLine[];
}

interface StageStock {
  product_id: number;
  product_name: string;
  unit?: string;
  height_inches?: number;
  ready: number;
  in_progress: number;
  completed: number;
  pending: number;
}

interface Summary {
  stage: string;
  stage_label: string;
  total_jobs: number;
  in_house_jobs: number;
  vendor_jobs: number;
  total_quantity: number;
  in_house_quantity: number;
  vendor_quantity: number;
  total_cost: number;
  unpaid_cost: number;
  pending_quantity: number;
  in_progress_quantity: number;
}

interface Vendor {
  id: number;
  name: string;
  status?: string;
}

interface Product {
  id: number;
  name: string;
}

interface StageRate {
  id?: number;
  vendor_id: number | string;
  product_id: number | string;
  product_name?: string;
  charge_type: 'flat' | 'per_inch';
  flat_charge: number | string;
  rate_per_inch: number | string;
  effective_date: string;
  notes?: string;
  height_inches?: number;
  unit_cost?: number;
}

const today = () => new Date().toISOString().split('T')[0];

const emptyJob = (): ProcessJob => ({
  job_date: today(),
  mode: 'in_house',
  vendor_id: '',
  notes: '',
  items: [],
});

const money = (value?: number) => `₹${Number(value || 0).toFixed(2)}`;

export default function ProcessStage({ stage }: { stage: Stage }) {
  const config = STAGE_CONFIG[stage];
  const [jobs, setJobs] = useState<ProcessJob[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pending, setPending] = useState<StageStock[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [filters, setFilters] = useState({ fromDate: '', toDate: '', mode: '', vendorId: '' });

  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<ProcessJob | null>(null);
  const [form, setForm] = useState<ProcessJob>(emptyJob());
  // Pieces free to send, recomputed for the job being edited so its own
  // quantities are not counted against it
  const [available, setAvailable] = useState<StageStock[]>([]);
  // What the vendor would charge for the lines as they currently stand
  const [quote, setQuote] = useState<ProcessLine[]>([]);
  const [saving, setSaving] = useState(false);

  const [showRateModal, setShowRateModal] = useState(false);
  const [rateVendorId, setRateVendorId] = useState<number | string>('');
  const [rates, setRates] = useState<StageRate[]>([]);
  const [rateForm, setRateForm] = useState<StageRate>({
    vendor_id: '',
    product_id: '',
    charge_type: 'flat',
    flat_charge: '',
    rate_per_inch: '',
    effective_date: today(),
    notes: '',
  });

  useEffect(() => {
    loadAll();
  }, [stage]);

  useEffect(() => {
    loadJobs();
  }, [filters, stage]);

  // Re-price whenever the vendor, the date or the lines change. In-house work
  // is free, so there is nothing to ask the server for.
  useEffect(() => {
    if (!showJobModal || form.mode !== 'vendor' || !form.vendor_id) {
      setQuote([]);
      return;
    }
    const lines = form.items
      .filter((i) => Number(i.product_id) > 0 && Number(i.quantity) > 0)
      .map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) }));

    if (lines.length === 0) {
      setQuote([]);
      return;
    }

    let cancelled = false;
    apiClient
      .quoteProcessJob(stage, Number(form.vendor_id), form.job_date, lines)
      .then((data) => {
        if (!cancelled) setQuote(data as ProcessLine[]);
      })
      .catch(() => {
        if (!cancelled) setQuote([]);
      });

    return () => {
      cancelled = true;
    };
  }, [showJobModal, form.mode, form.vendor_id, form.job_date, form.items]);

  const loadAll = async () => {
    await Promise.all([loadJobs(), loadSummary(), loadStock(), loadMasters()]);
  };

  const loadJobs = async () => {
    try {
      const data = await apiClient.getAllProcessJobs(stage, filters);
      setJobs(data as ProcessJob[]);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await apiClient.getProcessSummary(stage);
      setSummary(data as Summary);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const loadStock = async () => {
    try {
      const data = await apiClient.getProcessStock(stage);
      setPending(data as StageStock[]);
    } catch (error) {
      console.error('Failed to load stage stock:', error);
    }
  };

  const loadMasters = async () => {
    try {
      const [vendorData, productData] = await Promise.all([
        apiClient.getAllVendors(stage),
        apiClient.getAllProducts(),
      ]);
      setVendors((vendorData as Vendor[]).filter((v) => v.status !== 'inactive'));
      setProducts(productData as Product[]);
    } catch (error) {
      console.error('Failed to load vendors and products:', error);
    }
  };

  const openAdd = async () => {
    setEditingJob(null);
    setForm(emptyJob());
    setQuote([]);
    try {
      const data = await apiClient.getProcessPending(stage);
      setAvailable(data as StageStock[]);
    } catch (error) {
      setAvailable([]);
    }
    setShowJobModal(true);
  };

  const openEdit = async (job: ProcessJob) => {
    setEditingJob(job);
    setForm({
      ...job,
      vendor_id: job.vendor_id ?? '',
      notes: job.notes ?? '',
      items: job.items.map((i) => ({ ...i })),
    });
    try {
      const data = await apiClient.getProcessPending(stage, job.id);
      setAvailable(data as StageStock[]);
    } catch (error) {
      setAvailable([]);
    }
    setShowJobModal(true);
  };

  const closeJobModal = () => {
    setShowJobModal(false);
    setEditingJob(null);
    setForm(emptyJob());
    setQuote([]);
  };

  const addLine = () => {
    setForm({ ...form, items: [...form.items, { product_id: '', quantity: '' }] });
  };

  const updateLine = (index: number, patch: Partial<ProcessLine>) => {
    setForm({
      ...form,
      items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  };

  const removeLine = (index: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  /** The priced version of a line, when the vendor has a rate for it. */
  const quoteFor = (productId: number | string) =>
    quote.find((q) => Number(q.product_id) === Number(productId));

  const quoteTotal = quote.reduce((sum, line) => sum + Number(line.total_cost || 0), 0);
  const quantityTotal = form.items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const unpricedLines = quote.filter((line) => line.unpriced);

  /** Pieces still free for a line, counting what the other lines already claim. */
  const availableFor = (productId: number | string, index: number) => {
    const row = available.find((p) => p.product_id === Number(productId));
    if (!row) return 0;
    const claimed = form.items.reduce(
      (sum, item, i) =>
        i !== index && Number(item.product_id) === Number(productId)
          ? sum + (Number(item.quantity) || 0)
          : sum,
      0,
    );
    return row.pending - claimed;
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const lines = form.items.filter(
      (i) => Number(i.product_id) > 0 && Number(i.quantity) > 0,
    );
    if (lines.length === 0) {
      alert('Add at least one product with a count.');
      return;
    }
    if (form.mode === 'vendor' && !form.vendor_id) {
      alert(`Select the vendor doing the ${config.label.toLowerCase()} work.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        job_date: form.job_date,
        mode: form.mode,
        vendor_id: form.mode === 'vendor' ? Number(form.vendor_id) : null,
        notes: form.notes,
        items: lines.map((i) => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
          notes: i.notes,
        })),
      };

      if (editingJob?.id) {
        await apiClient.updateProcessJob(stage, editingJob.id, payload);
      } else {
        await apiClient.createProcessJob(stage, payload);
      }

      closeJobModal();
      loadAll();
    } catch (error: any) {
      console.error('Failed to save job:', error);
      alert(error.message || 'Failed to save the job.');
    } finally {
      setSaving(false);
    }
  };

  const handleWorkStatus = async (job: ProcessJob, completed: boolean) => {
    if (
      !completed &&
      !confirm(
        `Reopen ${job.job_number}? Its pieces stop being available to the next stage.`,
      )
    )
      return;
    try {
      await apiClient.setProcessJobWorkStatus(
        stage,
        job.id!,
        completed ? 'completed' : 'in_progress',
      );
      loadAll();
    } catch (error: any) {
      console.error('Failed to update the job status:', error);
      alert(error.message || 'Failed to update the job status.');
    }
  };

  const handleDeleteJob = async (job: ProcessJob) => {
    if (!confirm(`Delete job ${job.job_number}?`)) return;
    try {
      await apiClient.deleteProcessJob(stage, job.id!);
      loadAll();
    } catch (error: any) {
      console.error('Failed to delete job:', error);
      alert(error.message || 'Failed to delete the job.');
    }
  };

  const openRates = async (vendorId?: number | string) => {
    const picked = vendorId || (vendors[0] ? vendors[0].id : '');
    setRateVendorId(picked);
    setRateForm({
      vendor_id: picked,
      product_id: '',
      charge_type: 'flat',
      flat_charge: '',
      rate_per_inch: '',
      effective_date: today(),
      notes: '',
    });
    await loadRates(picked);
    setShowRateModal(true);
  };

  const loadRates = async (vendorId: number | string) => {
    if (!vendorId) {
      setRates([]);
      return;
    }
    try {
      const data = await apiClient.getProcessRates(stage, Number(vendorId));
      setRates(data as StageRate[]);
    } catch (error) {
      console.error('Failed to load rates:', error);
      setRates([]);
    }
  };

  const handleRateVendorChange = async (vendorId: string) => {
    setRateVendorId(vendorId);
    setRateForm({ ...rateForm, vendor_id: vendorId });
    await loadRates(vendorId);
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateForm.vendor_id || !rateForm.product_id) {
      alert('Pick a vendor and a product.');
      return;
    }
    try {
      await apiClient.setProcessRate(stage, {
        vendor_id: Number(rateForm.vendor_id),
        product_id: Number(rateForm.product_id),
        charge_type: rateForm.charge_type,
        flat_charge: Number(rateForm.flat_charge) || 0,
        rate_per_inch: Number(rateForm.rate_per_inch) || 0,
        effective_date: rateForm.effective_date,
        notes: rateForm.notes,
      });
      setRateForm({ ...rateForm, product_id: '', flat_charge: '', rate_per_inch: '', notes: '' });
      await loadRates(rateForm.vendor_id);
    } catch (error: any) {
      console.error('Failed to save rate:', error);
      alert(error.message || 'Failed to save the rate.');
    }
  };

  const handleDeleteRate = async (rate: StageRate) => {
    if (!confirm(`Delete the ${rate.effective_date} rate for ${rate.product_name}?`)) return;
    try {
      await apiClient.deleteProcessRate(stage, rate.id!);
      await loadRates(rateVendorId);
    } catch (error: any) {
      console.error('Failed to delete rate:', error);
      alert(error.message || 'Failed to delete the rate.');
    }
  };

  const describeCharge = (line: ProcessLine) => {
    if (line.charge_type === 'per_inch') {
      return `${money(line.rate)}/in × ${Number(line.height_inches || 0)} in`;
    }
    if (line.charge_type === 'flat') return `${money(line.rate)} flat`;
    return 'In house';
  };

  return (
    <div className="process-stage">
      <div className="page-header">
        <h1>{config.label}</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => openRates()}>
            Vendor Charges
          </button>
          <button className="btn-primary" onClick={openAdd}>
            {config.action}
          </button>
        </div>
      </div>

      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Jobs</span>
            <span className="summary-value">{summary.total_jobs}</span>
            <span className="summary-sub">
              {summary.in_house_jobs} in house · {summary.vendor_jobs} vendor
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Pieces Processed</span>
            <span className="summary-value">{summary.total_quantity.toFixed(0)}</span>
            <span className="summary-sub">
              {summary.in_house_quantity.toFixed(0)} in house ·{' '}
              {summary.vendor_quantity.toFixed(0)} vendor
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Vendor Cost</span>
            <span className="summary-value">{money(summary.total_cost)}</span>
          </div>
          <div className="summary-card unpaid">
            <span className="summary-label">Unpaid to Vendors</span>
            <span className="summary-value">{money(summary.unpaid_cost)}</span>
          </div>
          <div className="summary-card in-progress">
            <span className="summary-label">At {config.label}</span>
            <span className="summary-value">{summary.in_progress_quantity.toFixed(0)}</span>
            <span className="summary-sub">sent in, work not finished</span>
          </div>
          <div className="summary-card pending">
            <span className="summary-label">Awaiting {config.label}</span>
            <span className="summary-value">{summary.pending_quantity.toFixed(0)}</span>
            <span className="summary-sub">{config.source} done, not yet sent</span>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="table-container pending-stock">
          <h3 className="section-title">Piece Tracking</h3>
          <table className="process-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Height</th>
                <th className="num">From {config.source}</th>
                <th className="num">At {config.label}</th>
                <th className="num">Finished</th>
                <th className="num">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.product_id}>
                  <td>{row.product_name}</td>
                  <td>{row.height_inches ? `${row.height_inches} in` : '-'}</td>
                  <td className="num">{row.ready.toFixed(0)}</td>
                  <td className="num">{row.in_progress.toFixed(0)}</td>
                  <td className="num">{row.completed.toFixed(0)}</td>
                  <td className="num">
                    <strong>{row.pending.toFixed(0)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>From</label>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Done By</label>
          <select
            value={filters.mode}
            onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
          >
            <option value="">All</option>
            <option value="in_house">In House</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Vendor</label>
          <select
            value={filters.vendorId}
            onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
          >
            <option value="">All</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {(filters.fromDate || filters.toDate || filters.mode || filters.vendorId) && (
          <div className="filter-group filter-clear">
            <label>&nbsp;</label>
            <button
              className="btn-secondary"
              onClick={() => setFilters({ fromDate: '', toDate: '', mode: '', vendorId: '' })}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="process-table">
          <thead>
            <tr>
              <th></th>
              <th>Job</th>
              <th>Date</th>
              <th>Done By</th>
              <th className="num">Pieces</th>
              <th className="num">Cost</th>
              <th>Work</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No {config.label.toLowerCase()} jobs recorded yet.
                </td>
              </tr>
            )}
            {jobs.map((job) => {
              const isOpen = expanded === job.id;
              return [
                <tr
                  key={job.id}
                  className={`entry-row${isOpen ? ' open' : ''}`}
                  onClick={() => setExpanded(isOpen ? null : job.id!)}
                >
                  <td>
                    <span className={`expander${isOpen ? ' open' : ''}`}>▸</span>
                  </td>
                  <td>{job.job_number}</td>
                  <td>{formatDate(job.job_date)}</td>
                  <td>
                    {job.mode === 'vendor' ? (
                      <span className="mode-chip vendor">{job.vendor_name || 'Vendor'}</span>
                    ) : (
                      <span className="mode-chip in-house">In House</span>
                    )}
                  </td>
                  <td className="num">{Number(job.total_quantity || 0).toFixed(0)}</td>
                  <td className="num">
                    {job.mode === 'vendor' ? money(job.total_cost) : '-'}
                  </td>
                  <td>
                    <span className={`status-chip ${job.work_status}`}>
                      {job.work_status === 'completed' ? 'Finished' : 'In Progress'}
                    </span>
                  </td>
                  <td>
                    {job.mode === 'vendor' ? (
                      <span className={`status-chip ${job.status}`}>
                        {job.status === 'paid' ? 'Paid' : 'Not Paid'}
                      </span>
                    ) : (
                      <span className="status-chip none">-</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {job.work_status === 'completed' ? (
                      <button className="btn-reopen" onClick={() => handleWorkStatus(job, false)}>
                        Reopen
                      </button>
                    ) : (
                      <button className="btn-finish" onClick={() => handleWorkStatus(job, true)}>
                        Mark Finished
                      </button>
                    )}
                    <button className="btn-edit" onClick={() => openEdit(job)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDeleteJob(job)}>
                      Delete
                    </button>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`detail-${job.id}`} className="lines-row">
                    <td colSpan={9}>
                      <div className="lines-wrap">
                        <table className="lines-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th className="num">Pieces</th>
                              <th>Charge</th>
                              <th className="num">Per Piece</th>
                              <th className="num">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {job.items.map((line) => (
                              <tr key={line.id}>
                                <td>{line.product_name}</td>
                                <td className="num">{Number(line.quantity).toFixed(0)}</td>
                                <td>{describeCharge(line)}</td>
                                <td className="num">
                                  {job.mode === 'vendor' ? money(line.unit_cost) : '-'}
                                </td>
                                <td className="num">
                                  {job.mode === 'vendor' ? money(line.total_cost) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {job.notes && <p className="lines-note">Note: {job.notes}</p>}
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>

      {showJobModal && (
        <div className="modal-overlay" onClick={closeJobModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingJob ? `Edit ${editingJob.job_number}` : config.action}</h2>
            <form onSubmit={handleSaveJob}>
              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    required
                    value={form.job_date}
                    onChange={(e) => setForm({ ...form, job_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Done By *</label>
                  <div className="mode-toggle">
                    <button
                      type="button"
                      className={form.mode === 'in_house' ? 'active' : ''}
                      onClick={() => setForm({ ...form, mode: 'in_house', vendor_id: '' })}
                    >
                      In House
                    </button>
                    <button
                      type="button"
                      className={form.mode === 'vendor' ? 'active' : ''}
                      onClick={() => setForm({ ...form, mode: 'vendor' })}
                    >
                      Vendor
                    </button>
                  </div>
                </div>
                {form.mode === 'vendor' && (
                  <div className="form-group">
                    <label>Vendor *</label>
                    <select
                      required
                      value={form.vendor_id ?? ''}
                      onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                    >
                      <option value="">Select vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    {vendors.length === 0 && (
                      <span className="field-hint warn">
                        No {config.label.toLowerCase()} vendors yet — add one under Vendors →{' '}
                        {config.label}.
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="items-section">
                <div className="items-header">
                  <h3>Pieces</h3>
                  <span className="items-hint">
                    Only pieces {config.source} has finished, and that have not already been
                    sent in, can go here.
                  </span>
                </div>

                {available.length === 0 ? (
                  <p className="picker-empty">
                    Nothing is waiting for {config.label.toLowerCase()} — finish some{' '}
                    {config.source} work first.
                  </p>
                ) : (
                  <div className="items-grid">
                    <div className="items-grid-head">
                      <span>Product</span>
                      <span>Pieces</span>
                      <span>Charge</span>
                      <span>Line Total</span>
                      <span></span>
                    </div>
                    {form.items.map((line, index) => {
                      const priced = quoteFor(line.product_id);
                      const max = availableFor(line.product_id, index);
                      const over = Number(line.quantity) > max;
                      return (
                        <div className="item-line" key={index}>
                          <div className="item-field">
                            <select
                              value={line.product_id}
                              onChange={(e) => updateLine(index, { product_id: e.target.value })}
                            >
                              <option value="">Select product</option>
                              {available.map((p) => (
                                <option key={p.product_id} value={p.product_id}>
                                  {p.product_name}
                                  {p.height_inches ? ` (${p.height_inches} in)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="item-field">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              className={over ? 'over-limit' : ''}
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { quantity: e.target.value })}
                            />
                            {line.product_id !== '' && (
                              <span className={`field-hint${over ? ' warn' : ''}`}>
                                {max.toFixed(0)} available
                              </span>
                            )}
                          </div>
                          <div className="item-field readonly">
                            {form.mode === 'in_house'
                              ? 'In house'
                              : priced
                                ? priced.unpriced
                                  ? 'No rate set'
                                  : describeCharge(priced)
                                : '—'}
                          </div>
                          <div className="item-field readonly">
                            {form.mode === 'in_house' ? '-' : money(priced?.total_cost)}
                          </div>
                          <div className="item-field item-remove">
                            <button
                              type="button"
                              className="btn-row-remove"
                              onClick={() => removeLine(index)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {available.length > 0 && (
                  <button type="button" className="btn-add-row" onClick={addLine}>
                    + Add Product
                  </button>
                )}
              </div>

              {form.mode === 'vendor' && unpricedLines.length > 0 && (
                <p className="rate-warning">
                  {unpricedLines.length === 1 ? 'One product has' : `${unpricedLines.length} products have`}{' '}
                  no charge set for this vendor — those lines will be recorded at zero. Set the
                  charge under Vendor Charges and save the job again to price them.
                </p>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="total-preview">
                <span>{quantityTotal.toFixed(0)} pieces</span>
                {form.mode === 'vendor' && <strong>{money(quoteTotal)}</strong>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeJobModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingJob ? 'Save Changes' : 'Record Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRateModal && (
        <div className="modal-overlay" onClick={() => setShowRateModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Vendor Charges</h2>
            <p className="modal-hint">
              A vendor charges either a flat amount for every piece, or an amount for each inch of
              the product's height. Rates are dated, so jobs keep the price they were billed at.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label>Vendor</label>
                <select
                  value={rateVendorId}
                  onChange={(e) => handleRateVendorChange(e.target.value)}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {vendors.length === 0 && (
                  <span className="field-hint warn">
                    No {config.label.toLowerCase()} vendors yet — add one under Vendors →{' '}
                    {config.label}.
                  </span>
                )}
              </div>
            </div>

            <form className="rate-form" onSubmit={handleSaveRate}>
              <div className="form-row form-row-3">
                <div className="form-group">
                  <label>Product *</label>
                  <select
                    value={rateForm.product_id}
                    onChange={(e) => setRateForm({ ...rateForm, product_id: e.target.value })}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Charges *</label>
                  <select
                    value={rateForm.charge_type}
                    onChange={(e) =>
                      setRateForm({
                        ...rateForm,
                        charge_type: e.target.value as 'flat' | 'per_inch',
                      })
                    }
                  >
                    <option value="flat">Flat, per piece</option>
                    <option value="per_inch">Per inch of height</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    {rateForm.charge_type === 'per_inch' ? 'Rate Per Inch *' : 'Flat Charge *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={rateForm.charge_type === 'per_inch' ? 'e.g. 2' : 'e.g. 25'}
                    value={
                      rateForm.charge_type === 'per_inch'
                        ? rateForm.rate_per_inch
                        : rateForm.flat_charge
                    }
                    onChange={(e) =>
                      setRateForm(
                        rateForm.charge_type === 'per_inch'
                          ? { ...rateForm, rate_per_inch: e.target.value }
                          : { ...rateForm, flat_charge: e.target.value },
                      )
                    }
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Effective From *</label>
                  <input
                    type="date"
                    required
                    value={rateForm.effective_date}
                    onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text"
                    value={rateForm.notes ?? ''}
                    onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
                  />
                </div>
                <div className="form-group form-group-action">
                  <label>&nbsp;</label>
                  <button type="submit" className="btn-primary">
                    Save Charge
                  </button>
                </div>
              </div>
            </form>

            <div className="table-container">
              <table className="process-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Charges</th>
                    <th className="num">Rate</th>
                    <th className="num">Per Piece</th>
                    <th>Effective From</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        No charges set for this vendor yet.
                      </td>
                    </tr>
                  )}
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td>{rate.product_name}</td>
                      <td>
                        {rate.charge_type === 'per_inch' ? 'Per inch of height' : 'Flat, per piece'}
                      </td>
                      <td className="num">
                        {rate.charge_type === 'per_inch'
                          ? `${money(Number(rate.rate_per_inch))}/in`
                          : money(Number(rate.flat_charge))}
                      </td>
                      <td className="num">
                        {rate.charge_type === 'per_inch' && !rate.height_inches ? (
                          <span className="warn-text">no height</span>
                        ) : (
                          money(rate.unit_cost)
                        )}
                      </td>
                      <td>{formatDate(rate.effective_date)}</td>
                      <td>
                        <button className="btn-delete" onClick={() => handleDeleteRate(rate)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRateModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
