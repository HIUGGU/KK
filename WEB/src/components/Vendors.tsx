import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './Vendors.css';
import { notify, confirmDialog } from '../utils/notify';

interface Point {
  id?: number;
  name: string;
}

interface VendorRate {
  id?: number;
  vendor_id: number;
  point_id: number;
  point_name?: string;
  rate_per_kg: number;
  effective_date: string;
  notes?: string;
}

interface Vendor {
  id?: number;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** material, plasma, tinker or buffing - each is its own list of people */
  vendor_type?: string;
  status?: string;
}

/** The kinds of vendor, and what each list is called. */
const VENDOR_TYPES = [
  { value: 'material', label: 'Raw Material', noun: 'Material Vendor' },
  { value: 'plasma', label: 'Plasma', noun: 'Plasma Vendor' },
  { value: 'tinker', label: 'Tinker', noun: 'Tinker Vendor' },
  { value: 'buffing', label: 'Buffing', noun: 'Buffing Vendor' },
] as const;

type VendorType = (typeof VENDOR_TYPES)[number]['value'];

const typeNoun = (value?: string) =>
  VENDOR_TYPES.find((t) => t.value === value)?.noun || 'Vendor';

const LOG_PREVIEW_COUNT = 4;

const emptyVendor: Vendor = {
  name: '',
  company_name: '',
  phone: '',
  email: '',
  address: '',
  vendor_type: 'material',
  status: 'active',
};

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  // Each kind of work has its own list of people
  const [vendorType, setVendorType] = useState<VendorType>('material');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<Vendor>({ ...emptyVendor });
  const [points, setPoints] = useState<Point[]>([]);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateVendor, setRateVendor] = useState<Vendor | null>(null);
  const [currentRates, setCurrentRates] = useState<VendorRate[]>([]);
  const [rateLog, setRateLog] = useState<VendorRate[]>([]);
  const [logPointFilter, setLogPointFilter] = useState('');
  const [showFullLog, setShowFullLog] = useState(false);
  const [rateForm, setRateForm] = useState({
    point_id: 0,
    rate_per_kg: 0,
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadPoints();
  }, []);

  useEffect(() => {
    loadVendors();
  }, [vendorType]);

  const loadPoints = async () => {
    try {
      const data = await apiClient.getAllMaterialPoints();
      setPoints(data as Point[]);
    } catch (error) {
      console.error('Failed to load points:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const data = await apiClient.getAllVendors(vendorType);
      setVendors(data as Vendor[]);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVendor?.id) {
        await apiClient.updateVendor(editingVendor.id, formData);
      } else {
        await apiClient.createVendor(formData);
      }
      closeModal();
      loadVendors();
    } catch (error: any) {
      console.error('Failed to save vendor:', error);
      notify.error(error.message || 'Failed to save vendor. Please try again.');
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({ ...emptyVendor, ...vendor });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirmDialog('Are you sure you want to delete this vendor?', { confirmLabel: 'Delete', danger: true })) {
      try {
        await apiClient.deleteVendor(id);
        loadVendors();
      } catch (error: any) {
        console.error('Failed to delete vendor:', error);
        notify.error(error.message || 'Failed to delete vendor. Please try again.');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
    setFormData({ ...emptyVendor });
  };

  const loadRates = async (vendorId: number) => {
    const [current, log] = await Promise.all([
      apiClient.getCurrentVendorRates(vendorId),
      apiClient.getVendorRates(vendorId),
    ]);
    setCurrentRates(current as VendorRate[]);
    setRateLog(log as VendorRate[]);
  };

  const handleViewRates = async (vendor: Vendor) => {
    setRateVendor(vendor);
    setLogPointFilter('');
    setShowFullLog(false);
    setRateForm({
      point_id: 0,
      rate_per_kg: 0,
      effective_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    try {
      await loadRates(vendor.id!);
      setShowRateModal(true);
    } catch (error: any) {
      console.error('Failed to load vendor rates:', error);
      notify.error(error.message || 'Failed to load vendor rates.');
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateForm.point_id) {
      notify.error('Please select a point.');
      return;
    }
    try {
      await apiClient.setVendorRate({ ...rateForm, vendor_id: rateVendor!.id });
      await loadRates(rateVendor!.id!);
      setRateForm({ ...rateForm, rate_per_kg: 0, notes: '' });
    } catch (error: any) {
      console.error('Failed to save rate:', error);
      notify.error(error.message || 'Failed to save rate. Please try again.');
    }
  };

  const handleDeleteRate = async (rate: VendorRate) => {
    if (!(await confirmDialog(`Delete the ${rate.effective_date} rate for ${rate.point_name}?`, { confirmLabel: 'Delete', danger: true }))) return;
    try {
      await apiClient.deleteVendorRate(rate.id!);
      await loadRates(rateVendor!.id!);
    } catch (error: any) {
      console.error('Failed to delete rate:', error);
      notify.error(error.message || 'Failed to delete rate. Please try again.');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const filteredLog = logPointFilter
    ? rateLog.filter((rate) => String(rate.point_id) === logPointFilter)
    : rateLog;
  // Only the newest few show until the user asks for the rest
  const visibleLog = showFullLog ? filteredLog : filteredLog.slice(0, LOG_PREVIEW_COUNT);

  // Points that actually appear in the log, with how many changes each has
  const loggedPoints = Array.from(
    rateLog.reduce((acc, rate) => {
      const existing = acc.get(rate.point_id);
      acc.set(rate.point_id, {
        id: rate.point_id,
        name: rate.point_name || '-',
        count: (existing?.count || 0) + 1,
      });
      return acc;
    }, new Map<number, { id: number; name: string; count: number }>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="vendors">
      <div className="page-header">
        <h1>Vendors</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingVendor(null);
            setFormData({ ...emptyVendor, vendor_type: vendorType });
            setShowModal(true);
          }}
        >
          + Add {typeNoun(vendorType)}
        </button>
      </div>

      <div className="vendor-type-tabs">
        {VENDOR_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            className={vendorType === type.value ? 'active' : ''}
            onClick={() => setVendorType(type.value)}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="vendors-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  {vendorType === 'material'
                    ? 'No raw material vendors yet. Add your first supplier!'
                    : `No ${vendorType} vendors yet. Add the job shops that do your ${vendorType} work.`}
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td>{vendor.name}</td>
                  <td>{vendor.company_name || '-'}</td>
                  <td>{vendor.phone || '-'}</td>
                  <td>{vendor.email || '-'}</td>
                  <td>{vendor.address || '-'}</td>
                  <td>
                    <span className={`status-badge ${vendor.status}`}>
                      {vendor.status || 'active'}
                    </span>
                  </td>
                  <td>
                    {vendor.vendor_type === 'material' && (
                      <button className="btn-rate" onClick={() => handleViewRates(vendor)}>
                        Rates
                      </button>
                    )}
                    <button className="btn-edit" onClick={() => handleEdit(vendor)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(vendor.id!)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {editingVendor ? 'Edit' : 'Add'} {typeNoun(formData.vendor_type)}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Vendor Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingVendor ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRateModal && rateVendor && (
        <div className="modal-overlay" onClick={() => { setShowRateModal(false); setRateVendor(null); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Rates - {rateVendor.name}</h2>

            <div className="rate-section">
              <h4>Current Rate by Point</h4>
              {currentRates.length === 0 ? (
                <p className="rate-empty">No rates mapped yet. Add one below.</p>
              ) : (
                <div className="current-rate-chips">
                  {currentRates.map((rate) => (
                    <div
                      className={`rate-chip${logPointFilter === String(rate.point_id) ? ' selected' : ''}`}
                      key={rate.point_id}
                      onClick={() => {
                        setShowFullLog(false);
                        setLogPointFilter(
                          logPointFilter === String(rate.point_id) ? '' : String(rate.point_id)
                        );
                      }}
                      title="Show only this point's history"
                    >
                      <span className="rate-chip-point">{rate.point_name}</span>
                      <span className="rate-chip-value">Rs {rate.rate_per_kg.toFixed(2)}/kg</span>
                      <span className="rate-chip-date">since {rate.effective_date}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="add-rate-form">
                <h4>Add / Change Rate</h4>
                {points.length === 0 ? (
                  <p className="rate-empty">
                    No points yet - add them on the Material Masters page first.
                  </p>
                ) : (
                  <form onSubmit={handleAddRate}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Point *</label>
                        <select
                          value={rateForm.point_id || ''}
                          onChange={(e) => setRateForm({ ...rateForm, point_id: parseInt(e.target.value) || 0 })}
                          required
                        >
                          <option value="">Select a point</option>
                          {points.map((point) => (
                            <option key={point.id} value={point.id}>{point.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Rate per kg (Rs) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rateForm.rate_per_kg}
                          onChange={(e) => setRateForm({ ...rateForm, rate_per_kg: parseFloat(e.target.value) || 0 })}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Effective From *</label>
                        <input
                          type="date"
                          value={rateForm.effective_date}
                          onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Notes</label>
                        <input
                          type="text"
                          value={rateForm.notes}
                          onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary">Save Rate</button>
                  </form>
                )}
              </div>

              <div className="rate-log">
                <div className="rate-log-header">
                  <h4>Price Log</h4>
                  {rateLog.length > 0 && (
                    <select
                      value={logPointFilter}
                      onChange={(e) => { setLogPointFilter(e.target.value); setShowFullLog(false); }}
                    >
                      <option value="">All points ({rateLog.length})</option>
                      {loggedPoints.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.name} ({point.count})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {filteredLog.length === 0 ? (
                  <p className="rate-empty">No rate changes recorded yet.</p>
                ) : (
                  <>
                    <div className="rate-log-scroll">
                      <table className="rate-log-table">
                        <thead>
                          <tr>
                            <th>Effective From</th>
                            <th>Point</th>
                            <th>Rate / kg</th>
                            <th>Notes</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleLog.map((rate) => (
                            <tr key={rate.id}>
                              <td>
                                {rate.effective_date}
                                {rate.effective_date > today && (
                                  <span className="rate-tag">scheduled</span>
                                )}
                              </td>
                              <td>{rate.point_name}</td>
                              <td><strong>Rs {rate.rate_per_kg.toFixed(2)}</strong></td>
                              <td>{rate.notes || '-'}</td>
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
                    {filteredLog.length > LOG_PREVIEW_COUNT && (
                      <button
                        type="button"
                        className="rate-log-toggle"
                        onClick={() => setShowFullLog(!showFullLog)}
                      >
                        {showFullLog
                          ? 'Show less'
                          : `Show all ${filteredLog.length} changes`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowRateModal(false); setRateVendor(null); }}
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
