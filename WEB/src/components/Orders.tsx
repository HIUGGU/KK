import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './Orders.css';

interface OrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id?: number;
  order_number?: string; // Optional - auto-generated if not provided
  client_id: number;
  order_date: string;
  delivery_date: string; // Required - orders are only created on delivery
  status?: string;
  notes?: string;
  total_amount?: number;
  items?: OrderItem[];
}

interface Product {
  id: number;
  name: string;
  unit_price: number;
  unit: string;
}

interface Client {
  id: number;
  name: string;
}

interface Filters {
  from_date: string;
  to_date: string;
  product_id: string;
  status: string;
}

// An order is only entered once the goods are delivered, so its status tracks payment.
// Settlements are what close an order to "paid" - see the Settlements page.
const PAYMENT_STATUSES = [
  { value: 'not_paid', label: 'Not Paid' },
  { value: 'paid', label: 'Paid' },
];

const statusLabel = (status?: string) =>
  PAYMENT_STATUSES.find(s => s.value === status)?.label || 'Not Paid';

const EMPTY_FILTERS: Filters = { from_date: '', to_date: '', product_id: '', status: '' };

// toISOString() reports UTC, which is the previous day here for part of the
// evening, so build the yyyy-mm-dd the browser expects from the local date.
const toDateInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const today = () => toDateInput(new Date());

// The Saturday before today. On a Saturday this steps back a full week rather
// than returning today, so the range always covers the whole week just worked.
const lastSaturday = () => {
  const date = new Date();
  date.setDate(date.getDate() - (((date.getDay() + 1) % 7) || 7));
  return toDateInput(date);
};

