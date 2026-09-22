import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { formatDateTime } from '../utils/formatDate';
import './RawMaterials.css';

interface Vendor {
  id?: number;
  name: string;
}

interface Master {
  id?: number;
  name: string;
}

interface VendorRate {
  point_id: number;
  rate_per_kg: number;
  effective_date: string;
}

interface Item {
  id?: number;
  point_id: number;
  point_name?: string;
  size_id: number;
  size_name?: string;
  weight: number;
  rate_per_kg: number;
  total_cost?: number;
  status?: string;
  notes?: string;
}

interface Entry {
  id?: number;
  entry_number?: string;
  vendor_id: number;
  vendor_name?: string;
  received_date: string;
  notes?: string;
  total_weight?: number;
  total_cost?: number;
  line_count?: number;
  status_summary?: Record<string, number>;
  items: Item[];
}

interface StatusLog {
  id?: number;
  status: string;
  notes?: string;
  changed_at: string;
}

interface Summary {
  total_entries: number;
  total_lines: number;
  in_stock_weight: number;
  in_stock_value: number;
  in_use_weight: number;
  consumed_weight: number;
}

// A line being edited in the form. `key` keeps React stable across add/remove.
interface FormRow {
  key: number;
  id?: number;
  point_id: number;
  size_id: number;
  weight: number;
  rate_per_kg: number;
  rate_touched: boolean;
}

const STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'in_use', label: 'In Use' },
  { value: 'consumed', label: 'Consumed' },
  { value: 'returned', label: 'Returned' },
];

const statusLabel = (status?: string) =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label || status || '-';

let rowKeySeed = 0;
const newRow = (): FormRow => ({
  key: ++rowKeySeed,
  point_id: 0,
  size_id: 0,
  weight: 0,
  rate_per_kg: 0,
  rate_touched: false,
});

/**
 * The rate a row should show for its point. A rate the user typed is always kept;
 * otherwise it follows the vendor mapping, and clears when the new point has none
 * so a rate belonging to a different point is never left behind.
 */
const rateForPoint = (
  row: FormRow,
  pointId: number,
  rates: VendorRate[]
): { rate_per_kg: number; rate_touched: boolean } => {
  if (row.rate_touched) {
    return { rate_per_kg: row.rate_per_kg, rate_touched: true };
  }
  const mapped = rates.find((rate) => rate.point_id === pointId);
  return { rate_per_kg: mapped ? mapped.rate_per_kg : 0, rate_touched: false };
};

const emptyHeader = () => ({
  vendor_id: 0,
  received_date: new Date().toISOString().split('T')[0],
  notes: '',
});

