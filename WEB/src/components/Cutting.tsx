import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import './Cutting.css';

interface Product {
  id?: number;
  name: string;
  unit?: string;
  status?: string;
  point_id?: number | null;
  size_id?: number | null;
  point_name?: string | null;
  size_name?: string | null;
}

/** A raw material lot that can still be cut. */
interface Material {
  id: number;
  entry_number: string;
  vendor_id: number;
  vendor_name?: string;
  received_date: string;
  point_id: number;
  point_name?: string;
  size_id: number;
  size_name?: string;
  weight: number;
  rate_per_kg: number;
  total_cost: number;
  status: string;
}

interface InputLine {
  raw_material_id: number;
  weight_used?: number;
  cost_used?: number;
  point_name?: string;
  size_name?: string;
  rate_per_kg?: number;
  vendor_name?: string;
  entry_number?: string;
  received_date?: string;
}

interface OutputLine {
  product_id: number;
  product_name?: string;
  unit?: string;
  quantity: number;
  notes?: string;
}

interface Cutting {
  id?: number;
  cutting_number?: string;
  cutting_date: string;
  notes?: string;
  total_input_weight?: number;
  total_input_cost?: number;
  total_output_count?: number;
  cost_per_piece?: number;
  input_count?: number;
  output_line_count?: number;
  inputs: InputLine[];
  outputs: OutputLine[];
}

interface Summary {
  total_cuttings: number;
  total_input_weight: number;
  total_input_cost: number;
  total_output_count: number;
  avg_cost_per_piece: number;
  available_lots: number;
  available_weight: number;
  total_ordered_count: number;
  in_stock_count: number;
}

interface ProductStock {
  product_id: number;
  product_name: string;
  unit?: string;
  produced: number;
  ordered: number;
  in_stock: number;
}

/** An output row being edited. `key` keeps React stable across add/remove. */
interface OutputRow {
  key: number;
  product_id: number;
  quantity: number;
  notes: string;
}

let rowKeySeed = 0;
const newOutputRow = (): OutputRow => ({
  key: ++rowKeySeed,
  product_id: 0,
  quantity: 0,
  notes: '',
});

const today = () => new Date().toISOString().split('T')[0];

const emptyHeader = () => ({ cutting_date: today(), notes: '' });

const productLabel = (product: Product) => {
  const spec = [product.point_name, product.size_name].filter(Boolean).join(' / ');
  return spec ? `${product.name} (${spec})` : product.name;
};