// The list opens on this week's unpaid deliveries, which is what gets chased up.
const defaultFilters = (): Filters => ({
  from_date: lastSaturday(),
  to_date: today(),
  product_id: '',
  status: 'not_paid',
});

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<Order>({
    order_number: '',
    client_id: 0,
    order_date: today(),
    delivery_date: today(), // Required - default to today
    status: 'not_paid',
    notes: '',
    items: [],
  });
  const [orderNumberError, setOrderNumberError] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  useEffect(() => {
    loadProducts();
    loadClients();
  }, []);

  // Filtering runs on the server, so re-fetch whenever a filter changes.
  useEffect(() => {
    loadOrders();
  }, [filters]);

  const loadOrders = async () => {
    try {
      const data = await apiClient.getAllOrders(filters);
      setOrders(data);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiClient.getAllProducts();
      setProducts(data.filter((p: any) => p.status === 'active'));
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadClients = async () => {
    try {
      const data = await apiClient.getAllClients();
      setClients(data.filter((c: any) => c.status === 'active'));
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderNumberError('');
    setFormError('');

    if (!formData.client_id || !formData.delivery_date || formData.items?.length === 0) {
      setFormError('Please fill all required fields and add at least one product.');
      return;
    }

    try {
      if (editingOrder?.id) {
        await apiClient.updateOrder(editingOrder.id, formData);
      } else {
        await apiClient.createOrder(formData);
      }
      setShowModal(false);
      setEditingOrder(null);
      resetForm();
      loadOrders();
    } catch (error: any) {
      console.error('Failed to save order:', error);
      const errorMessage = error.message || 'Failed to save order. Please try again.';
      if (errorMessage.includes('already exists')) {
        setOrderNumberError(errorMessage);
      } else {
        setFormError(errorMessage);
      }
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData(order);
    setOrderNumberError('');
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this order?')) {
      try {
        await apiClient.deleteOrder(id);
        loadOrders();
      } catch (error: any) {
        console.error('Failed to delete order:', error);
        alert(error.message || 'Failed to delete order. Please try again.');
      }
    }
  };

  const addOrderItem = () => {
    const newItems = [...(formData.items || []), { product_id: 0, quantity: 1, unit_price: 0, total_price: 0 }];
    setFormData({ ...formData, items: newItems });
  };

  const updateOrderItem = async (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    const item = newItems[index];
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product && formData.client_id > 0) {
        item.product_id = value;
        // Try to get client-specific price first
        try {
          const clientPrice = await apiClient.getEffectiveClientPrice(
            formData.client_id,
            value,
            formData.delivery_date
          );
          if (clientPrice.price !== null) {
            item.unit_price = clientPrice.price;
          } else {
            // Fallback to product's effective rate
            const effectiveRate = await apiClient.getEffectiveRate(value, formData.delivery_date);
            item.unit_price = effectiveRate.rate;
          }
        } catch (error) {
          // Fallback to product's current price
          item.unit_price = product.unit_price;
        }
        item.total_price = item.quantity * item.unit_price;
      }
    } else if (field === 'quantity') {
      item.quantity = parseFloat(value) || 0;
      item.total_price = item.quantity * item.unit_price;
    } else if ((field === 'delivery_date' || field === 'client_id') && item.product_id > 0) {
      // When delivery date or client changes, update the price for existing items
      try {
        if (formData.client_id > 0) {
          const clientPrice = await apiClient.getEffectiveClientPrice(
            formData.client_id,
            item.product_id,
            formData.delivery_date
          );
          if (clientPrice.price !== null) {
            item.unit_price = clientPrice.price;
          } else {
            const effectiveRate = await apiClient.getEffectiveRate(item.product_id, formData.delivery_date);
            item.unit_price = effectiveRate.rate;
          }
        } else {
          const effectiveRate = await apiClient.getEffectiveRate(item.product_id, formData.delivery_date);
          item.unit_price = effectiveRate.rate;
        }
        item.total_price = item.quantity * item.unit_price;
      } catch (error) {
        // Keep current price if rate fetch fails
      }
    }
    
    newItems[index] = item;
    const totalAmount = newItems.reduce((sum, i) => sum + i.total_price, 0);
    setFormData({ ...formData, items: newItems, total_amount: totalAmount });
  };

  const removeOrderItem = (index: number) => {
    const newItems = formData.items?.filter((_, i) => i !== index) || [];
    const totalAmount = newItems.reduce((sum, i) => sum + i.total_price, 0);
    setFormData({ ...formData, items: newItems, total_amount: totalAmount });
  };

  const resetForm = () => {
    setFormData({
      order_number: '',
      client_id: 0,
      order_date: today(),
      delivery_date: today(),
      status: 'not_paid',
      notes: '',
      items: [],
    });
    setOrderNumberError('');
    setFormError('');
  };

  const handleClientChange = async (clientId: number) => {
    setFormData({ ...formData, client_id: clientId, order_number: '' }); // Clear order number to auto-generate
    setOrderNumberError('');
    
    // Update prices for existing items if client changes
    if (formData.items && formData.items.length > 0) {
      const updatedItems = await Promise.all(
        formData.items.map(async (item) => {
          if (item.product_id > 0) {
            try {
              const clientPrice = await apiClient.getEffectiveClientPrice(
                clientId,
                item.product_id,
                formData.delivery_date
              );
              if (clientPrice.price !== null) {
                return {
                  ...item,
                  unit_price: clientPrice.price,
                  total_price: item.quantity * clientPrice.price,
                };
              } else {
                const effectiveRate = await apiClient.getEffectiveRate(item.product_id, formData.delivery_date);
                return {
                  ...item,
                  unit_price: effectiveRate.rate,
                  total_price: item.quantity * effectiveRate.rate,
                };
              }
            } catch (error) {
              return item;
            }
          }
          return item;
        })
      );
      const totalAmount = updatedItems.reduce((sum, i) => sum + i.total_price, 0);
      setFormData(prev => ({ ...prev, client_id: clientId, items: updatedItems, total_amount: totalAmount }));
    }
  };

  const getClientName = (clientId: number) => {
    return clients.find(c => c.id === clientId)?.name || 'Unknown';
  };

  const getProductName = (productId: number) => {
    return products.find(p => p.id === productId)?.name || 'Unknown';
  };

  const describeItems = (items?: OrderItem[]) => {
    if (!items || items.length === 0) return '-';
    return items.map(i => `${getProductName(i.product_id)} x ${i.quantity}`).join(', ');
  };

  const updateFilter = (field: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="orders">
      <div className="page-header">
        <h1>Orders</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditingOrder(null); resetForm(); }}>
          + Add Order
        </button>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>Delivery From</label>
          <input
            type="date"
            value={filters.from_date}
            onChange={(e) => updateFilter('from_date', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Delivery To</label>
          <input
            type="date"
            value={filters.to_date}
            onChange={(e) => updateFilter('to_date', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Item</label>
          <select
            value={filters.product_id}
            onChange={(e) => updateFilter('product_id', e.target.value)}
          >
            <option value="">All Items</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Payment Status</label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
          >
            <option value="">All</option>
            {PAYMENT_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-actions">
          <button type="button" className="btn-secondary" onClick={() => setFilters(defaultFilters())}>
            This Week Unpaid
          </button>
          <button type="button" className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Show All
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Client</th>
              <th>Order Date</th>
              <th>Delivery Date</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  {hasActiveFilters
                    ? 'No orders match the selected filters.'
                    : 'No orders found. Add your first order!'}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>{getClientName(order.client_id)}</td>
                  <td>{order.order_date}</td>
                  <td>{order.delivery_date}</td>
                  <td className="order-items-cell">{describeItems(order.items)}</td>
                  <td>₹{parseFloat((order.total_amount || 0).toString()).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${order.status || 'not_paid'}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td>
                    <button className="btn-edit" onClick={() => handleEdit(order)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(order.id!)}>
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
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingOrder(null); resetForm(); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingOrder ? 'Edit Order' : 'Add Order'}</h2>
            {formError && <div className="form-error-banner">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Order Number {!editingOrder && '(Leave empty to auto-generate)'}</label>
                  <input
                    type="text"
                    value={formData.order_number || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, order_number: e.target.value });
                      setOrderNumberError('');
                    }}
                    placeholder={editingOrder ? 'Order Number' : 'Auto-generated if empty'}
                  />
                  {orderNumberError && (
                    <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '5px' }}>
                      {orderNumberError}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Client *</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => handleClientChange(parseInt(e.target.value))}
                    required
                  >
                    <option value={0}>Select Client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Order Date *</label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => {
                      // Prices key off the delivery date (see the delivery date field),
                      // so changing the order date must not re-rate the items.
                      setFormData({ ...formData, order_date: e.target.value });
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Delivery Date * (Orders are created only when products are delivered)</label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      setFormData({ ...formData, delivery_date: newDate });
                      // Update prices for all items based on new delivery date
                      if (formData.items && formData.items.length > 0 && formData.client_id > 0) {
                        const updatedItems = await Promise.all(
                          formData.items.map(async (item) => {
                            if (item.product_id > 0) {
                              try {
                                const clientPrice = await apiClient.getEffectiveClientPrice(
                                  formData.client_id,
                                  item.product_id,
                                  newDate
                                );
                                if (clientPrice.price !== null) {
                                  return {
                                    ...item,
                                    unit_price: clientPrice.price,
                                    total_price: item.quantity * clientPrice.price,
                                  };
                                } else {
                                  const effectiveRate = await apiClient.getEffectiveRate(item.product_id, newDate);
                                  return {
                                    ...item,
                                    unit_price: effectiveRate.rate,
                                    total_price: item.quantity * effectiveRate.rate,
                                  };
                                }
                              } catch (error) {
                                return item;
                              }
                            }
                            return item;
                          })
                        );
                        const totalAmount = updatedItems.reduce((sum, i) => sum + i.total_price, 0);
                        setFormData(prev => ({ ...prev, delivery_date: newDate, items: updatedItems, total_amount: totalAmount }));
                      }
                    }}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Products *</label>
                <div className="order-items">
                  {formData.items?.map((item, index) => (
                    <div key={index} className="order-item-row">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateOrderItem(index, 'product_id', parseInt(e.target.value))}
                        required
                      >
                        <option value={0}>Select Product</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - ₹{product.unit_price}/{product.unit}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)}
                        required
                      />
                      <span className="item-total">₹{item.total_price.toFixed(2)}</span>
                      <button type="button" className="btn-remove" onClick={() => removeOrderItem(index)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-add-item" onClick={addOrderItem}>
                    + Add Product
                  </button>
                </div>
                <div className="order-total">
                  <strong>Total: ₹{formData.total_amount?.toFixed(2) || '0.00'}</strong>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Payment Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {PAYMENT_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingOrder(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingOrder ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