export default function RawMaterials() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [points, setPoints] = useState<Master[]>([]);
  const [sizes, setSizes] = useState<Master[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [expanded, setExpanded] = useState<number[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [header, setHeader] = useState(emptyHeader());
  const [rows, setRows] = useState<FormRow[]>([newRow()]);
  const [vendorRates, setVendorRates] = useState<VendorRate[]>([]);
  const [updateVendorRates, setUpdateVendorRates] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusItem, setStatusItem] = useState<Item | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusLog[]>([]);
  const [statusForm, setStatusForm] = useState({ status: 'in_stock', notes: '' });

  useEffect(() => {
    loadVendors();
    loadMasters();
  }, []);

  useEffect(() => {
    loadEntries();
  }, [statusFilter, vendorFilter]);

  // The vendor's rates as they stood on the delivery date
  useEffect(() => {
    if (!showModal || !header.vendor_id) {
      setVendorRates([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.getCurrentVendorRates(header.vendor_id, header.received_date);
        if (!cancelled) setVendorRates(data as VendorRate[]);
      } catch (error) {
        if (!cancelled) setVendorRates([]);
      }
    })();

    return () => { cancelled = true; };
  }, [showModal, header.vendor_id, header.received_date]);

  // Re-fill every untouched row when the vendor or the delivery date changes
  useEffect(() => {
    if (!showModal || editingEntry) return;

    setRows((prev) =>
      prev.map((row) => {
        if (row.rate_touched || !row.point_id) return row;
        const next = rateForPoint(row, row.point_id, vendorRates);
        return next.rate_per_kg === row.rate_per_kg ? row : { ...row, ...next };
      })
    );
  }, [vendorRates, showModal, editingEntry]);

  const loadEntries = async () => {
    try {
      const data = await apiClient.getAllRawMaterialEntries(
        statusFilter || undefined,
        vendorFilter ? parseInt(vendorFilter) : undefined
      );
      setEntries(data as Entry[]);
      setSummary((await apiClient.getRawMaterialSummary()) as Summary);
    } catch (error) {
      console.error('Failed to load raw materials:', error);
    }
  };

  const loadVendors = async () => {
    try {
      setVendors((await apiClient.getAllVendors('material')) as Vendor[]);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const loadMasters = async () => {
    try {
      const [pointData, sizeData] = await Promise.all([
        apiClient.getAllMaterialPoints(),
        apiClient.getAllMaterialSizes(),
      ]);
      setPoints(pointData as Master[]);
      setSizes(sizeData as Master[]);
    } catch (error) {
      console.error('Failed to load material masters:', error);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openAdd = () => {
    setEditingEntry(null);
    setHeader(emptyHeader());
    setRows([newRow()]);
    setVendorRates([]);
    setUpdateVendorRates(false);
    setShowModal(true);
  };

  const openEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setHeader({
      vendor_id: entry.vendor_id,
      received_date: entry.received_date,
      notes: entry.notes || '',
    });
    setRows(
      entry.items.map((item) => ({
        key: ++rowKeySeed,
        id: item.id,
        point_id: item.point_id,
        size_id: item.size_id,
        weight: item.weight,
        rate_per_kg: item.rate_per_kg,
        rate_touched: true,
      }))
    );
    setVendorRates([]);
    setUpdateVendorRates(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setHeader(emptyHeader());
    setRows([newRow()]);
    setVendorRates([]);
    setUpdateVendorRates(false);
  };

  const updateRow = (key: number, changes: Partial<FormRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  // Changing a point re-resolves that row's rate there and then; waiting on an
  // effect would miss it, since the vendor rates themselves have not changed.
  const changeRowPoint = (key: number, pointId: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? { ...row, point_id: pointId, ...rateForPoint(row, pointId, vendorRates) }
          : row
      )
    );
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (key: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.key !== key)));

  const mappedRateFor = (pointId: number) =>
    vendorRates.find((rate) => rate.point_id === pointId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!header.vendor_id) {
      alert('Please select a vendor.');
      return;
    }
    if (rows.some((row) => !row.point_id || !row.size_id || row.weight <= 0 || row.rate_per_kg <= 0)) {
      alert('Every line needs a point, a size, a weight and a rate.');
      return;
    }

    const payload = {
      ...header,
      update_vendor_rates: updateVendorRates,
      items: rows.map((row) => ({
        id: row.id,
        point_id: row.point_id,
        size_id: row.size_id,
        weight: row.weight,
        rate_per_kg: row.rate_per_kg,
      })),
    };

    try {
      if (editingEntry?.id) {
        await apiClient.updateRawMaterialEntry(editingEntry.id, payload);
      } else {
        await apiClient.createRawMaterialEntry(payload);
      }
      closeModal();
      loadEntries();
    } catch (error: any) {
      console.error('Failed to save entry:', error);
      alert(error.message || 'Failed to save. Please try again.');
    }
  };

  const handleDeleteEntry = async (entry: Entry) => {
    if (!confirm(`Delete entry ${entry.entry_number} and all ${entry.line_count} of its lines?`)) return;
    try {
      await apiClient.deleteRawMaterialEntry(entry.id!);
      loadEntries();
    } catch (error: any) {
      console.error('Failed to delete entry:', error);
      alert(error.message || 'Failed to delete entry.');
    }
  };

  const handleDeleteItem = async (entry: Entry, item: Item) => {
    const last = (entry.line_count || 0) <= 1;
    const message = last
      ? `This is the only line in ${entry.entry_number}. Deleting it removes the whole entry. Continue?`
      : `Delete the ${item.point_name}/${item.size_name} line?`;
    if (!confirm(message)) return;
    try {
      await apiClient.deleteRawMaterialItem(item.id!);
      loadEntries();
    } catch (error: any) {
      console.error('Failed to delete line:', error);
      alert(error.message || 'Failed to delete line.');
    }
  };

  const openItemStatus = async (item: Item) => {
    setStatusItem(item);
    setStatusForm({ status: item.status || 'in_stock', notes: '' });
    try {
      setStatusHistory((await apiClient.getRawMaterialItemStatusHistory(item.id!)) as StatusLog[]);
      setShowStatusModal(true);
    } catch (error: any) {
      console.error('Failed to load status history:', error);
      alert(error.message || 'Failed to load status history.');
    }
  };

  const handleUpdateItemStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusItem?.id) return;
    if (statusForm.status === statusItem.status) {
      alert('This line is already in that status. Pick a different one.');
      return;
    }
    try {
      const updated = await apiClient.updateRawMaterialItemStatus(
        statusItem.id,
        statusForm.status,
        statusForm.notes
      );
      setStatusItem(updated as Item);
      setStatusHistory((await apiClient.getRawMaterialItemStatusHistory(statusItem.id)) as StatusLog[]);
      setStatusForm({ ...statusForm, notes: '' });
      loadEntries();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert(error.message || 'Failed to update status.');
    }
  };

  const handleEntryStatus = async (entry: Entry) => {
    const choice = prompt(
      `Move all ${entry.line_count} lines of ${entry.entry_number} to which status?\n\n` +
        STATUS_OPTIONS.map((o) => `${o.value} = ${o.label}`).join('\n'),
      'in_use'
    );
    if (!choice) return;
    if (!STATUS_OPTIONS.some((o) => o.value === choice)) {
      alert(`"${choice}" is not a valid status.`);
      return;
    }
    try {
      await apiClient.updateRawMaterialEntryStatus(entry.id!, choice);
      loadEntries();
    } catch (error: any) {
      console.error('Failed to update entry status:', error);
      alert(error.message || 'Failed to update status.');
    }
  };

  const rowTotal = (row: FormRow) => (row.weight || 0) * (row.rate_per_kg || 0);
  const grandTotal = rows.reduce((sum, row) => sum + rowTotal(row), 0);
  const totalWeight = rows.reduce((sum, row) => sum + (row.weight || 0), 0);

  const changedPoints = rows
    .filter((row) => {
      if (!row.point_id || row.rate_per_kg <= 0) return false;
      const mapped = mappedRateFor(row.point_id);
      return !mapped || mapped.rate_per_kg !== row.rate_per_kg;
    })
    .map((row) => points.find((p) => p.id === row.point_id)?.name || '')
    .filter((name, index, all) => name && all.indexOf(name) === index);

  const renderStatusSummary = (entry: Entry) => {
    const summaryMap = entry.status_summary || {};
    const keys = Object.keys(summaryMap);
    if (keys.length === 0) return <span className="status-badge">-</span>;
    // A single status covers the whole delivery; otherwise show each with its count
    if (keys.length === 1) {
      return <span className={`status-badge ${keys[0]}`}>{statusLabel(keys[0])}</span>;
    }
    return (
      <span className="status-mixed">
        {keys.map((key) => (
          <span className={`status-badge ${key}`} key={key}>
            {summaryMap[key]} {statusLabel(key)}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="raw-materials">
      <div className="page-header">
        <h1>Raw Materials</h1>
        <button className="btn-primary" onClick={openAdd}>
          + Add Raw Material
        </button>
      </div>

      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Entries</span>
            <span className="summary-value">{summary.total_entries}</span>
            <span className="summary-sub">{summary.total_lines} lines</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">In Stock</span>
            <span className="summary-value">{summary.in_stock_weight.toFixed(3)} kg</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Stock Value</span>
            <span className="summary-value">₹{summary.in_stock_value.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">In Use</span>
            <span className="summary-value">{summary.in_use_weight.toFixed(3)} kg</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Consumed</span>
            <span className="summary-value">{summary.consumed_weight.toFixed(3)} kg</span>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Vendor</label>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
            <option value="">All Vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="raw-materials-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Entry</th>
              <th>Vendor</th>
              <th>Received</th>
              <th>Lines</th>
              <th>Total Weight</th>
              <th>Total Cost</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  No entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isOpen = expanded.includes(entry.id!);
                return [
                  <tr
                    key={`entry-${entry.id}`}
                    className={`entry-row${isOpen ? ' open' : ''}`}
                    onClick={() => toggleExpanded(entry.id!)}
                  >
                    <td>
                      <span className={`expander${isOpen ? ' open' : ''}`}>▸</span>
                    </td>
                    <td><strong>{entry.entry_number}</strong></td>
                    <td>{entry.vendor_name || '-'}</td>
                    <td>{entry.received_date}</td>
                    <td>{entry.line_count}</td>
                    <td>{Number(entry.total_weight || 0).toFixed(3)} kg</td>
                    <td><strong>₹{Number(entry.total_cost || 0).toFixed(2)}</strong></td>
                    <td>{renderStatusSummary(entry)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn-status" onClick={() => handleEntryStatus(entry)}>
                        Status
                      </button>
                      <button className="btn-edit" onClick={() => openEdit(entry)}>
                        Edit
                      </button>
                      <button className="btn-delete" onClick={() => handleDeleteEntry(entry)}>
                        Delete
                      </button>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`lines-${entry.id}`} className="lines-row">
                      <td colSpan={9}>
                        <div className="lines-wrap">
                          <table className="lines-table">
                            <thead>
                              <tr>
                                <th>Point</th>
                                <th>Size</th>
                                <th>Weight (kg)</th>
                                <th>Rate / kg</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.items.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.point_name}</td>
                                  <td>{item.size_name}</td>
                                  <td>{Number(item.weight).toFixed(3)}</td>
                                  <td>₹{Number(item.rate_per_kg).toFixed(2)}</td>
                                  <td><strong>₹{Number(item.total_cost || 0).toFixed(2)}</strong></td>
                                  <td>
                                    <span className={`status-badge ${item.status}`}>
                                      {statusLabel(item.status)}
                                    </span>
                                  </td>
                                  <td>
                                    <button className="btn-status" onClick={() => openItemStatus(item)}>
                                      Status
                                    </button>
                                    <button
                                      className="btn-delete"
                                      onClick={() => handleDeleteItem(entry, item)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {entry.notes && <p className="lines-note">Note: {entry.notes}</p>}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEntry ? `Edit Entry ${editingEntry.entry_number}` : 'Add Raw Material'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Vendor *</label>
                  <select
                    value={header.vendor_id || ''}
                    onChange={(e) => setHeader({ ...header, vendor_id: parseInt(e.target.value) || 0 })}
                    required
                  >
                    <option value="">Select a vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Received Date *</label>
                  <input
                    type="date"
                    value={header.received_date}
                    onChange={(e) => setHeader({ ...header, received_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="items-section">
                <div className="items-header">
                  <h4>Materials Received</h4>
                  {header.vendor_id > 0 && (
                    <span className="items-hint">
                      {vendorRates.length > 0
                        ? 'Rates fill in from this vendor — type over any of them.'
                        : 'No rates mapped for this vendor yet.'}
                    </span>
                  )}
                </div>

                <div className="items-grid">
                  <div className="items-grid-head">
                    <span>Point *</span>
                    <span>Size *</span>
                    <span>Weight (kg) *</span>
                    <span>Rate / kg (₹) *</span>
                    <span>Total</span>
                    <span />
                  </div>

                  {rows.map((row) => {
                    const mapped = mappedRateFor(row.point_id);
                    const overridden = !!mapped && row.rate_per_kg !== mapped.rate_per_kg;
                    return (
                      <div className="item-line" key={row.key}>
                        <div className="item-field">
                          <label>Point *</label>
                          <select
                            value={row.point_id || ''}
                            onChange={(e) => changeRowPoint(row.key, parseInt(e.target.value) || 0)}
                            required
                          >
                            <option value="">Select</option>
                            {points.map((point) => (
                              <option key={point.id} value={point.id}>{point.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="item-field">
                          <label>Size *</label>
                          <select
                            value={row.size_id || ''}
                            onChange={(e) => updateRow(row.key, { size_id: parseInt(e.target.value) || 0 })}
                            required
                          >
                            <option value="">Select</option>
                            {sizes.map((size) => (
                              <option key={size.id} value={size.id}>{size.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="item-field">
                          <label>Weight (kg) *</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={row.weight || ''}
                            placeholder="0"
                            onChange={(e) => updateRow(row.key, { weight: parseFloat(e.target.value) || 0 })}
                            required
                          />
                        </div>

                        <div className="item-field">
                          <label>Rate / kg (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.rate_per_kg || ''}
                            placeholder="0"
                            onChange={(e) =>
                              updateRow(row.key, {
                                rate_per_kg: parseFloat(e.target.value) || 0,
                                rate_touched: true,
                              })
                            }
                            required
                          />
                          {overridden && (
                            <span className="cell-note">was ₹{mapped!.rate_per_kg.toFixed(2)}</span>
                          )}
                        </div>

                        <div className="item-field item-total">
                          <label>Total</label>
                          <span>₹{rowTotal(row).toFixed(2)}</span>
                        </div>

                        <div className="item-field item-remove">
                          <button
                            type="button"
                            className="btn-row-remove"
                            onClick={() => removeRow(row.key)}
                            disabled={rows.length === 1}
                            title={rows.length === 1 ? 'At least one line is needed' : 'Remove this line'}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button type="button" className="btn-add-row" onClick={addRow}>
                  + Add Line
                </button>
              </div>

              <div className="total-preview">
                <span>{rows.length} {rows.length === 1 ? 'line' : 'lines'} · {totalWeight.toFixed(3)} kg</span>
                <span>Total Cost: <strong>₹{grandTotal.toFixed(2)}</strong></span>
              </div>

              {changedPoints.length > 0 && (
                <label className="rate-override-check">
                  <input
                    type="checkbox"
                    checked={updateVendorRates}
                    onChange={(e) => setUpdateVendorRates(e.target.checked)}
                  />
                  Also update this vendor's standard rate for {changedPoints.join(', ')}
                </label>
              )}

              <div className="form-group">
                <label>Notes</label>
                <input
                  type="text"
                  value={header.notes}
                  onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                />
              </div>

              {(points.length === 0 || sizes.length === 0) && (
                <p className="form-hint">
                  No {points.length === 0 ? 'points' : 'sizes'} yet — add them on the Material Masters page first.
                </p>
              )}
              {vendors.length === 0 && (
                <p className="form-hint">
                  No vendors yet — add one on the Vendors page first.
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingEntry ? 'Update Entry' : `Create Entry${rows.length > 1 ? ` (${rows.length} lines)` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatusModal && statusItem && (
        <div className="modal-overlay" onClick={() => { setShowStatusModal(false); setStatusItem(null); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Status - {statusItem.point_name} / {statusItem.size_name}</h2>
            <div className="status-section">
              <h3>
                Current Status: {statusLabel(statusItem.status)}
                <span className="status-meta">{Number(statusItem.weight).toFixed(3)} kg</span>
              </h3>

              <div className="update-status-form">
                <h4>Change Status</h4>
                <form onSubmit={handleUpdateItemStatus}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>New Status *</label>
                      <select
                        value={statusForm.status}
                        onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                        required
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Notes</label>
                      <input
                        type="text"
                        value={statusForm.notes}
                        onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary">Update Status</button>
                </form>
              </div>

              <div className="status-history-list">
                <h4>Status History</h4>
                {statusHistory.length === 0 ? (
                  <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
                    No status changes recorded yet.
                  </p>
                ) : (
                  <table className="status-history-table">
                    <thead>
                      <tr>
                        <th>Changed At</th>
                        <th>Status</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusHistory.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDateTime(log.changed_at)}</td>
                          <td>
                            <span className={`status-badge ${log.status}`}>
                              {statusLabel(log.status)}
                            </span>
                          </td>
                          <td>{log.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowStatusModal(false); setStatusItem(null); }}
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
