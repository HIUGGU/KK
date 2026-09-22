const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('API Request:', url, options.method || 'GET');

      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || error.error || `Request failed with status ${response.status}`);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text);
    } catch (error: any) {
      console.error('API Request Error:', error);
      if (error.message && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        throw new Error('Unable to connect to API server. Please make sure the API is running on http://localhost:3001');
      }
      throw error;
    }
  }

  // Auth
  async login(username: string, password: string) {
    const result = await this.request<{ success: boolean; token?: string; message?: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
    if (result.success && result.token) {
      this.setToken(result.token);
    }
    return result;
  }

  async verifyToken() {
    const token = this.getToken();
    if (!token) return false;
    const result = await this.request<{ valid: boolean }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return result.valid;
  }

  // Employees
  async getAllEmployees() {
    return this.request('/employees');
  }

  async getEmployeeById(id: number) {
    return this.request(`/employees/${id}`);
  }

  async createEmployee(employee: any) {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
  }

  async updateEmployee(id: number, employee: any) {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employee),
    });
  }

  async deleteEmployee(id: number) {
    return this.request(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // Salary increases / decreases
  async getSalaryRevisions(employeeId?: number) {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId.toString());
    return this.request(`/employees/salary-revisions?${params.toString()}`);
  }

  async createSalaryRevision(employeeId: number, newSalary: number, effectiveDate: string, reason?: string) {
    return this.request(`/employees/${employeeId}/salary-revisions`, {
      method: 'POST',
      body: JSON.stringify({ new_salary: newSalary, effective_date: effectiveDate, reason }),
    });
  }

  // Attendance
  async markAttendance(employeeId: number, date: string, attendanceType: 'full_day' | 'half_day' | 'absent') {
    return this.request('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ employeeId, date, attendanceType }),
    });
  }

  async getAttendanceByEmployee(employeeId: number, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/attendance/employee/${employeeId}?${params.toString()}`);
  }

  async getAllAttendance(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/attendance?${params.toString()}`);
  }

  // Salary
  async calculateSalary(employeeId: number, month: number, year: number, extraAmount?: number, payoutDate?: string) {
    return this.request('/salary/calculate', {
      method: 'POST',
      body: JSON.stringify({ employeeId, month, year, extraAmount, payoutDate }),
    });
  }

  async previewSalary(employeeId: number, month: number, year: number, extraAmount?: number) {
    return this.request('/salary/preview', {
      method: 'POST',
      body: JSON.stringify({ employeeId, month, year, extraAmount }),
    });
  }

  async getSalaryHistory(employeeId?: number) {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId.toString());
    return this.request(`/salary/history?${params.toString()}`);
  }

  async updateSalaryStatus(id: number, status: 'paid' | 'not_paid') {
    return this.request(`/salary/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Salary ledger - earned vs advanced vs paid, for ad-hoc payouts
  async getSalaryLedger(asOf?: string, employeeId?: number) {
    const params = new URLSearchParams();
    if (asOf) params.append('asOf', asOf);
    if (employeeId) params.append('employeeId', employeeId.toString());
    return this.request(`/salary/ledger?${params.toString()}`);
  }

  async createSalaryPayment(employeeId: number, amount: number, paymentDate: string, notes?: string) {
    return this.request('/salary/payments', {
      method: 'POST',
      body: JSON.stringify({ employeeId, amount, paymentDate, notes }),
    });
  }

  async getSalaryPayments(employeeId?: number) {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId.toString());
    return this.request(`/salary/payments?${params.toString()}`);
  }

  async deleteSalaryPayment(id: number) {
    return this.request(`/salary/payments/${id}`, {
      method: 'DELETE',
    });
  }

  // Advances
  async createAdvance(employeeId: number, amount: number, remark: string, date: string) {
    return this.request('/advances', {
      method: 'POST',
      body: JSON.stringify({ employeeId, amount, remark, date }),
    });
  }

  async getAdvancesByEmployee(employeeId: number, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/advances/employee/${employeeId}?${params.toString()}`);
  }

  async getAllAdvances(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/advances?${params.toString()}`);
  }

  async updateAdvanceStatus(id: number, status: 'pending' | 'deducted' | 'cancelled') {
    return this.request(`/advances/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async deleteAdvance(id: number) {
    return this.request(`/advances/${id}`, {
      method: 'DELETE',
    });
  }

  // Products
  async getAllProducts() {
    return this.request('/products');
  }

  async getProductById(id: number) {
    return this.request(`/products/${id}`);
  }

  async createProduct(product: any) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: number, product: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }

  async deleteProduct(id: number) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getProductRateHistory(productId: number) {
    return this.request(`/products/${productId}/rates`);
  }

  async addProductRate(productId: number, rate: any) {
    return this.request(`/products/${productId}/rates`, {
      method: 'POST',
      body: JSON.stringify(rate),
    });
  }

  async getProductPriceLog(productId: number) {
    return this.request(`/products/${productId}/price-log`);
  }

  async getEffectiveRate(productId: number, date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request(`/products/${productId}/effective-rate${params}`);
  }

  // Clients
  async getAllClients() {
    return this.request('/clients');
  }

  async getClientById(id: number) {
    return this.request(`/clients/${id}`);
  }

  async createClient(client: any) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id: number, client: any) {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(client),
    });
  }

  async deleteClient(id: number) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Orders
  async getAllOrders(filters?: {
    from_date?: string;
    to_date?: string;
    product_id?: number | string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return this.request(`/orders${query ? `?${query}` : ''}`);
  }

  async getOrderById(id: number) {
    return this.request(`/orders/${id}`);
  }

  async createOrder(order: any) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async updateOrder(id: number, order: any) {
    return this.request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
  }

  async deleteOrder(id: number) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  // Settlements
  async getAllSettlements() {
    return this.request('/settlements');
  }

  async getClientBalances() {
    return this.request('/settlements/balances');
  }

  async getClientSettlementSummary(clientId: number) {
    return this.request(`/settlements/summary/${clientId}`);
  }

  async getSettlementsByClient(clientId: number) {
    return this.request(`/settlements/client/${clientId}`);
  }

  async createSettlement(settlement: any) {
    return this.request('/settlements', {
      method: 'POST',
      body: JSON.stringify(settlement),
    });
  }

  async deleteSettlement(id: number) {
    return this.request(`/settlements/${id}`, {
      method: 'DELETE',
    });
  }

  // Bank Accounts
  async getAllBankAccounts() {
    return this.request('/bank-accounts');
  }

  async getBankAccountById(id: number) {
    return this.request(`/bank-accounts/${id}`);
  }

  async createBankAccount(account: any) {
    return this.request('/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  }

  async updateBankAccount(id: number, account: any) {
    return this.request(`/bank-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(account),
    });
  }

  async deleteBankAccount(id: number) {
    return this.request(`/bank-accounts/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard
  async getOutstandingBalance() {
    return this.request('/dashboard/outstanding-balance');
  }

  // Client Product Prices
  async getClientPrices(clientId: number) {
    return this.request(`/client-product-prices/client/${clientId}`);
  }

  async getClientRateSummary(clientId: number) {
    return this.request(`/client-product-prices/client/${clientId}/rate-summary`);
  }

  async getProductPricesForClient(clientId: number, productId: number) {
    return this.request(`/client-product-prices/client/${clientId}/product/${productId}`);
  }

  async getEffectiveClientPrice(clientId: number, productId: number, date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request(`/client-product-prices/client/${clientId}/product/${productId}/effective${params}`);
  }

  async setClientProductPrice(price: any) {
    return this.request('/client-product-prices', {
      method: 'POST',
      body: JSON.stringify(price),
    });
  }

  async updateClientProductPrice(id: number, price: any) {
    return this.request(`/client-product-prices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(price),
    });
  }

  async deleteClientProductPrice(id: number) {
    return this.request(`/client-product-prices/${id}`, {
      method: 'DELETE',
    });
  }

  // Vendors
  /** All vendors, or just the ones for one kind of work. */
  async getAllVendors(type?: 'material' | 'plasma' | 'tinker' | 'buffing') {
    return this.request(`/vendors${type ? `?type=${type}` : ''}`);
  }

  async getVendorById(id: number) {
    return this.request(`/vendors/${id}`);
  }

  async createVendor(vendor: any) {
    return this.request('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
  }

  async updateVendor(id: number, vendor: any) {
    return this.request(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vendor),
    });
  }

  async deleteVendor(id: number) {
    return this.request(`/vendors/${id}`, {
      method: 'DELETE',
    });
  }

  // Raw Materials - an entry is one delivery holding many lines
  async getAllRawMaterialEntries(status?: string, vendorId?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (vendorId) params.append('vendorId', vendorId.toString());
    return this.request(`/raw-materials?${params.toString()}`);
  }

  async getRawMaterialEntryById(id: number) {
    return this.request(`/raw-materials/${id}`);
  }

  async getRawMaterialSummary() {
    return this.request('/raw-materials/summary');
  }

  async createRawMaterialEntry(entry: any) {
    return this.request('/raw-materials', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateRawMaterialEntry(id: number, entry: any) {
    return this.request(`/raw-materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
  }

  async deleteRawMaterialEntry(id: number) {
    return this.request(`/raw-materials/${id}`, {
      method: 'DELETE',
    });
  }

  async updateRawMaterialEntryStatus(id: number, status: string, notes?: string) {
    return this.request(`/raw-materials/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  async getRawMaterialItemStatusHistory(itemId: number) {
    return this.request(`/raw-materials/items/${itemId}/status-history`);
  }

  async updateRawMaterialItemStatus(itemId: number, status: string, notes?: string) {
    return this.request(`/raw-materials/items/${itemId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  async deleteRawMaterialItem(itemId: number) {
    return this.request(`/raw-materials/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Cutting - raw material lots in, counted finished products out
  async getAllCuttings(fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    return this.request(`/cuttings?${params.toString()}`);
  }

  async getCuttingById(id: number) {
    return this.request(`/cuttings/${id}`);
  }

  async getCuttingSummary() {
    return this.request('/cuttings/summary');
  }

  async getCuttingProductStock() {
    return this.request('/cuttings/product-stock');
  }

  /** Lots free to cut. Pass the cutting being edited to keep its own lots listed. */
  async getAvailableCuttingMaterials(forCuttingId?: number) {
    const params = forCuttingId ? `?forCuttingId=${forCuttingId}` : '';
    return this.request(`/cuttings/available-materials${params}`);
  }

  async createCutting(cutting: any) {
    return this.request('/cuttings', {
      method: 'POST',
      body: JSON.stringify(cutting),
    });
  }

  async updateCutting(id: number, cutting: any) {
    return this.request(`/cuttings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cutting),
    });
  }

  async deleteCutting(id: number) {
    return this.request(`/cuttings/${id}`, {
      method: 'DELETE',
    });
  }

  // Material Points
  async getAllMaterialPoints() {
    return this.request('/material-points');
  }

  async createMaterialPoint(point: any) {
    return this.request('/material-points', {
      method: 'POST',
      body: JSON.stringify(point),
    });
  }

  async updateMaterialPoint(id: number, point: any) {
    return this.request(`/material-points/${id}`, {
      method: 'PUT',
      body: JSON.stringify(point),
    });
  }

  async deleteMaterialPoint(id: number) {
    return this.request(`/material-points/${id}`, {
      method: 'DELETE',
    });
  }

  // Material Sizes
  async getAllMaterialSizes() {
    return this.request('/material-sizes');
  }

  async createMaterialSize(size: any) {
    return this.request('/material-sizes', {
      method: 'POST',
      body: JSON.stringify(size),
    });
  }

  async updateMaterialSize(id: number, size: any) {
    return this.request(`/material-sizes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(size),
    });
  }

  async deleteMaterialSize(id: number) {
    return this.request(`/material-sizes/${id}`, {
      method: 'DELETE',
    });
  }

  // Vendor Rates
  async getVendorRates(vendorId?: number, pointId?: number) {
    const params = new URLSearchParams();
    if (vendorId) params.append('vendorId', vendorId.toString());
    if (pointId) params.append('pointId', pointId.toString());
    return this.request(`/vendor-rates?${params.toString()}`);
  }

  async getCurrentVendorRates(vendorId: number, date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request(`/vendor-rates/vendor/${vendorId}/current${params}`);
  }

  async getEffectiveVendorRate(vendorId: number, pointId: number, date?: string) {
    const params = new URLSearchParams();
    params.append('vendorId', vendorId.toString());
    params.append('pointId', pointId.toString());
    if (date) params.append('date', date);
    return this.request(`/vendor-rates/effective?${params.toString()}`);
  }

  async setVendorRate(rate: any) {
    return this.request('/vendor-rates', {
      method: 'POST',
      body: JSON.stringify(rate),
    });
  }

  async deleteVendorRate(id: number) {
    return this.request(`/vendor-rates/${id}`, {
      method: 'DELETE',
    });
  }

  // Process stages - plasma, tinker and buffing, which all work the same way
  async getAllProcessJobs(
    stage: string,
    filters?: {
      fromDate?: string;
      toDate?: string;
      mode?: string;
      vendorId?: number | string;
      status?: string;
      workStatus?: string;
    },
  ) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return this.request(`/${stage}${query ? `?${query}` : ''}`);
  }

  async getProcessJobById(stage: string, id: number) {
    return this.request(`/${stage}/${id}`);
  }

  async getProcessSummary(stage: string) {
    return this.request(`/${stage}/summary`);
  }

  /** Where every product stands at a stage: ready, in progress, finished. */
  async getProcessStock(stage: string, forJobId?: number) {
    const params = forJobId ? `?forJobId=${forJobId}` : '';
    return this.request(`/${stage}/stock${params}`);
  }

  /** Only what is free to send in. Pass the job being edited to free its own pieces. */
  async getProcessPending(stage: string, forJobId?: number) {
    const params = forJobId ? `?forJobId=${forJobId}` : '';
    return this.request(`/${stage}/pending${params}`);
  }

  /** What a vendor would charge for these lines, without saving anything. */
  async quoteProcessJob(stage: string, vendorId: number, jobDate: string, items: any[]) {
    return this.request(`/${stage}/quote`, {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendorId, job_date: jobDate, items }),
    });
  }

  async createProcessJob(stage: string, job: any) {
    return this.request(`/${stage}`, {
      method: 'POST',
      body: JSON.stringify(job),
    });
  }

  async updateProcessJob(stage: string, id: number, job: any) {
    return this.request(`/${stage}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(job),
    });
  }

  /** Finishing a job is what releases its pieces to the next stage. */
  async setProcessJobWorkStatus(
    stage: string,
    id: number,
    workStatus: 'in_progress' | 'completed',
    completedDate?: string,
  ) {
    return this.request(`/${stage}/${id}/work-status`, {
      method: 'PUT',
      body: JSON.stringify({ work_status: workStatus, completed_date: completedDate }),
    });
  }

  async deleteProcessJob(stage: string, id: number) {
    return this.request(`/${stage}/${id}`, {
      method: 'DELETE',
    });
  }

  // Stage rate cards - what a vendor charges per product, flat or per inch of height
  async getProcessRates(stage: string, vendorId?: number, productId?: number) {
    const params = new URLSearchParams();
    if (vendorId) params.append('vendorId', vendorId.toString());
    if (productId) params.append('productId', productId.toString());
    return this.request(`/${stage}-rates?${params.toString()}`);
  }

  async getCurrentProcessRates(stage: string, vendorId: number, date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request(`/${stage}-rates/vendor/${vendorId}/current${params}`);
  }

  async setProcessRate(stage: string, rate: any) {
    return this.request(`/${stage}-rates`, {
      method: 'POST',
      body: JSON.stringify(rate),
    });
  }

  async deleteProcessRate(stage: string, id: number) {
    return this.request(`/${stage}-rates/${id}`, {
      method: 'DELETE',
    });
  }

  // Vendor Payments - money paid out to plasma vendors
  async getAllVendorPayments() {
    return this.request('/vendor-payments');
  }

  async getVendorBalances() {
    return this.request('/vendor-payments/balances');
  }

  async getVendorPaymentSummary(vendorId: number) {
    return this.request(`/vendor-payments/summary/${vendorId}`);
  }

  async getPaymentsByVendor(vendorId: number) {
    return this.request(`/vendor-payments/vendor/${vendorId}`);
  }

  async createVendorPayment(payment: any) {
    return this.request('/vendor-payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  async deleteVendorPayment(id: number) {
    return this.request(`/vendor-payments/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();

