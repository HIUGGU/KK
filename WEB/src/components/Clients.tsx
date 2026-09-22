import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import './Clients.css';

interface Client {
  id?: number;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
}

interface Product {
  id?: number;
  name: string;
  unit_price: number;
  unit?: string;
}

interface ClientProductPrice {
  id?: number;
  client_id: number;
  product_id: number;
  price: number;
  effective_date: string;
  notes?: string;
  product_name?: string;
  product_unit?: string;
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pricingClient, setPricingClient] = useState<Client | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientPrices, setClientPrices] = useState<ClientProductPrice[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceFormData, setPriceFormData] = useState<ClientProductPrice>({
    client_id: 0,
    product_id: 0,
    price: 0,
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [formData, setFormData] = useState<Client>({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    status: 'active',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await apiClient.getAllClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient?.id) {
        await apiClient.updateClient(editingClient.id, formData);
      } else {
        await apiClient.createClient(formData);
      }
      setShowModal(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    } catch (error: any) {
      console.error('Failed to save client:', error);
      alert(error.message || 'Failed to save client. Please try again.');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData(client);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this client?')) {
      try {
        await apiClient.deleteClient(id);
        loadClients();
      } catch (error: any) {
        console.error('Failed to delete client:', error);
        alert(error.message || 'Failed to delete client. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company_name: '',
      email: '',
      phone: '',
      address: '',
      status: 'active',
    });
  };

  const handleManagePrices = async (client: Client) => {
    setPricingClient(client);
    setEditingPriceId(null);
    try {
      const [productList, prices] = await Promise.all([
        apiClient.getAllProducts(),
        apiClient.getClientPrices(client.id!),
      ]);
      setProducts(productList);
      setClientPrices(prices);
      setPriceFormData({
        client_id: client.id!,
        product_id: 0,
        price: 0,
        effective_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setShowPriceModal(true);
    } catch (error: any) {
      console.error('Failed to load client prices:', error);
      alert(error.message || 'Failed to load client prices.');
    }
  };

  const handleProductChange = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    setPriceFormData({
      ...priceFormData,
      product_id: productId,
      // Prefill with the standard rate so it is clear what is being overridden
      price: product ? Number(product.unit_price) : 0,
    });
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceFormData.product_id) {
      alert('Please select a product.');
      return;
    }
    try {
      if (editingPriceId) {
        await apiClient.updateClientProductPrice(editingPriceId, {
          price: priceFormData.price,
          effective_date: priceFormData.effective_date,
          notes: priceFormData.notes,
        });
      } else {
        await apiClient.setClientProductPrice(priceFormData);
      }
      await reloadClientPrices();
      resetPriceForm();
    } catch (error: any) {
      console.error('Failed to save price:', error);
      alert(error.message || 'Failed to save price. Please try again.');
    }
  };

  const handleEditPrice = (price: ClientProductPrice) => {
    setEditingPriceId(price.id!);
    setPriceFormData({
      client_id: price.client_id,
      product_id: price.product_id,
      price: price.price,
      effective_date: price.effective_date,
      notes: price.notes || '',
    });
  };

  const handleDeletePrice = async (id: number) => {
    if (confirm('Remove this special price? Orders will fall back to the standard product rate.')) {
      try {
        await apiClient.deleteClientProductPrice(id);
        await reloadClientPrices();
        if (editingPriceId === id) resetPriceForm();
      } catch (error: any) {
        console.error('Failed to delete price:', error);
        alert(error.message || 'Failed to delete price. Please try again.');
      }
    }
  };

  const reloadClientPrices = async () => {
    const prices = await apiClient.getClientPrices(pricingClient!.id!);
    setClientPrices(prices);
  };

  const resetPriceForm = () => {
    setEditingPriceId(null);
    setPriceFormData({
      client_id: pricingClient?.id || 0,
      product_id: 0,
      price: 0,
      effective_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const closePriceModal = () => {
    setShowPriceModal(false);
    setPricingClient(null);
    setClientPrices([]);
    setEditingPriceId(null);
  };

  // The price actually applied today per product: the newest one already in effect.
  // The API returns prices ordered by product, then effective date descending.
  const activePriceIds = new Set<number>();
  const today = new Date().toISOString().split('T')[0];
  const seenProducts = new Set<number>();
  for (const price of clientPrices) {
    if (price.effective_date <= today && !seenProducts.has(price.product_id)) {
      seenProducts.add(price.product_id);
      activePriceIds.add(price.id!);
    }
  }

  return (
    <div className="clients">
      <div className="page-header">
        <h1>Clients</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditingClient(null); resetForm(); }}>
          + Add Client
        </button>
      </div>

      <div className="table-container">
        <table className="clients-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  No clients found. Add your first client!
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.company_name || '-'}</td>
                  <td>{client.email || '-'}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.address || '-'}</td>
                  <td>
                    <span className={`status-badge ${client.status}`}>
                      {client.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-price" onClick={() => handleManagePrices(client)}>
                      Prices
                    </button>
                    <button className="btn-rates" onClick={() => navigate(`/clients/${client.id}/rates`)}>
                      Rates
                    </button>
                    <button className="btn-edit" onClick={() => handleEdit(client)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(client.id!)}>
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
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingClient(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingClient ? 'Edit Client' : 'Add Client'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Client Name *</label>
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
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingClient(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingClient ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPriceModal && pricingClient && (
        <div className="modal-overlay" onClick={closePriceModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Special Prices - {pricingClient.name}</h2>
            <p className="price-hint">
              Set a rate that applies only to this client. Orders for this client use the
              latest special price on or before the delivery date; products without one fall
              back to the standard product rate.
            </p>

            <div className="client-price-form">
              <h4>{editingPriceId ? 'Edit Special Price' : 'Add Special Price'}</h4>
              <form onSubmit={handleSavePrice}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Product *</label>
                    <select
                      value={priceFormData.product_id || ''}
                      onChange={(e) => handleProductChange(parseInt(e.target.value) || 0)}
                      disabled={editingPriceId !== null}
                      required
                    >
                      <option value="">Select a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} (standard ₹{Number(product.unit_price).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price for this client (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceFormData.price}
                      onChange={(e) =>
                        setPriceFormData({ ...priceFormData, price: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Effective Date *</label>
                    <input
                      type="date"
                      value={priceFormData.effective_date}
                      onChange={(e) =>
                        setPriceFormData({ ...priceFormData, effective_date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <input
                      type="text"
                      value={priceFormData.notes}
                      onChange={(e) => setPriceFormData({ ...priceFormData, notes: e.target.value })}
                      placeholder="e.g. bulk discount agreed"
                    />
                  </div>
                </div>
                <div className="price-form-actions">
                  <button type="submit" className="btn-primary">
                    {editingPriceId ? 'Update Price' : 'Add Price'}
                  </button>
                  {editingPriceId && (
                    <button type="button" className="btn-secondary" onClick={resetPriceForm}>
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="client-price-list">
              <h4>Special Prices</h4>
              {clientPrices.length === 0 ? (
                <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
                  No special prices for this client. They are billed at standard product rates.
                </p>
              ) : (
                <table className="client-price-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price (₹)</th>
                      <th>Effective Date</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientPrices.map((price) => (
                      <tr key={price.id} className={activePriceIds.has(price.id!) ? 'active-price' : ''}>
                        <td>
                          {price.product_name || `#${price.product_id}`}
                          {activePriceIds.has(price.id!) && (
                            <span className="current-tag">current</span>
                          )}
                        </td>
                        <td>
                          <strong>₹{price.price.toFixed(2)}</strong>
                          {price.product_unit ? ` / ${price.product_unit}` : ''}
                        </td>
                        <td>{price.effective_date}</td>
                        <td>{price.notes || '-'}</td>
                        <td>
                          <button className="btn-edit" onClick={() => handleEditPrice(price)}>
                            Edit
                          </button>
                          <button className="btn-delete" onClick={() => handleDeletePrice(price.id!)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closePriceModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