export default function Cutting() {
  const [cuttings, setCuttings] = useState<Cutting[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [productStock, setProductStock] = useState<ProductStock[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expanded, setExpanded] = useState<number[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cutting | null>(null);
  const [header, setHeader] = useState(emptyHeader());
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [outputRows, setOutputRows] = useState<OutputRow[]>([newOutputRow()]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [pointFilter, setPointFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadCuttings();
  }, [fromDate, toDate]);

  const loadCuttings = async () => {
    try {
      const data = await apiClient.getAllCuttings(fromDate || undefined, toDate || undefined);
      setCuttings(data as Cutting[]);
      setSummary((await apiClient.getCuttingSummary()) as Summary);
      setProductStock((await apiClient.getCuttingProductStock()) as ProductStock[]);
    } catch (error) {
      console.error('Failed to load cuttings:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setProducts((await apiClient.getAllProducts()) as Product[]);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadMaterials = async (forCuttingId?: number) => {
    try {
      const data = await apiClient.getAvailableCuttingMaterials(forCuttingId);
      setMaterials(data as Material[]);
    } catch (error) {
      console.error('Failed to load available raw materials:', error);
      setMaterials([]);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const openAdd = async () => {
    setEditing(null);
    setHeader(emptyHeader());
    setSelectedIds([]);
    setOutputRows([newOutputRow()]);
    resetMaterialFilters();
    setShowModal(true);
    await loadMaterials();
  };

  const openEdit = async (cutting: Cutting) => {
    setEditing(cutting);
    setHeader({ cutting_date: cutting.cutting_date, notes: cutting.notes || '' });
    setSelectedIds(cutting.inputs.map(input => input.raw_material_id));
    setOutputRows(
      cutting.outputs.length === 0
        ? [newOutputRow()]
        : cutting.outputs.map(output => ({
            key: ++rowKeySeed,
            product_id: output.product_id,
            quantity: output.quantity,
            notes: output.notes || '',
          }))
    );
    resetMaterialFilters();
    setShowModal(true);
    // The cutting's own lots are consumed, so ask for them by name as well
    await loadMaterials(cutting.id);
  };

  const resetMaterialFilters = () => {
    setMaterialSearch('');
    setPointFilter('');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setHeader(emptyHeader());
    setMaterials([]);
    setSelectedIds([]);
    setOutputRows([newOutputRow()]);
    resetMaterialFilters();
  };

  const selectedMaterials = useMemo(
    () => materials.filter(material => selectedIds.includes(material.id)),
    [materials, selectedIds]
  );

  /**
   * One cutting works a single point/size, so the first line ticked fixes the
   * spec for the rest. Clearing the selection unlocks it again.
   */
  const lockedSpec = selectedMaterials.length > 0 ? selectedMaterials[0] : null;

  const matchesSpec = (material: Material) =>
    !lockedSpec ||
    (material.point_id === lockedSpec.point_id && material.size_id === lockedSpec.size_id);

  const specLabel = lockedSpec
    ? `${lockedSpec.point_name || '-'} / ${lockedSpec.size_name || '-'}`
    : '';

  const toggleMaterial = (id: number) => {
    const material = materials.find(m => m.id === id);
    if (!material) return;
    // Untick always works; ticking is refused unless the line fits the spec
    if (!selectedIds.includes(id) && !matchesSpec(material)) return;
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const points = useMemo(() => {
    const seen = new Map<number, string>();
    materials.forEach(material => {
      if (!seen.has(material.point_id)) seen.set(material.point_id, material.point_name || '-');
    });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [materials]);

  const visibleMaterials = useMemo(() => {
    const term = materialSearch.trim().toLowerCase();
    return materials.filter(material => {
      if (pointFilter && material.point_id !== parseInt(pointFilter)) return false;
      if (!term) return true;
      return [
        material.entry_number,
        material.point_name,
        material.size_name,
        material.vendor_name,
        material.received_date,
      ]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(term));
    });
  }, [materials, materialSearch, pointFilter]);

  /** Bulk actions only ever reach the lines the spec allows. */
  const selectableVisible = visibleMaterials.filter(matchesSpec);

  /** Every line it could tick is ticked, so the header box acts as "clear these". */
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every(m => selectedIds.includes(m.id));

  const toggleAllVisible = () => {
    const visibleIds = selectableVisible.map(m => m.id);
    setSelectedIds(prev =>
      allVisibleSelected
        ? prev.filter(id => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds]))
    );
  };

  /**
   * Products made from the point/size this cutting is running.
   * Products with no point/size stay listed — they are not tied to one lot.
   */
  const suggestedProducts = useMemo(() => {
    if (!lockedSpec) return products;
    return products.filter(product => {
      if (!product.point_id && !product.size_id) return true;
      const pointOk = !product.point_id || product.point_id === lockedSpec.point_id;
      const sizeOk = !product.size_id || product.size_id === lockedSpec.size_id;
      return pointOk && sizeOk;
    });
  }, [products, lockedSpec]);

  const updateOutputRow = (key: number, changes: Partial<OutputRow>) => {
    setOutputRows(prev => prev.map(row => (row.key === key ? { ...row, ...changes } : row)));
  };

  const addOutputRow = () => setOutputRows(prev => [...prev, newOutputRow()]);

  const removeOutputRow = (key: number) =>
    setOutputRows(prev => (prev.length === 1 ? prev : prev.filter(row => row.key !== key)));

  const inputWeight = selectedMaterials.reduce((sum, m) => sum + Number(m.weight || 0), 0);
  const inputCost = selectedMaterials.reduce((sum, m) => sum + Number(m.total_cost || 0), 0);
  const outputCount = outputRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const costPerPiece = outputCount > 0 ? inputCost / outputCount : 0;
  const kgPerPiece = outputCount > 0 ? inputWeight / outputCount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIds.length === 0) {
      alert('Select at least one raw material line to cut.');
      return;
    }
    if (selectedMaterials.some(material => !matchesSpec(material))) {
      alert('Every line in one cutting must share the same point and size.');
      return;
    }

    const outputs = outputRows.filter(row => row.product_id > 0 && row.quantity > 0);
    if (outputs.length === 0) {
      alert('Add at least one finished product with a count above zero.');
      return;
    }
    const productIds = outputs.map(row => row.product_id);
    if (new Set(productIds).size !== productIds.length) {
      alert('The same product is listed twice. Combine the counts into a single line.');
      return;
    }

    const payload = {
      ...header,
      inputs: selectedIds.map(id => ({ raw_material_id: id })),
      outputs: outputs.map(row => ({
        product_id: row.product_id,
        quantity: row.quantity,
        notes: row.notes || undefined,
      })),
    };

    setSaving(true);
    try {
      if (editing?.id) {
        await apiClient.updateCutting(editing.id, payload);
      } else {
        await apiClient.createCutting(payload);
      }
      closeModal();
      loadCuttings();
    } catch (error: any) {
      console.error('Failed to save cutting:', error);
      alert(error.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cutting: Cutting) => {
    const message =
      `Delete ${cutting.cutting_number}?\n\n` +
      `Its ${cutting.input_count} raw material ${cutting.input_count === 1 ? 'line goes' : 'lines go'} back to In Stock.`;
    if (!confirm(message)) return;
    try {
      await apiClient.deleteCutting(cutting.id!);
      loadCuttings();
    } catch (error: any) {
      console.error('Failed to delete cutting:', error);
      alert(error.message || 'Failed to delete cutting.');
    }
  };

  return (
    <div className="cutting">
      <div className="page-header">
        <h1>Cutting</h1>
        <button className="btn-primary" onClick={openAdd}>
          + New Cutting
        </button>
      </div>

      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Cuttings</span>
            <span className="summary-value">{summary.total_cuttings}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Material Cut</span>
            <span className="summary-value">{summary.total_input_weight.toFixed(3)} kg</span>
            <span className="summary-sub">₹{summary.total_input_cost.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Pieces Produced</span>
            <span className="summary-value">{summary.total_output_count.toFixed(0)}</span>
            {summary.total_ordered_count > 0 && (
              <span className="summary-sub">
                −{summary.total_ordered_count.toFixed(0)} ordered
              </span>
            )}
          </div>
          <div className="summary-card">
            <span className="summary-label">Avg Cost / Piece</span>
            <span className="summary-value">₹{summary.avg_cost_per_piece.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Pieces In Stock</span>
            <span className="summary-value">{summary.in_stock_count.toFixed(0)}</span>
          </div>
          <div className="summary-card available">
            <span className="summary-label">Available to Cut</span>
            <span className="summary-value">{summary.available_lots} lines</span>
            <span className="summary-sub">{summary.available_weight.toFixed(3)} kg in hand</span>
          </div>
        </div>
      )}

      {productStock.length > 0 && (
        <div className="table-container product-stock">
          <h3 className="section-title">Product Stock</h3>
          <table className="cutting-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Produced</th>
                <th>Ordered</th>
                <th>In Stock</th>
              </tr>
            </thead>
            <tbody>
              {productStock.map(row => (
                <tr key={row.product_id}>
                  <td>{row.product_name}</td>
                  <td>
                    {row.produced.toFixed(0)} {row.unit || ''}
                  </td>
                  <td>
                    {row.ordered.toFixed(0)} {row.unit || ''}
                  </td>
                  <td>
                    <strong className={row.in_stock < 0 ? 'stock-negative' : ''}>
                      {row.in_stock.toFixed(0)}
                    </strong>{' '}
                    {row.unit || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        {(fromDate || toDate) && (
          <div className="filter-group filter-clear">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
            >
              Clear Dates
            </button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="cutting-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Cutting</th>
              <th>Date</th>
              <th>Material Lines</th>
              <th>Input Weight</th>
              <th>Input Cost</th>
              <th>Pieces Out</th>
              <th>Cost / Piece</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cuttings.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  No cuttings recorded yet.
                </td>
              </tr>
            ) : (
              cuttings.map(cutting => {
                const isOpen = expanded.includes(cutting.id!);
                return [
                  <tr
                    key={`cutting-${cutting.id}`}
                    className={`entry-row${isOpen ? ' open' : ''}`}
                    onClick={() => toggleExpanded(cutting.id!)}
                  >
                    <td>
                      <span className={`expander${isOpen ? ' open' : ''}`}>▸</span>
                    </td>
                    <td>
                      <strong>{cutting.cutting_number}</strong>
                    </td>
                    <td>{cutting.cutting_date}</td>
                    <td>{cutting.input_count}</td>
                    <td>{Number(cutting.total_input_weight || 0).toFixed(3)} kg</td>
                    <td>₹{Number(cutting.total_input_cost || 0).toFixed(2)}</td>
                    <td>
                      <strong>{Number(cutting.total_output_count || 0).toFixed(0)}</strong>
                    </td>
                    <td>
                      {cutting.cost_per_piece !== undefined
                        ? `₹${cutting.cost_per_piece.toFixed(2)}`
                        : '-'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn-edit" onClick={() => openEdit(cutting)}>
                        Edit
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(cutting)}>
                        Delete
                      </button>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`detail-${cutting.id}`} className="lines-row">
                      <td colSpan={9}>
                        <div className="lines-wrap">
                          <div className="detail-columns">
                            <div className="detail-block">
                              <h4>Raw Material Used</h4>
                              <table className="lines-table">
                                <thead>
                                  <tr>
                                    <th>Entry</th>
                                    <th>Point</th>
                                    <th>Size</th>
                                    <th>Vendor</th>
                                    <th>Weight</th>
                                    <th>Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cutting.inputs.map(input => (
                                    <tr key={input.raw_material_id}>
                                      <td>{input.entry_number || '-'}</td>
                                      <td>{input.point_name || '-'}</td>
                                      <td>{input.size_name || '-'}</td>
                                      <td>{input.vendor_name || '-'}</td>
                                      <td>{Number(input.weight_used || 0).toFixed(3)} kg</td>
                                      <td>₹{Number(input.cost_used || 0).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="detail-block">
                              <h4>Products Produced</h4>
                              <table className="lines-table">
                                <thead>
                                  <tr>
                                    <th>Product</th>
                                    <th>Count</th>
                                    <th>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cutting.outputs.map(output => (
                                    <tr key={output.product_id}>
                                      <td>{output.product_name || '-'}</td>
                                      <td>
                                        <strong>{Number(output.quantity).toFixed(0)}</strong>{' '}
                                        {output.unit || ''}
                                      </td>
                                      <td>{output.notes || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          {cutting.notes && <p className="lines-note">Note: {cutting.notes}</p>}
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
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <h2>{editing ? `Edit ${editing.cutting_number}` : 'New Cutting'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Cutting Date *</label>
                  <input
                    type="date"
                    value={header.cutting_date}
                    onChange={e => setHeader({ ...header, cutting_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text"
                    value={header.notes}
                    onChange={e => setHeader({ ...header, notes: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="picker-section">
                <div className="items-header">
                  <h4>Raw Material in Stock</h4>
                  <span className="items-hint">
                    {lockedSpec
                      ? `Cutting ${specLabel} — only lines of that point and size can be added.`
                      : 'Tick the lines that went into this cutting. The first one fixes the point and size.'}
                  </span>
                </div>

                <div className="picker-filters">
                  <input
                    type="text"
                    className="picker-search"
                    placeholder="Search entry, point, size or vendor"
                    value={materialSearch}
                    onChange={e => setMaterialSearch(e.target.value)}
                  />
                  <select value={pointFilter} onChange={e => setPointFilter(e.target.value)}>
                    <option value="">All Points</option>
                    {points.map(point => (
                      <option key={point.id} value={point.id}>
                        {point.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-add-row"
                    onClick={toggleAllVisible}
                    disabled={selectableVisible.length === 0}
                  >
                    {allVisibleSelected ? 'Clear Shown' : 'Select Shown'}
                  </button>
                </div>

                <div className="picker-table-wrap">
                  {materials.length === 0 ? (
                    <p className="picker-empty">
                      No raw material is available to cut. Add a delivery on the Raw Materials page
                      first.
                    </p>
                  ) : visibleMaterials.length === 0 ? (
                    <p className="picker-empty">No lines match this search.</p>
                  ) : (
                    <table className="picker-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleAllVisible}
                              disabled={selectableVisible.length === 0}
                              title="Select every line shown that fits the cutting"
                            />
                          </th>
                          <th>Entry</th>
                          <th>Point</th>
                          <th>Size</th>
                          <th>Vendor</th>
                          <th>Received</th>
                          <th>Weight</th>
                          <th>Rate</th>
                          <th>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMaterials.map(material => {
                          const checked = selectedIds.includes(material.id);
                          // A line of another point/size cannot join this cutting
                          const blocked = !checked && !matchesSpec(material);
                          return (
                            <tr
                              key={material.id}
                              className={`${checked ? 'picked' : ''}${blocked ? ' blocked' : ''}`}
                              title={
                                blocked
                                  ? `This cutting is running ${specLabel}. Clear the selection to cut a different point or size.`
                                  : undefined
                              }
                              onClick={() => toggleMaterial(material.id)}
                            >
                              <td onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={blocked}
                                  onChange={() => toggleMaterial(material.id)}
                                />
                              </td>
                              <td>{material.entry_number}</td>
                              <td>{material.point_name || '-'}</td>
                              <td>{material.size_name || '-'}</td>
                              <td>{material.vendor_name || '-'}</td>
                              <td>{material.received_date}</td>
                              <td>{Number(material.weight).toFixed(3)} kg</td>
                              <td>₹{Number(material.rate_per_kg).toFixed(2)}</td>
                              <td>₹{Number(material.total_cost).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="picked-bar">
                  <span>
                    <strong>{selectedIds.length}</strong>{' '}
                    {selectedIds.length === 1 ? 'line' : 'lines'} selected
                    {lockedSpec && <span className="spec-chip">{specLabel}</span>}
                  </span>
                  <span>{inputWeight.toFixed(3)} kg</span>
                  <span>
                    Material Cost: <strong>₹{inputCost.toFixed(2)}</strong>
                  </span>
                  {lockedSpec && (
                    <button type="button" className="btn-clear-spec" onClick={clearSelection}>
                      Clear &amp; change point/size
                    </button>
                  )}
                </div>
              </div>

              <div className="items-section">
                <div className="items-header">
                  <h4>Finished Products</h4>
                  {lockedSpec && <span className="matching-check">Showing {specLabel} products</span>}
                </div>

                <div className="items-grid">
                  <div className="items-grid-head">
                    <span>Product *</span>
                    <span>Count *</span>
                    <span>Notes</span>
                    <span />
                  </div>

                  {outputRows.map(row => (
                    <div className="item-line" key={row.key}>
                      <div className="item-field">
                        <label>Product *</label>
                        <select
                          value={row.product_id || ''}
                          onChange={e =>
                            updateOutputRow(row.key, { product_id: parseInt(e.target.value) || 0 })
                          }
                          required
                        >
                          <option value="">Select a product</option>
                          {suggestedProducts.map(product => (
                            <option key={product.id} value={product.id}>
                              {productLabel(product)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="item-field">
                        <label>Count *</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={row.quantity || ''}
                          placeholder="0"
                          onChange={e =>
                            updateOutputRow(row.key, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          required
                        />
                      </div>

                      <div className="item-field">
                        <label>Notes</label>
                        <input
                          type="text"
                          value={row.notes}
                          placeholder="Optional"
                          onChange={e => updateOutputRow(row.key, { notes: e.target.value })}
                        />
                      </div>

                      <div className="item-field item-remove">
                        <button
                          type="button"
                          className="btn-row-remove"
                          onClick={() => removeOutputRow(row.key)}
                          disabled={outputRows.length === 1}
                          title={
                            outputRows.length === 1
                              ? 'At least one product is needed'
                              : 'Remove this product'
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" className="btn-add-row" onClick={addOutputRow}>
                  + Add Product
                </button>
              </div>

              <div className="total-preview">
                <span>
                  In: {selectedIds.length} {selectedIds.length === 1 ? 'line' : 'lines'} ·{' '}
                  {inputWeight.toFixed(3)} kg · ₹{inputCost.toFixed(2)}
                </span>
                <span>
                  Out: <strong>{outputCount.toFixed(0)}</strong> pieces
                </span>
                {outputCount > 0 && (
                  <span>
                    Cost / piece: <strong>₹{costPerPiece.toFixed(2)}</strong> ·{' '}
                    {kgPerPiece.toFixed(3)} kg / piece
                  </span>
                )}
              </div>

              {products.length === 0 && (
                <p className="form-hint">
                  No products yet — add them on the Products page first.
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Cutting' : 'Record Cutting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
