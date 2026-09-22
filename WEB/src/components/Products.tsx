import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { formatDate } from '../utils/formatDate';
import './Products.css';
import { notify, confirmDialog } from '../utils/notify';

interface Product {
  id?: number;
  name: string;
  description?: string;
  unit_price: number;
  unit?: string;
  status?: string;
  length?: number | string | null;
  breadth?: number | string | null;
  height?: number | string | null;
  weight?: number | string | null;
  top_size?: string | null;
  bottom_size?: string | null;
  dimension_unit?: string | null;
  weight_unit?: string | null;
  point_id?: number | string | null;
  size_id?: number | string | null;
  point_name?: string | null;
  size_name?: string | null;
  min_price?: number;
  max_price?: number;
  client_price_count?: number;
}

interface PriceLogEntry {
  id: number;
  product_id: number;
  scope: 'standard' | 'client';
  client_id?: number | null;
  client_name?: string | null;
  old_price?: number | null;
  new_price?: number | null;
  action: 'created' | 'updated' | 'deleted';
  source: string;
  effective_date?: string | null;
  notes?: string | null;
  changed_at: string;
}

interface ProductRate {
  id?: number;
  product_id: number;
  rate: number;
  effective_date: string;
  notes?: string;
}

/** A material point or size, as the master-list endpoints return them. */
interface Master {
  id: number;
  name: string;
  status?: string;
}

// Units the measurements can be recorded in. `value` is what gets stored;
// `short` is what the products table appends to a number.
const DIMENSION_UNITS = [
  { value: 'inch', label: 'Inch', short: 'in' },
  { value: 'cm', label: 'Centimetre', short: 'cm' },
  { value: 'mm', label: 'Millimetre', short: 'mm' },
  { value: 'ft', label: 'Feet', short: 'ft' },
  { value: 'm', label: 'Metre', short: 'm' },
];

const WEIGHT_UNITS = [
  { value: 'g', label: 'Gram', short: 'g' },
  { value: 'kg', label: 'Kilogram', short: 'kg' },
  { value: 'gsm', label: 'GSM', short: 'gsm' },
  { value: 'mg', label: 'Milligram', short: 'mg' },
  { value: 'lb', label: 'Pound', short: 'lb' },
];

