import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { formatDate as formatDateDDMMYYYY } from '../utils/formatDate';
import './ClientRates.css';

interface Client {
  id?: number;
  name: string;
  company_name?: string;
}

interface ClientRateSummary {
  product_id: number;
  product_name: string;
  product_unit: string;
  scope: 'client' | 'standard';
  current_price: number;
  previous_price: number | null;
  change: number | null;
  changed_at: string | null;
  effective_date: string | null;
}

export default function ClientRates() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [rates, setRates] = useState<ClientRateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) load(parseInt(clientId));
  }, [clientId]);

  const load = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [clients, summary] = await Promise.all([
        apiClient.getAllClients(),
        apiClient.getClientRateSummary(id),
      ]);
      setClient((clients as Client[]).find((c: any) => c.id === id) || null);
      setRates(summary as ClientRateSummary[]);
    } catch (err: any) {
      console.error('Failed to load client rates:', err);
      setError(err.message || 'Failed to load client rates.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return formatDateDDMMYYYY(iso);
  };

  return (
    <div className="client-rates">
      <div className="page-header">
        <div>
          <h1>Product Rates{client ? ` - ${client.name}` : ''}</h1>
          {client?.company_name && <p className="client-rates-subtitle">{client.company_name}</p>}
        </div>
        <button className="btn-secondary" onClick={() => navigate('/clients')}>
          Back to Clients
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="client-rates-error">{error}</p>
      ) : (
        <div className="table-container">
          <table className="client-rates-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Price</th>
                <th>Last Price</th>
                <th>Changed On</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                rates.map((rate) => {
                  const hasChange = rate.change !== null && rate.change !== 0;
                  const increased = hasChange && (rate.change as number) > 0;
                  return (
                    <tr key={rate.product_id}>
                      <td>
                        {rate.product_name}
                        {rate.scope === 'client' && <span className="scope-tag">special</span>}
                      </td>
                      <td>
                        <strong>₹{rate.current_price.toFixed(2)}</strong>
                        {rate.product_unit ? ` / ${rate.product_unit}` : ''}
                      </td>
                      <td>
                        {rate.previous_price !== null ? `₹${rate.previous_price.toFixed(2)}` : '-'}
                      </td>
                      <td>{formatDate(rate.changed_at)}</td>
                      <td>
                        {rate.change === null ? (
                          '-'
                        ) : rate.change === 0 ? (
                          <span className="change-neutral">No change</span>
                        ) : (
                          <span className={increased ? 'change-up' : 'change-down'}>
                            {increased ? '▲' : '▼'} ₹{Math.abs(rate.change).toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