const shortUnit = (
  options: { value: string; short: string }[],
  value?: string | null,
  fallback = '',
) => options.find((o) => o.value === value)?.short ?? (value || fallback);

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rateHistory, setRateHistory] = useState<ProductRate[]>([]);
  const [priceLog, setPriceLog] = useState<PriceLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'rates' | 'log'>('rates');
  const [points, setPoints] = useState<Master[]>([]);
  const [sizes, setSizes] = useState<Master[]>([]);
  const [formData, setFormData] = useState<Product>({
    name: '',
    description: '',
    unit_price: 0,
    unit: 'piece',
    status: 'active',
    length: '',
    breadth: '',
    height: '',
    weight: '',
    top_size: '',
    bottom_size: '',
    dimension_unit: 'inch',
    weight_unit: 'g',
    point_id: '',
    size_id: '',
  });
  const [rateFormData, setRateFormData] = useState<ProductRate>({
    product_id: 0,
    rate: 0,
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Top and bottom size are free text, so their unit rides along with the other dimensions.
  const dimensionUnitLabel = shortUnit(DIMENSION_UNITS, formData.dimension_unit, 'inch');

  useEffect(() => {
    loadProducts();
    loadMasters();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await apiClient.getAllProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Points and sizes come from the raw material masters, so the product form offers
  // exactly the same list the raw material entries use.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct?.id) {
        await apiClient.updateProduct(editingProduct.id, formData);
      } else {
        await apiClient.createProduct(formData);
      }
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      loadProducts();
    } catch (error: any) {
      console.error('Failed to save product:', error);
      notify.error(error.message || 'Failed to save product. Please try again.');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    // The API sends null for measurements never filled in; controlled inputs need ''.
    setFormData({
      ...product,
      description: product.description ?? '',
      length: product.length ?? '',
      breadth: product.breadth ?? '',
      height: product.height ?? '',
      weight: product.weight ?? '',
      top_size: product.top_size ?? '',
      bottom_size: product.bottom_size ?? '',
      dimension_unit: product.dimension_unit || 'inch',
      weight_unit: product.weight_unit || 'g',
      point_id: product.point_id ?? '',
      size_id: product.size_id ?? '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirmDialog('Are you sure you want to delete this product?', { confirmLabel: 'Delete', danger: true })) {
      try {
        await apiClient.deleteProduct(id);
        loadProducts();
      } catch (error: any) {
        console.error('Failed to delete product:', error);
        notify.error(error.message || 'Failed to delete product. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      unit_price: 0,
      unit: 'piece',
      status: 'active',
      length: '',
      breadth: '',
      height: '',
      weight: '',
      top_size: '',
      bottom_size: '',
      dimension_unit: 'inch',
      weight_unit: 'g',
      point_id: '',
      size_id: '',
    });
  };

  const handleViewRates = async (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('rates');
    try {
      const [rates, log] = await Promise.all([
        apiClient.getProductRateHistory(product.id!),
        apiClient.getProductPriceLog(product.id!),
      ]);
      setRateHistory(rates);
      setPriceLog(log);
      setRateFormData({
        product_id: product.id!,
        rate: product.unit_price,
        effective_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setShowRateModal(true);
    } catch (error: any) {
      console.error('Failed to load rate history:', error);
      notify.error(error.message || 'Failed to load rate history.');
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.addProductRate(rateFormData.product_id, {
        rate: rateFormData.rate,
        effective_date: rateFormData.effective_date,
        notes: rateFormData.notes,
      });
      // Reload rate history and the log, which the new rate has just been added to
      const [rates, log] = await Promise.all([
        apiClient.getProductRateHistory(rateFormData.product_id),
        apiClient.getProductPriceLog(rateFormData.product_id),
      ]);
      setRateHistory(rates);
      setPriceLog(log);
      // Reload products to update current price
      loadProducts();
      // Reset rate form
      setRateFormData({
        product_id: rateFormData.product_id,
        rate: rateFormData.rate,
        effective_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (error: any) {
      console.error('Failed to add rate:', error);
      notify.error(error.message || 'Failed to add rate. Please try again.');
    }
  };

  const PRICE_LOG_LABELS: Record<string, string> = {
    product_created: 'Product created',
    product_edited: 'Price edited',
    rate_added: 'New rate added',
    client_price_set: 'Special price set',
    client_price_replaced: 'Special price replaced',
    client_price_edited: 'Special price edited',
    client_price_removed: 'Special price removed',
  };

  const formatLogPrice = (value?: number | null) =>
    value === null || value === undefined ? '—' : `₹${value.toFixed(2)}`;

  const formatChangedAt = (iso: string) => {
    const d = new Date(iso);
    return `${formatDate(d)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatMeasure = (value?: number | string | null) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : String(value);
  };

  // Physical spec summary for the table: only the measurements actually recorded.
  const renderSpecs = (product: Product) => {
    const length = formatMeasure(product.length);
    const breadth = formatMeasure(product.breadth);
    const height = formatMeasure(product.height);
    const weight = formatMeasure(product.weight);

    const dimUnit = shortUnit(DIMENSION_UNITS, product.dimension_unit);
    const wtUnit = shortUnit(WEIGHT_UNITS, product.weight_unit);
    const withDim = (text: string) => (dimUnit ? `${text} ${dimUnit}` : text);

    // The point and size the product is made from lead the cell, styled apart
    // from the measurements that follow.
    const material: string[] = [];
    if (product.point_name) material.push(product.point_name);
    if (product.size_name) material.push(product.size_name);

    const parts: string[] = [];
    if (length && breadth) parts.push(withDim(`${length} × ${breadth}`));
    else if (length) parts.push(withDim(`L ${length}`));
    else if (breadth) parts.push(withDim(`B ${breadth}`));
    if (height) parts.push(withDim(`H ${height}`));
    if (weight) parts.push(wtUnit ? `${weight} ${wtUnit}` : `${weight} wt`);
    if (product.top_size) parts.push(withDim(`Top ${product.top_size}`));
    if (product.bottom_size) parts.push(withDim(`Bottom ${product.bottom_size}`));

    if (parts.length === 0 && material.length === 0) {
      return <span className="specs-empty">-</span>;
    }

    return (
      <div className="product-specs">
        {material.map((part) => (
          <span key={`m-${part}`} className="spec-chip material">{part}</span>
        ))}
        {parts.map((part) => (
          <span key={part} className="spec-chip">{part}</span>
        ))}
      </div>
    );
  };

  // Lowest and highest this product currently sells at: its standard rate together
  // with every client-specific price. Falls back to the standard rate on its own.
  const renderPriceRange = (product: Product) => {
    const standard = parseFloat(product.unit_price.toString());
    const min = product.min_price ?? standard;
    const max = product.max_price ?? standard;
    const specialCount = product.client_price_count ?? 0;

    if (specialCount === 0) {
      return (
        <div className="price-range">
          <span className="price-range-value standard-only">₹{standard.toFixed(2)}</span>
          <span className="price-range-note">standard only</span>
        </div>
      );
    }

    return (
      <div className="price-range">
        <span className="price-range-value">
          {min === max ? `₹${min.toFixed(2)}` : `₹${min.toFixed(2)} – ₹${max.toFixed(2)}`}
        </span>
        <span className="price-range-note">
          {specialCount} special {specialCount === 1 ? 'price' : 'prices'}
        </span>
      </div>
    );
  };

  return (
    <div className="products">
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditingProduct(null); resetForm(); }}>
          + Add Product
        </button>
      </div>

      <div className="table-container">
        <table className="products-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Unit Price</th>
              <th>Price Range</th>
              <th>Unit</th>
              <th>Specifications</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  No products found. Add your first product!
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.description || '-'}</td>
                  <td>₹{parseFloat(product.unit_price.toString()).toFixed(2)}</td>
                  <td>{renderPriceRange(product)}</td>
                  <td>{product.unit || 'piece'}</td>
                  <td>{renderSpecs(product)}</td>
                  <td>
                    <span className={`status-badge ${product.status}`}>
                      {product.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-rate" onClick={() => handleViewRates(product)}>
                      Rates
                    </button>
                    <button className="btn-edit" onClick={() => handleEdit(product)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(product.id!)}>
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
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingProduct(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Unit Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Unit *</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogram</option>
                    <option value="set">Set</option>
                    <option value="dozen">Dozen</option>
                    <option value="box">Box</option>
                  </select>
                </div>
              </div>
              <div className="form-section">
                <h3 className="form-section-title">Specifications</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Material Point</label>
                    <select
                      value={formData.point_id ?? ''}
                      onChange={(e) => setFormData({ ...formData, point_id: e.target.value })}
                    >
                      <option value="">Not set</option>
                      {points.map((point) => (
                        <option key={point.id} value={point.id}>{point.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Material Size</label>
                    <select
                      value={formData.size_id ?? ''}
                      onChange={(e) => setFormData({ ...formData, size_id: e.target.value })}
                    >
                      <option value="">Not set</option>
                      {sizes.map((size) => (
                        <option key={size.id} value={size.id}>{size.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label>Length</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 12"
                      value={formData.length ?? ''}
                      onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Breadth</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 8"
                      value={formData.breadth ?? ''}
                      onChange={(e) => setFormData({ ...formData, breadth: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Height</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 4"
                      value={formData.height ?? ''}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label>Measured In</label>
                    <select
                      value={formData.dimension_unit ?? 'inch'}
                      onChange={(e) => setFormData({ ...formData, dimension_unit: e.target.value })}
                    >
                      {DIMENSION_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Weight</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 250"
                      value={formData.weight ?? ''}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Weight Unit</label>
                    <select
                      value={formData.weight_unit ?? 'g'}
                      onChange={(e) => setFormData({ ...formData, weight_unit: e.target.value })}
                    >
                      {WEIGHT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Top Size ({dimensionUnitLabel})</label>
                    <input
                      type="text"
                      placeholder="e.g. 12 or 12x8"
                      value={formData.top_size ?? ''}
                      onChange={(e) => setFormData({ ...formData, top_size: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Bottom Size ({dimensionUnitLabel})</label>
                    <input
                      type="text"
                      placeholder="e.g. 10 or 10x6"
                      value={formData.bottom_size ?? ''}
                      onChange={(e) => setFormData({ ...formData, bottom_size: e.target.value })}
                    />
                  </div>
                </div>
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
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingProduct(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRateModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => { setShowRateModal(false); setSelectedProduct(null); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Pricing - {selectedProduct.name}</h2>
            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab ${activeTab === 'rates' ? 'active' : ''}`}
                onClick={() => setActiveTab('rates')}
              >
                Rate History
              </button>
              <button
                type="button"
                className={`modal-tab ${activeTab === 'log' ? 'active' : ''}`}
                onClick={() => setActiveTab('log')}
              >
                Price Log ({priceLog.length})
              </button>
            </div>

            {activeTab === 'log' && (
              <div className="price-log-section">
                <p className="price-log-hint">
                  Every change to this product's price, including special prices for
                  individual customers. Entries are never edited or removed.
                </p>
                {priceLog.length === 0 ? (
                  <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
                    No price changes recorded yet. Changes from here on will be logged.
                  </p>
                ) : (
                  <table className="price-log-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Applies To</th>
                        <th>Change</th>
                        <th>What Happened</th>
                        <th>Effective</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceLog.map((entry) => (
                        <tr key={entry.id}>
                          <td className="log-when">{formatChangedAt(entry.changed_at)}</td>
                          <td>
                            {entry.scope === 'standard' ? (
                              <span className="scope-badge standard">Standard</span>
                            ) : (
                              <span className="scope-badge client">
                                {entry.client_name || 'Deleted client'}
                              </span>
                            )}
                          </td>
                          <td className="log-change">
                            <span className="old-price">{formatLogPrice(entry.old_price)}</span>
                            <span className="arrow">→</span>
                            <span className={`new-price ${entry.action}`}>
                              {entry.action === 'deleted' ? 'removed' : formatLogPrice(entry.new_price)}
                            </span>
                          </td>
                          <td>{PRICE_LOG_LABELS[entry.source] || entry.source}</td>
                          <td>{entry.effective_date || '-'}</td>
                          <td>{entry.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'rates' && (
            <div className="rate-history-section">
              <h3>Current Rate: ₹{selectedProduct.unit_price.toFixed(2)}</h3>
              
              <div className="add-rate-form">
                <h4>Add New Rate</h4>
                <form onSubmit={handleAddRate}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Rate (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rateFormData.rate}
                        onChange={(e) => setRateFormData({ ...rateFormData, rate: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Effective Date *</label>
                      <input
                        type="date"
                        value={rateFormData.effective_date}
                        onChange={(e) => setRateFormData({ ...rateFormData, effective_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={rateFormData.notes}
                      onChange={(e) => setRateFormData({ ...rateFormData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    Add Rate
                  </button>
                </form>
              </div>

              <div className="rate-history-list">
                <h4>Rate History</h4>
                {rateHistory.length === 0 ? (
                  <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
                    No rate history found. Add your first rate above.
                  </p>
                ) : (
                  <table className="rate-history-table">
                    <thead>
                      <tr>
                        <th>Effective Date</th>
                        <th>Rate (₹)</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateHistory.map((rate) => (
                        <tr key={rate.id}>
                          <td>{rate.effective_date}</td>
                          <td><strong>₹{rate.rate.toFixed(2)}</strong></td>
                          <td>{rate.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowRateModal(false); setSelectedProduct(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

