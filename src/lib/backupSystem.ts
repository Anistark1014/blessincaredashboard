import { supabase } from './supabaseClient';

// Define all the tables we want to backup
const BACKUP_TABLES = [
  'products',
  'users', 
  'expenses',
  'sales',
  'requests',
  'product_request_items',
  'notifications',
  'cash_transactions',
  'clearances',
  'company_balance',
  'goods_purchases',
  'inventory_transactions',
  'investments',
  'loan_payments',
  'loans',
  'rewards',
  'settings'
] as const;

type BackupData = {
  [K in typeof BACKUP_TABLES[number]]?: any[];
};

interface BackupMetadata {
  timestamp: string;
  exportedAt: string;
  version: string;
  tableCount: number;
  totalRecords: number;
}

interface FullBackup {
  metadata: BackupMetadata;
  data: BackupData;
}

export class BackupSystem {
  private static async fetchTableData(tableName: typeof BACKUP_TABLES[number]): Promise<{ data: any[] | null; count: number }> {
    try {
      console.log(`📥 Fetching data from ${tableName}...`);
      
      const query = supabase.from(tableName);
      
      if (tableName === 'sales') {
        const response = await query
          .select('*, users!member_id (name, region, email)');

        if (response.error) {
          console.error(`❌ Error fetching ${tableName}:`, response.error);
          return { data: [], count: 0 };
        }

        console.log(`✅ Fetched ${response.data?.length || 0} sales records`);
        return { data: response.data || [], count: response.data?.length || 0 };
      } 
      
      const response = await query.select('*');

      if (response.error) {
        console.error(`❌ Error fetching ${tableName}:`, response.error);
        return { data: [], count: 0 };
      }

      const count = response.data?.length || 0;
      console.log(`✅ Fetched ${count} records from ${tableName}`);
      return { data: response.data || [], count };
    } catch (error) {
      console.error(`❌ Exception fetching ${tableName}:`, error);
      return { data: [], count: 0 };
    }
  }

  private static generateFileName(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `blessin-finance-backup-${timestamp}.json`;
  }

  private static downloadAsJSON(data: FullBackup, filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  private static downloadAsCSV(data: any[], filename: string, tableName: string): void {
    if (!data || data.length === 0) return;
    
    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    
    const headers = Array.from(allKeys);
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(item => 
        headers.map(header => {
          const value = item[header];
          // Handle null/undefined values and escape commas/quotes
          if (value === null || value === undefined) return '';
          const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return stringValue.includes(',') || stringValue.includes('"') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.json', `-${tableName}.csv`);
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  private static generateEnhancedDashboardHTML(fullBackup: FullBackup): string {
    try {
      const metadata = fullBackup.metadata;
      const backupData = fullBackup.data;
      
      console.log('🎨 Generating dashboard with data keys:', Object.keys(backupData));
      
      const navigationTabs = this.generateNavigationTabs(backupData);
      const tabContents = this.generateTabContents(backupData);
      
      console.log('📑 Generated navigation tabs:', navigationTabs.length, 'characters');
      console.log('📋 Generated tab contents:', tabContents.length, 'characters');
      
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blessin Finance Database Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          line-height: 1.6;
          min-height: 100vh;
        }
        .container { max-width: 1600px; margin: 0 auto; padding: 20px; }
        .header { 
          background: rgba(255, 255, 255, 0.95); 
          padding: 30px; 
          border-radius: 16px; 
          margin-bottom: 30px; 
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .header h1 { color: #2563eb; font-size: 2.5rem; margin-bottom: 10px; font-weight: 700; }
        .header p { color: #6b7280; font-size: 1.1rem; margin: 5px 0; }
        
        .json-upload {
          background: rgba(255, 255, 255, 0.95);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          border: 2px dashed #d1d5db;
          text-align: center;
          transition: all 0.3s ease;
        }
        .json-upload:hover { border-color: #3b82f6; }
        .json-upload.dragover { border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
        .json-upload input { display: none; }
        .json-upload-btn {
          background: #3b82f6;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background 0.3s ease;
        }
        .json-upload-btn:hover { background: #2563eb; }
        
        .dashboard-content {
          display: none;
        }
        .dashboard-content.active {
          display: block;
        }
        
        .nav-tabs {
          display: flex;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 12px;
          padding: 8px;
          margin-bottom: 30px;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          backdrop-filter: blur(10px);
          overflow-x: auto;
        }
        .nav-tab {
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 500;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .nav-tab:hover { background: rgba(59, 130, 246, 0.1); }
        .nav-tab.active { 
          background: #3b82f6; 
          color: white; 
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .data-section {
          background: rgba(255, 255, 255, 0.95); 
          padding: 30px; 
          border-radius: 16px; 
          margin-bottom: 30px; 
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .data-card { 
          background: white; 
          border-radius: 12px; 
          padding: 20px; 
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          border: 1px solid #e5e7eb;
        }
        .data-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        
        .product-card img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; }
        .user-card .avatar { 
          width: 60px; 
          height: 60px; 
          border-radius: 50%; 
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex; 
          align-items: center; 
          justify-content: center; 
          color: white; 
          font-weight: bold; 
          font-size: 1.5rem;
          margin-bottom: 12px;
        }
        
        .data-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .data-table th, .data-table td { 
          padding: 12px 16px; 
          text-align: left; 
          border-bottom: 1px solid #e5e7eb; 
        }
        .data-table th { 
          background: #f8fafc; 
          font-weight: 600; 
          color: #374151; 
          position: sticky;
          top: 0;
        }
        .data-table tr:hover { background: #f9fafb; }
        .data-table tr:last-child td { border-bottom: none; }
        
        .status-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .status-in-stock { background: #dcfce7; color: #166534; }
        .status-low-stock { background: #fef3c7; color: #92400e; }
        .status-out-of-stock { background: #fee2e2; color: #991b1b; }
        .status-active { background: #dbeafe; color: #1d4ed8; }
        .status-inactive { background: #f3f4f6; color: #6b7280; }
        
        .amount-positive { color: #059669; font-weight: 600; }
        .amount-negative { color: #dc2626; font-weight: 600; }
        
        .search-box {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 1rem;
          margin-bottom: 20px;
          background: white;
        }
        .search-box:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px; }
        .stat-card { 
          background: white; 
          padding: 20px; 
          border-radius: 12px; 
          text-align: center; 
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          border: 1px solid #e5e7eb;
        }
        .stat-value { font-size: 2rem; font-weight: 800; color: #2563eb; margin-bottom: 6px; }
        .stat-label { color: #6b7280; font-weight: 500; font-size: 0.9rem; }
        
        .footer { text-align: center; padding: 30px; color: rgba(255, 255, 255, 0.8); }
        
        @media (max-width: 768px) {
          .cards-grid { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
          .nav-tabs { flex-wrap: wrap; }
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <h1>📈 Blessin Finance Database Dashboard</h1>
            <button id="changeBackupBtn" style="float:right;margin-top:-8px;margin-right:8px;padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:500;cursor:pointer;">Change Backup</button>
            <input type="file" id="jsonFileInput" accept=".json" style="display:none;">
            <span id="uploadStatus" style="margin-left:12px;font-size:14px;"></span>
            <p><strong>Generated:</strong> ${metadata.exportedAt}</p>
            <p><strong>Data Version:</strong> ${metadata.version} | <strong>Export ID:</strong> ${metadata.timestamp.slice(0, 8)}</p>
            <p><strong>Coverage:</strong> ${metadata.tableCount} data sources | <strong>Total Records:</strong> ${metadata.totalRecords.toLocaleString()}</p>
            <p style="margin-top: 10px; font-size: 0.9rem; color: #6b7280;"><strong>⌨️ Keyboard Shortcuts:</strong> Use Ctrl + ← / → to navigate between tabs</p>
        </div>

        <div id="dashboardContent" class="dashboard-content active">
            <div class="nav-tabs" id="navTabs">
                ${this.generateNavigationTabs(backupData)}
            </div>

            <div id="tabContents">
                ${this.generateTabContents(backupData)}
            </div>
        </div>

        <div class="footer">
            <p>� Powered by Blessin Finance Database • Generated ${metadata.exportedAt}</p>
        </div>
    </div>

    <script>
        let globalData = null;
        document.addEventListener('DOMContentLoaded', function() {
            const jsonFileInput = document.getElementById('jsonFileInput');
            const uploadStatus = document.getElementById('uploadStatus');
            const changeBackupBtn = document.getElementById('changeBackupBtn');

            if (changeBackupBtn && jsonFileInput) {
                changeBackupBtn.addEventListener('click', function() {
                    jsonFileInput.value = '';
                    jsonFileInput.click();
                });
                jsonFileInput.addEventListener('change', function(e) {
                    if (e.target.files.length > 0) {
                        handleFileUpload(e.target.files[0]);
                    }
                });
            }

            function handleFileUpload(file) {
                if (!file.name.endsWith('.json')) {
                    uploadStatus.innerHTML = '<span style="color: #ef4444;">❌ Please select a JSON file</span>';
                    return;
                }
                uploadStatus.innerHTML = '<span style="color: #3b82f6;">⏳ Loading data...</span>';
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        let jsonData = JSON.parse(e.target.result);
                        globalData = jsonData.data || jsonData;
                        
                        // Fix currency symbols recursively - replace $ with ₹ only in currency contexts
                        function replaceCurrency(obj) {
                            if (typeof obj === 'string') {
                                // Only replace $ when it appears as currency (followed by numbers or at start of amounts)
                                return obj.replace(/\$(\d+(?:\.\d{2})?)/g, '₹$1') // $123.45 -> ₹123.45
                                         .replace(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '₹$1'); // $1,234.56 -> ₹1,234.56
                            } else if (Array.isArray(obj)) {
                                return obj.map(replaceCurrency);
                            } else if (obj && typeof obj === 'object') {
                                const newObj = {};
                                for (const key in obj) {
                                    if (obj.hasOwnProperty(key)) {
                                        newObj[key] = replaceCurrency(obj[key]);
                                    }
                                }
                                return newObj;
                            }
                            return obj;
                        }
                        
                        globalData = replaceCurrency(globalData);
                        
                        // Update header with uploaded JSON metadata
                        updateHeaderWithUploadedData(jsonData);
                        
                        uploadStatus.innerHTML = '<span style="color: #10b981;">✅ Data loaded successfully!</span>';
                        generateDashboard(globalData);
                    } catch (error) {
                        uploadStatus.innerHTML = '<span style="color: #ef4444;">❌ Invalid JSON file</span>';
                        console.error('JSON parsing error:', error);
                    }
                };
                reader.readAsText(file);
            }
            window.handleFileUpload = handleFileUpload;
        });
        
        function updateHeaderWithUploadedData(jsonData) {
            const metadata = jsonData.metadata || {};
            const data = jsonData.data || jsonData;
            
            // Calculate total records from uploaded data
            let totalRecords = 0;
            let tableCount = 0;
            
            for (const tableName in data) {
                if (Array.isArray(data[tableName]) && data[tableName].length > 0) {
                    totalRecords += data[tableName].length;
                    tableCount++;
                }
            }
            
            // Update header information
            const headerElement = document.querySelector('.header');
            if (headerElement) {
                // Find existing paragraphs and update them
                const paragraphs = headerElement.querySelectorAll('p');
                
                if (paragraphs.length >= 3) {
                    // Update Generated date
                    paragraphs[0].innerHTML = \`<strong>📅 Uploaded Data Generated:</strong> \${metadata.exportedAt || 'Unknown Date'}\`;
                    
                    // Update version and export ID
                    const exportId = metadata.timestamp ? metadata.timestamp.slice(0, 8) : 'Unknown';
                    paragraphs[1].innerHTML = \`<strong>📋 Data Version:</strong> \${metadata.version || 'Unknown'} | <strong>🆔 Export ID:</strong> \${exportId}\`;
                    
                    // Update coverage info
                    paragraphs[2].innerHTML = \`<strong>📊 Coverage:</strong> \${tableCount} data sources | <strong>📈 Total Records:</strong> \${totalRecords.toLocaleString()}\`;
                }
                
                // Add uploaded file info if it doesn't exist
                let uploadInfoElement = headerElement.querySelector('.upload-info');
                if (!uploadInfoElement) {
                    uploadInfoElement = document.createElement('p');
                    uploadInfoElement.className = 'upload-info';
                    uploadInfoElement.style.cssText = 'margin-top: 8px; font-size: 0.95rem; color: #059669; font-weight: 500; background: rgba(16, 185, 129, 0.1); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #059669;';
                    headerElement.insertBefore(uploadInfoElement, headerElement.lastElementChild);
                }
                
                const uploadTime = new Date().toLocaleString();
                uploadInfoElement.innerHTML = \`<strong>🔄 Data Source:</strong> Backup JSON File | \${metadata.exportedAt}\`;
            }
        }
        
        function generateDashboard(data) {
            generateNavigationTabs(data);
            generateTabContents(data);
            
            // Show first available tab
            const firstTab = document.querySelector('.nav-tab');
            if (firstTab) {
                firstTab.click();
            }
        }
        
        function generateNavigationTabs(data) {
            const navTabs = document.getElementById('navTabs');
            if (!navTabs) return;
            
            const tabs = [];
            
            // Check for financial data
            const hasFinancialData = (data.cash_transactions && data.cash_transactions.length > 0) ||
                                   (data.expenses && data.expenses.length > 0) ||
                                   (data.investments && data.investments.length > 0) ||
                                   (data.loans && data.loans.length > 0) ||
                                   (data.sales && data.sales.length > 0);
            
            if (hasFinancialData) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'finances\\')">💰 Financial Overview</div>');
            }
            
            if (data.sales && data.sales.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'sales\\')">🛒 Sales Analytics</div>');
            }
            
            if (data.users && data.users.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'users\\')">👥 Users & Resellers</div>');
            }
            
            if (data.products && data.products.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'products\\')">📦 Products</div>');
            }
            
            // Inventory Management Tab
            const hasInventoryData = (data.inventory_transactions && data.inventory_transactions.length > 0) ||
                                   (data.goods_purchases && data.goods_purchases.length > 0);
            
            if (hasInventoryData) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'inventory\\')">📋 Inventory</div>');
            }
            
            if (data.expenses && data.expenses.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'expenses\\')">💸 Expenses</div>');
            }
            
            if (data.cash_transactions && data.cash_transactions.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'transactions\\')">💰 Cash Flow</div>');
            }
            
            if (data.investments && data.investments.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'investments\\')">📈 Investments</div>');
            }
            
            if (data.loans && data.loans.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'loans\\')">🏦 Loans</div>');
            }
            
            if (data.requests && data.requests.length > 0) {
                tabs.push('<div class="nav-tab" onclick="showTab(\\'requests\\')">📋 Requests</div>');
            }
            
            navTabs.innerHTML = tabs.join('');
        }
        
        function generateTabContents(data) {
            const tabContents = document.getElementById('tabContents');
            if (!tabContents) return;
            
            const contents = [];
            
            // Financial Overview Tab
            const hasFinancialData = (data.cash_transactions && data.cash_transactions.length > 0) ||
                                   (data.expenses && data.expenses.length > 0) ||
                                   (data.investments && data.investments.length > 0) ||
                                   (data.loans && data.loans.length > 0) ||
                                   (data.sales && data.sales.length > 0);
            
            if (hasFinancialData) {
                contents.push(\`
                    <div id="finances-content" class="tab-content">
                        <div class="data-section">
                            <h3>💰 Financial Overview & KPIs</h3>
                            \${generateFinancialKPIs(data)}
                            \${generateFinancialBreakdown(data)}
                        </div>
                    </div>
                \`);
            }
            
            // Sales Analytics Tab
            if (data.sales && data.sales.length > 0) {
                contents.push(\`
                    <div id="sales-content" class="tab-content">
                        <div class="data-section">
                            <h3>🛒 Sales Analytics & Performance</h3>
                            \${generateSalesKPIs(data.sales, data.products)}
                            <input type="text" class="search-box" placeholder="🔍 Search sales..." onkeyup="searchTable(this, 'sales-table')">
                            \${generateSalesTable(data.sales)}
                        </div>
                    </div>
                \`);
            }
            
            // Users Tab
            if (data.users && data.users.length > 0) {
                contents.push(\`
                    <div id="users-content" class="tab-content">
                        <div class="data-section">
                            <h3>👥 Users & Resellers Database</h3>
                            \${generateUsersStats(data.users)}
                            <input type="text" class="search-box" placeholder="🔍 Search users..." onkeyup="searchTable(this, 'users-table')">
                            \${generateUsersTable(data.users)}
                        </div>
                    </div>
                \`);
            }
            
            // Products Tab
            if (data.products && data.products.length > 0) {
                contents.push(\`
                    <div id="products-content" class="tab-content">
                        <div class="data-section">
                            <h3>📦 Products Catalog</h3>
                            \${generateProductsStats(data.products)}
                            <input type="text" class="search-box" placeholder="🔍 Search products..." onkeyup="searchTable(this, 'products-table')">
                            \${generateProductsTable(data.products)}
                        </div>
                    </div>
                \`);
            }
            
            // Inventory Management Tab
            const hasInventoryData = (data.inventory_transactions && data.inventory_transactions.length > 0) ||
                                   (data.goods_purchases && data.goods_purchases.length > 0);
            
            if (hasInventoryData) {
                contents.push(\`
                    <div id="inventory-content" class="tab-content">
                        <div class="data-section">
                            <h3>📋 Inventory Management</h3>
                            \${generateInventoryStats(data)}
                            \${generateInventoryTables(data)}
                        </div>
                    </div>
                \`);
            }
            
            // Expenses Tab
            if (data.expenses && data.expenses.length > 0) {
                contents.push(\`
                    <div id="expenses-content" class="tab-content">
                        <div class="data-section">
                            <h3>💸 Expenses Tracking</h3>
                            \${generateExpensesStats(data.expenses)}
                            <input type="text" class="search-box" placeholder="🔍 Search expenses..." onkeyup="searchTable(this, 'expenses-table')">
                            \${generateExpensesTable(data.expenses)}
                        </div>
                    </div>
                \`);
            }
            
            // Cash Transactions Tab
            if (data.cash_transactions && data.cash_transactions.length > 0) {
                contents.push(\`
                    <div id="transactions-content" class="tab-content">
                        <div class="data-section">
                            <h3>💰 Cash Flow Records</h3>
                            \${generateTransactionsStats(data.cash_transactions)}
                            <input type="text" class="search-box" placeholder="🔍 Search transactions..." onkeyup="searchTable(this, 'transactions-table')">
                            \${generateTransactionsTable(data.cash_transactions)}
                        </div>
                    </div>
                \`);
            }
            
            // Other tabs
            if (data.investments && data.investments.length > 0) {
                contents.push(\`
                    <div id="investments-content" class="tab-content">
                        <div class="data-section">
                            <h3>📈 Investment Portfolio</h3>
                            \${generateInvestmentsTable(data.investments)}
                        </div>
                    </div>
                \`);
            }
            
            if (data.loans && data.loans.length > 0) {
                contents.push(\`
                    <div id="loans-content" class="tab-content">
                        <div class="data-section">
                            <h3>🏦 Loans Management</h3>
                            \${generateLoansTable(data.loans)}
                        </div>
                    </div>
                \`);
            }
            
            if (data.requests && data.requests.length > 0) {
                contents.push(\`
                    <div id="requests-content" class="tab-content">
                        <div class="data-section">
                            <h3>📋 Customer Requests</h3>
                            \${generateRequestsTable(data.requests)}
                        </div>
                    </div>
                \`);
            }
            
            tabContents.innerHTML = contents.join('');
        }
        
        // Helper functions for generating dashboard components
        function generateFinancialKPIs(data) {
            const salesRevenue = (data.sales || []).reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
            const totalExpenses = (data.expenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
            const cashInflow = (data.cash_transactions || [])
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            const cashOutflow = (data.cash_transactions || [])
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            const investmentValue = (data.investments || []).reduce((sum, inv) => sum + (inv.current_value || inv.amount || 0), 0);
            const loansOutstanding = (data.loans || [])
                .filter(loan => loan.status === 'active')
                .reduce((sum, loan) => sum + (loan.amount || 0), 0);
            
            const totalRevenue = salesRevenue + cashInflow;
            const totalCosts = totalExpenses + cashOutflow;
            const netIncome = totalRevenue - totalCosts;
            const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue * 100) : 0;
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value amount-positive">₹\${totalRevenue.toLocaleString()}</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value amount-negative">₹\${totalCosts.toLocaleString()}</div>
                        <div class="stat-label">Total Costs</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value \${netIncome >= 0 ? 'amount-positive' : 'amount-negative'}">₹\${Math.abs(netIncome).toLocaleString()}</div>
                        <div class="stat-label">Net \${netIncome >= 0 ? 'Profit' : 'Loss'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value \${profitMargin >= 0 ? 'amount-positive' : 'amount-negative'}">\${profitMargin.toFixed(1)}%</div>
                        <div class="stat-label">Profit Margin</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${investmentValue.toLocaleString()}</div>
                        <div class="stat-label">Investment Value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value amount-negative">₹\${loansOutstanding.toLocaleString()}</div>
                        <div class="stat-label">Loans Outstanding</div>
                    </div>
                </div>
            \`;
        }
        
        function generateFinancialBreakdown(data) {
            const salesCount = (data.sales || []).length;
            const expensesCount = (data.expenses || []).length;
            const transactionsCount = (data.cash_transactions || []).length;
            const investmentsCount = (data.investments || []).length;
            const loansCount = (data.loans || []).length;
            
            return \`
                <div style="margin-top: 30px;">
                    <h4 style="margin-bottom: 20px; color: #374151;">📊 Financial Data Breakdown</h4>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">\${salesCount}</div>
                            <div class="stat-label">Sales Records</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">\${expensesCount}</div>
                            <div class="stat-label">Expense Entries</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">\${transactionsCount}</div>
                            <div class="stat-label">Cash Transactions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">\${investmentsCount}</div>
                            <div class="stat-label">Investments</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">\${loansCount}</div>
                            <div class="stat-label">Loan Records</div>
                        </div>
                    </div>
                </div>
            \`;
        }
        
        function generateSalesKPIs(sales, products) {
            const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
            const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;
            
            const now = new Date();
            const thisMonth = sales.filter(sale => {
                const saleDate = new Date(sale.date || sale.created_at);
                return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
            });
            
            const lastMonth = sales.filter(sale => {
                const saleDate = new Date(sale.date || sale.created_at);
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return saleDate.getMonth() === lastMonthDate.getMonth() && saleDate.getFullYear() === lastMonthDate.getFullYear();
            });
            
            const thisMonthRevenue = thisMonth.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
            const lastMonthRevenue = lastMonth.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
            const monthlyGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${sales.length}</div>
                        <div class="stat-label">Total Sales</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value amount-positive">₹\${totalRevenue.toLocaleString()}</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${avgSale.toFixed(2)}</div>
                        <div class="stat-label">Average Sale Value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${thisMonth.length}</div>
                        <div class="stat-label">Sales This Month</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value amount-positive">₹\${thisMonthRevenue.toLocaleString()}</div>
                        <div class="stat-label">Monthly Revenue</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value \${monthlyGrowth >= 0 ? 'amount-positive' : 'amount-negative'}">\${monthlyGrowth >= 0 ? '+' : ''}\${monthlyGrowth.toFixed(1)}%</div>
                        <div class="stat-label">Monthly Growth</div>
                    </div>
                </div>
            \`;
        }
        
        // Tab functionality
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            const selectedContent = document.getElementById(tabName + '-content');
            if (selectedContent) {
                selectedContent.classList.add('active');
            }
            
            // Add active class to selected tab
            const selectedTab = document.querySelector(\`[onclick="showTab('\${tabName}')"]\`);
            if (selectedTab) {
                selectedTab.classList.add('active');
            }
        }
        
        // Search functionality
        function searchTable(inputElement, tableId) {
            const searchTerm = inputElement.value.toLowerCase();
            const table = document.getElementById(tableId);
            if (!table) return;
            
            const rows = table.getElementsByTagName('tr');
            
            for (let i = 1; i < rows.length; i++) { // Skip header row
                const row = rows[i];
                const cells = row.getElementsByTagName('td');
                let found = false;
                
                for (let j = 0; j < cells.length; j++) {
                    if (cells[j].textContent.toLowerCase().includes(searchTerm)) {
                        found = true;
                        break;
                    }
                }
                
                row.style.display = found ? '' : 'none';
            }
        }
        
        // Table generation functions that were missing
        function generateUsersStats(users) {
            const activeUsers = users.filter(user => user.is_active !== false).length;
            const resellers = users.filter(user => user.role === 'reseller').length;
            const admins = users.filter(user => user.role === 'admin').length;
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${users.length}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${activeUsers}</div>
                        <div class="stat-label">Active Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${resellers}</div>
                        <div class="stat-label">Resellers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${admins}</div>
                        <div class="stat-label">Admins</div>
                    </div>
                </div>
            \`;
        }
        
        function generateUsersTable(users) {
            return \`
                <table class="data-table" id="users-table">
                    <thead>
                        <tr>
            <th>Name</th>
            <th>Region</th>
            <th>Sub-Region</th>
            <th>Due Balance</th>
            <th>Revenue Contribution</th>
            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${users.map(user => \`
                            <tr>
                                <td><strong>\${user.name || 'Unknown'}</strong></td>
                                <td>\${user.region || 'N/A'}</td>
                                <td>\${user.sub_region || 'N/A'}</td>
                                <td>\${user.due_balance || 'N/A'}</td>
                                <td>\${user.total_revenue_generated || 'N/A'}</td>
                                <td>\${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateProductsStats(products) {
            const inStock = products.filter(p => p.availability === 'in-stock').length;
            const lowStock = products.filter(p => p.availability === 'low-stock').length;
            const outOfStock = products.filter(p => p.availability === 'out-of-stock').length;
            const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${products.length}</div>
                        <div class="stat-label">Total Products</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${inStock}</div>
                        <div class="stat-label">In Stock</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${lowStock}</div>
                        <div class="stat-label">Low Stock</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${outOfStock}</div>
                        <div class="stat-label">Out of Stock</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${totalValue.toLocaleString()}</div>
                        <div class="stat-label">Total Value</div>
                    </div>
                </div>
            \`;
        }
        
        function generateProductsTable(products) {
            return \`
                <table class="data-table" id="products-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Brand</th>
                            <th>Price</th>
                            <th>Availability</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${products.map(product => \`
                            <tr>
                                <td><strong>\${product.name || 'Unnamed Product'}</strong></td>
                                <td>\${product.category || 'Uncategorized'}</td>
                                <td>\${product.brand || 'N/A'}</td>
                                <td><strong>₹\${product.price || 0}</strong></td>
                                <td><span class="status-badge \${product.availability === 'in-stock' ? 'status-in-stock' : product.availability === 'low-stock' ? 'status-low-stock' : 'status-out-of-stock'}">\${product.availability || 'Unknown'}</span></td>
                                <td>\${product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateInventoryStats(data) {
            const inventoryTransactions = data.inventory_transactions || [];
            const goodsPurchases = data.goods_purchases || [];
            const clearances = data.clearances || [];
            
            const totalTransactions = inventoryTransactions.length;
            const totalPurchases = goodsPurchases.length;
            const totalClearances = clearances.length;
            
            const totalPurchaseValue = goodsPurchases.reduce((sum, purchase) => sum + (purchase.total_amount || purchase.amount || 0), 0);
            const totalClearanceValue = clearances.reduce((sum, clearance) => sum + (clearance.amount || clearance.value || 0), 0);
            
            // Calculate in/out transactions
            const inboundTransactions = inventoryTransactions.filter(t => t.type === 'in' || t.transaction_type === 'in').length;
            const outboundTransactions = inventoryTransactions.filter(t => t.type === 'out' || t.transaction_type === 'out').length;
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${totalTransactions}</div>
                        <div class="stat-label">Inventory Transactions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${inboundTransactions}</div>
                        <div class="stat-label">Inbound Movements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${outboundTransactions}</div>
                        <div class="stat-label">Outbound Movements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${totalPurchaseValue.toLocaleString()}</div>
                        <div class="stat-label">Total Purchase Value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${totalClearanceValue.toLocaleString()}</div>
                        <div class="stat-label">Total Clearance Value</div>
                    </div>
                </div>
            \`;
        }
        
        function generateInventoryTables(data) {
            let content = '';
            
            // Inventory Transactions Table
            if (data.inventory_transactions && data.inventory_transactions.length > 0) {
                content += \`
                    <h4 style="margin: 30px 0 15px 0; color: #374151;">📦 Inventory Transactions</h4>
                    <input type="text" class="search-box" placeholder="🔍 Search inventory transactions..." onkeyup="searchTable(this, 'inventory-transactions-table')">
                    <table class="data-table" id="inventory-transactions-table">
                        <thead>
                            <tr>
                                <th>Transaction ID</th>
                                <th>Product</th>
                                <th>Type</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Total Value</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${data.inventory_transactions.map(transaction => \`
                                <tr>
                                    <td><strong>#\${transaction.id || 'N/A'}</strong></td>
                                    <td>\${transaction.product_name || transaction.product_id || 'Unknown'}</td>
                                    <td><span class="status-badge \${transaction.type === 'in' || transaction.transaction_type === 'in' ? 'status-in-stock' : 'status-out-of-stock'}">\${transaction.type || transaction.transaction_type || 'N/A'}</span></td>
                                    <td>\${transaction.quantity || 0}</td>
                                    <td>₹\${transaction.unit_price || transaction.price || 0}</td>
                                    <td><span class="\${transaction.type === 'in' ? 'amount-positive' : 'amount-negative'}">₹\${(transaction.quantity || 0) * (transaction.unit_price || transaction.price || 0)}</span></td>
                                    <td>\${transaction.date ? new Date(transaction.date).toLocaleDateString() : transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            \`).join('')}
                        </tbody>
                    </table>
                \`;
            }
            
            // Goods Purchases Table
            if (data.goods_purchases && data.goods_purchases.length > 0) {
                content += \`
                    <h4 style="margin: 30px 0 15px 0; color: #374151;">🛍️ Goods Purchases</h4>
                    <input type="text" class="search-box" placeholder="🔍 Search purchases..." onkeyup="searchTable(this, 'goods-purchases-table')">
                    <table class="data-table" id="goods-purchases-table">
                        <thead>
                            <tr>
                                <th>Purchase ID</th>
                                <th>Vendor</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Payment Method</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${data.goods_purchases.map(purchase => \`
                                <tr>
                                    <td><strong>#\${purchase.id || 'N/A'}</strong></td>
                                    <td>\${purchase.vendor_name || purchase.vendor || 'Unknown'}</td>
                                    <td>\${purchase.description || purchase.note || 'N/A'}</td>
                                    <td><span class="amount-negative">₹\${purchase.total_amount || purchase.amount || 0}</span></td>
                                    <td>\${purchase.payment_method || 'N/A'}</td>
                                    <td>\${purchase.date ? new Date(purchase.date).toLocaleDateString() : purchase.created_at ? new Date(purchase.created_at).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            \`).join('')}
                        </tbody>
                    </table>
                \`;
            }
            
            return content;
        }
        
        function generateSalesTable(sales) {
            return \`
                <table class="data-table" id="sales-table">
                    <thead>
                        <tr>
                            <th>Sale ID</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Payment Method</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${sales.map(sale => \`
                            <tr>
                                <td><strong>#\${sale.id || 'N/A'}</strong></td>
                                <td>\${sale.customer_name || sale.customer_id || 'Unknown'}</td>
                                <td><span class="amount-positive">₹\${sale.total_amount || 0}</span></td>
                                <td>\${sale.payment_method || 'N/A'}</td>
                                <td><span class="status-badge status-active">\${sale.status || 'Completed'}</span></td>
                                <td>\${sale.date ? new Date(sale.date).toLocaleDateString() : sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateExpensesStats(expenses) {
            const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
            const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;
            const thisMonth = expenses.filter(expense => {
                const expenseDate = new Date(expense.date || expense.created_at);
                const now = new Date();
                return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
            });
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${expenses.length}</div>
                        <div class="stat-label">Total Expenses</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${totalExpenses.toLocaleString()}</div>
                        <div class="stat-label">Total Amount</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹\${avgExpense.toFixed(2)}</div>
                        <div class="stat-label">Average Expense</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${thisMonth.length}</div>
                        <div class="stat-label">This Month</div>
                    </div>
                </div>
            \`;
        }
        
        function generateExpensesTable(expenses) {
            return \`
                <table class="data-table" id="expenses-table">
                    <thead>
                        <tr>
                            <th>Expense ID</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Added By</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${expenses.map(expense => \`
                            <tr>
                                <td><strong>#\${expense.id || 'N/A'}</strong></td>
                                <td>\${expense.description || expense.title || 'No description'}</td>
                                <td>\${expense.category || 'Uncategorized'}</td>
                                <td><span class="amount-negative">-₹\${expense.amount || 0}</span></td>
                                <td>\${expense.date ? new Date(expense.date).toLocaleDateString() : expense.created_at ? new Date(expense.created_at).toLocaleDateString() : 'N/A'}</td>
                                <td>\${expense.added_by || 'System'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateTransactionsStats(transactions) {
            const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
            const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
            const netFlow = income - expenses;
            
            return \`
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">\${transactions.length}</div>
                        <div class="stat-label">Total Transactions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value amount-positive">₹\${income.toLocaleString()}</div>
                        <div class="stat-label">Total Income</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value amount-negative">₹\${expenses.toLocaleString()}</div>
                        <div class="stat-label">Total Expenses</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value \${netFlow >= 0 ? 'amount-positive' : 'amount-negative'}">₹\${Math.abs(netFlow).toLocaleString()}</div>
                        <div class="stat-label">Net \${netFlow >= 0 ? 'Income' : 'Loss'}</div>
                    </div>
                </div>
            \`;
        }
        
        function generateTransactionsTable(transactions) {
            return \`
                <table class="data-table" id="transactions-table">
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${transactions.map(transaction => \`
                            <tr>
                                <td><strong>#\${transaction.id || 'N/A'}</strong></td>
                                <td><span class="status-badge \${transaction.type === 'income' ? 'status-in-stock' : 'status-low-stock'}">\${transaction.type || 'N/A'}</span></td>
                                <td>\${transaction.description || transaction.title || 'No description'}</td>
                                <td><span class="\${transaction.type === 'income' ? 'amount-positive' : 'amount-negative'}">\${transaction.type === 'income' ? '+' : '-'}₹\${transaction.amount || 0}</span></td>
                                <td>\${transaction.date ? new Date(transaction.date).toLocaleDateString() : transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'N/A'}</td>
                                <td><span class="status-badge status-active">\${transaction.status || 'Completed'}</span></td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateInvestmentsTable(investments) {
            return \`
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Investment</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Current Value</th>
                            <th>Return</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${investments.map(investment => {
                            const returns = (investment.current_value || 0) - (investment.amount || 0);
                            return \`
                                <tr>
                                    <td><strong>\${investment.name || investment.title || 'Investment'}</strong></td>
                                    <td>\${investment.type || 'N/A'}</td>
                                    <td>₹\${investment.amount || 0}</td>
                                    <td>₹\${investment.current_value || 0}</td>
                                    <td><span class="\${returns >= 0 ? 'amount-positive' : 'amount-negative'}">\${returns >= 0 ? '+' : ''}₹\${returns.toFixed(2)}</span></td>
                                    <td>\${investment.date ? new Date(investment.date).toLocaleDateString() : investment.created_at ? new Date(investment.created_at).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            \`;
                        }).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateLoansTable(loans) {
            return \`
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Loan ID</th>
                            <th>Borrower</th>
                            <th>Amount</th>
                            <th>Interest Rate</th>
                            <th>Status</th>
                            <th>Due Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${loans.map(loan => \`
                            <tr>
                                <td><strong>#\${loan.id || 'N/A'}</strong></td>
                                <td>\${loan.borrower_name || loan.borrower || 'N/A'}</td>
                                <td>₹\${loan.amount || 0}</td>
                                <td>\${loan.interest_rate || 0}%</td>
                                <td><span class="status-badge \${loan.status === 'active' ? 'status-active' : loan.status === 'paid' ? 'status-in-stock' : 'status-out-of-stock'}">\${loan.status || 'N/A'}</span></td>
                                <td>\${loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        function generateRequestsTable(requests) {
            return \`
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Request ID</th>
                            <th>Customer</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${requests.map(request => \`
                            <tr>
                                <td><strong>#\${request.id || 'N/A'}</strong></td>
                                <td>\${request.customer_name || request.requester || 'N/A'}</td>
                                <td>\${request.type || request.request_type || 'N/A'}</td>
                                <td><span class="status-badge \${request.status === 'completed' ? 'status-in-stock' : request.status === 'pending' ? 'status-low-stock' : 'status-out-of-stock'}">\${request.status || 'N/A'}</span></td>
                                <td><span class="status-badge \${request.priority === 'high' ? 'status-out-of-stock' : request.priority === 'medium' ? 'status-low-stock' : 'status-in-stock'}">\${request.priority || 'low'}</span></td>
                                <td>\${request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
        }
        
        // Initialize first tab
        document.addEventListener('DOMContentLoaded', function() {
            const firstTab = document.querySelector('.nav-tab');
            if (firstTab) {
                firstTab.click();
            }

            // Add keyboard shortcuts for tab navigation
            document.addEventListener('keydown', function(e) {
                if (e.ctrlKey) {
                    const tabs = Array.from(document.querySelectorAll('.nav-tab'));
                    const activeTab = document.querySelector('.nav-tab.active');
                    const currentIndex = tabs.indexOf(activeTab);
                    
                    if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
                        tabs[currentIndex + 1].click();
                        e.preventDefault();
                    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                        tabs[currentIndex - 1].click();
                        e.preventDefault();
                    }
                }
            });
        });
    </script>
</body>
</html>`;
    } catch (error) {
      console.error('❌ Error generating HTML dashboard:', error);
      return `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error generating dashboard</h1><p>${error}</p></body></html>`;
    }
  }

  private static generateNavigationTabs(backupData: BackupData): string {
    const tabs = [];
    
    // Always show Finances overview if we have any financial data
    const hasFinancialData = (backupData.cash_transactions && backupData.cash_transactions.length > 0) ||
                           (backupData.expenses && backupData.expenses.length > 0) ||
                           (backupData.investments && backupData.investments.length > 0) ||
                           (backupData.loans && backupData.loans.length > 0) ||
                           (backupData.sales && backupData.sales.length > 0) ||
                           (backupData.inventory_transactions && backupData.inventory_transactions.length > 0) ||
                           (backupData.goods_purchases && backupData.goods_purchases.length > 0);
    
    if (hasFinancialData) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'finances\')">💰 Financial Overview</div>');
    }
    
    if (backupData.sales && backupData.sales.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'sales\')">🛒 Sales Analytics</div>');
    }
    
    if (backupData.users && backupData.users.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'users\')">👥 Users & Resellers</div>');
    }
    
    if (backupData.products && backupData.products.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'products\')">📦 Products</div>');
    }
    
    if (backupData.expenses && backupData.expenses.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'expenses\')">💸 Expenses</div>');
    }
    
    // Inventory Management Tab
    const hasInventoryData = (backupData.inventory_transactions && backupData.inventory_transactions.length > 0) ||
                           (backupData.goods_purchases && backupData.goods_purchases.length > 0) ||
                           (backupData.clearances && backupData.clearances.length > 0);
    
    if (hasInventoryData) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'inventory\')">📋 Inventory</div>');
    }
    
    if (backupData.cash_transactions && backupData.cash_transactions.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'transactions\')">💰 Cash Flow</div>');
    }
    
    if (backupData.investments && backupData.investments.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'investments\')">📈 Investments</div>');
    }
    
    if (backupData.loans && backupData.loans.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'loans\')">🏦 Loans</div>');
    }
    
    if (backupData.requests && backupData.requests.length > 0) {
      tabs.push('<div class="nav-tab" onclick="showTab(\'requests\')">📋 Requests</div>');
    }
    
    return tabs.join('');
  }

  private static generateTabContents(backupData: BackupData): string {
    const contents = [];
    
    // Financial Overview Tab - always first if financial data exists
    const hasFinancialData = (backupData.cash_transactions && backupData.cash_transactions.length > 0) ||
                           (backupData.expenses && backupData.expenses.length > 0) ||
                           (backupData.investments && backupData.investments.length > 0) ||
                           (backupData.loans && backupData.loans.length > 0) ||
                           (backupData.sales && backupData.sales.length > 0);
    
    if (hasFinancialData) {
      contents.push(`
        <div id="finances-content" class="tab-content">
          <div class="data-section">
            <h3>💰 Financial Overview & KPIs</h3>
            ${this.generateFinancialKPIs(backupData)}
            ${this.generateFinancialBreakdown(backupData)}
          </div>
        </div>
      `);
    }
    
    // Sales Analytics Tab
    if (backupData.sales && backupData.sales.length > 0) {
      contents.push(`
        <div id="sales-content" class="tab-content">
          <div class="data-section">
            <h3>🛒 Sales Analytics & Performance</h3>
            ${this.generateSalesKPIs(backupData.sales, backupData.products)}
            <input type="text" class="search-box" placeholder="🔍 Search sales..." onkeyup="searchTable(this, 'sales-table')">
            ${this.generateSalesTable(backupData.sales)}
          </div>
        </div>
      `);
    }
    
    // Users & Resellers Tab
    if (backupData.users && backupData.users.length > 0) {
      contents.push(`
        <div id="users-content" class="tab-content">
          <div class="data-section">
            <h3>👥 Users & Resellers Database</h3>
            ${this.generateUsersStats(backupData.users)}
            <input type="text" class="search-box" placeholder="🔍 Search users..." onkeyup="searchTable(this, 'users-table')">
            ${this.generateUsersTable(backupData.users)}
          </div>
        </div>
      `);
    }
    
    // Products Tab
    if (backupData.products && backupData.products.length > 0) {
      contents.push(`
        <div id="products-content" class="tab-content">
          <div class="data-section">
            <h3>📦 Products Catalog</h3>
            ${this.generateProductsStats(backupData.products)}
            <input type="text" class="search-box" placeholder="🔍 Search products..." onkeyup="searchTable(this, 'products-table')">
            ${this.generateProductsTable(backupData.products)}
          </div>
        </div>
      `);
    }
    
    // Expenses Tab
    if (backupData.expenses && backupData.expenses.length > 0) {
      contents.push(`
        <div id="expenses-content" class="tab-content">
          <div class="data-section">
            <h3>💸 Expenses Tracking</h3>
            ${this.generateExpensesStats(backupData.expenses)}
            <input type="text" class="search-box" placeholder="🔍 Search expenses..." onkeyup="searchTable(this, 'expenses-table')">
            ${this.generateExpensesTable(backupData.expenses)}
          </div>
        </div>
      `);
    }
    
    // Inventory Management Tab
    const hasInventoryData = (backupData.inventory_transactions && backupData.inventory_transactions.length > 0) ||
                           (backupData.goods_purchases && backupData.goods_purchases.length > 0) ||
                           (backupData.clearances && backupData.clearances.length > 0);
    
    if (hasInventoryData) {
      contents.push(`
        <div id="inventory-content" class="tab-content">
          <div class="data-section">
            <h3>📋 Inventory Management</h3>
            ${this.generateInventoryStats(backupData)}
            ${this.generateInventoryTables(backupData)}
          </div>
        </div>
      `);
    }
    
    // Cash Transactions Tab
    if (backupData.cash_transactions && backupData.cash_transactions.length > 0) {
      contents.push(`
        <div id="transactions-content" class="tab-content">
          <div class="data-section">
            <h3>💰 Cash Flow Records</h3>
            ${this.generateTransactionsStats(backupData.cash_transactions)}
            <input type="text" class="search-box" placeholder="🔍 Search transactions..." onkeyup="searchTable(this, 'transactions-table')">
            ${this.generateTransactionsTable(backupData.cash_transactions)}
          </div>
        </div>
      `);
    }
    
    // Other tabs for remaining data types
    if (backupData.investments && backupData.investments.length > 0) {
      contents.push(`
        <div id="investments-content" class="tab-content">
          <div class="data-section">
            <h3>📈 Investment Portfolio</h3>
            ${this.generateInvestmentsTable(backupData.investments)}
          </div>
        </div>
      `);
    }
    
    if (backupData.loans && backupData.loans.length > 0) {
      contents.push(`
        <div id="loans-content" class="tab-content">
          <div class="data-section">
            <h3>🏦 Loans Management</h3>
            ${this.generateLoansTable(backupData.loans)}
          </div>
        </div>
      `);
    }
    
    if (backupData.requests && backupData.requests.length > 0) {
      contents.push(`
        <div id="requests-content" class="tab-content">
          <div class="data-section">
            <h3>📋 Customer Requests</h3>
            ${this.generateRequestsTable(backupData.requests)}
          </div>
        </div>
      `);
    }
    
    return contents.join('');
  }

  private static generateUsersStats(users: any[]): string {
    const activeUsers = users.filter(user => user.is_active !== false).length;
    const resellers = users.filter(user => user.role === 'reseller').length;
    const admins = users.filter(user => user.role === 'admin').length;
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${users.length}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activeUsers}</div>
          <div class="stat-label">Active Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${resellers}</div>
          <div class="stat-label">Resellers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${admins}</div>
          <div class="stat-label">Admins</div>
        </div>
      </div>
    `;
  }

  private static generateFinancialKPIs(backupData: BackupData): string {
    // Calculate financial KPIs across all data sources
    const salesRevenue = (backupData.sales || []).reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const totalExpenses = (backupData.expenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const cashInflow = (backupData.cash_transactions || [])
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const cashOutflow = (backupData.cash_transactions || [])
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const investmentValue = (backupData.investments || []).reduce((sum, inv) => sum + (inv.current_value || inv.amount || 0), 0);
    const loansOutstanding = (backupData.loans || [])
      .filter(loan => loan.status === 'active')
      .reduce((sum, loan) => sum + (loan.amount || 0), 0);
    
    // Include inventory costs
    const inventoryPurchases = (backupData.goods_purchases || []).reduce((sum, purchase) => sum + (purchase.total_amount || purchase.amount || 0), 0);
    const inventoryClearances = (backupData.clearances || []).reduce((sum, clearance) => sum + (clearance.value || clearance.amount || 0), 0);
    
    const totalRevenue = salesRevenue + cashInflow;
    const totalCosts = totalExpenses + cashOutflow + inventoryPurchases + inventoryClearances;
    const netIncome = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue * 100) : 0;
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value amount-positive">₹${totalRevenue.toLocaleString()}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-negative">₹${totalCosts.toLocaleString()}</div>
          <div class="stat-label">Total Costs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${netIncome >= 0 ? 'amount-positive' : 'amount-negative'}">₹${Math.abs(netIncome).toLocaleString()}</div>
          <div class="stat-label">Net ${netIncome >= 0 ? 'Profit' : 'Loss'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${profitMargin >= 0 ? 'amount-positive' : 'amount-negative'}">${profitMargin.toFixed(1)}%</div>
          <div class="stat-label">Profit Margin</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">₹${investmentValue.toLocaleString()}</div>
          <div class="stat-label">Investment Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-negative">₹${loansOutstanding.toLocaleString()}</div>
          <div class="stat-label">Loans Outstanding</div>
        </div>
      </div>
    `;
  }

  private static generateFinancialBreakdown(backupData: BackupData): string {
    const salesCount = (backupData.sales || []).length;
    const expensesCount = (backupData.expenses || []).length;
    const transactionsCount = (backupData.cash_transactions || []).length;
    const investmentsCount = (backupData.investments || []).length;
    const loansCount = (backupData.loans || []).length;
    const inventoryTransactionsCount = (backupData.inventory_transactions || []).length;
    const goodsPurchasesCount = (backupData.goods_purchases || []).length;
    const clearancesCount = (backupData.clearances || []).length;
    
    return `
      <div style="margin-top: 30px;">
        <h4 style="margin-bottom: 20px; color: #374151;">📊 Financial Data Breakdown</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${salesCount}</div>
            <div class="stat-label">Sales Records</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${expensesCount}</div>
            <div class="stat-label">Expense Entries</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${transactionsCount}</div>
            <div class="stat-label">Cash Transactions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${inventoryTransactionsCount}</div>
            <div class="stat-label">Inventory Moves</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${goodsPurchasesCount}</div>
            <div class="stat-label">Goods Purchases</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${investmentsCount}</div>
            <div class="stat-label">Investments</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${loansCount}</div>
            <div class="stat-label">Loan Records</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${clearancesCount}</div>
            <div class="stat-label">Clearances</div>
          </div>
        </div>
      </div>
    `;
  }

  private static generateSalesKPIs(sales: any[], _products?: any[]): string {
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;
    
    // Calculate time-based metrics
    const now = new Date();
    const thisMonth = sales.filter(sale => {
      const saleDate = new Date(sale.date || sale.created_at);
      return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
    });
    
    const lastMonth = sales.filter(sale => {
      const saleDate = new Date(sale.date || sale.created_at);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return saleDate.getMonth() === lastMonthDate.getMonth() && saleDate.getFullYear() === lastMonthDate.getFullYear();
    });
    
    const thisMonthRevenue = thisMonth.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const lastMonthRevenue = lastMonth.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const monthlyGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
    
    // Calculate top-selling periods
    const salesByDay = new Map();
    sales.forEach(sale => {
      const day = new Date(sale.date || sale.created_at).toDateString();
      salesByDay.set(day, (salesByDay.get(day) || 0) + (sale.total_amount || 0));
    });
    const bestDay = Array.from(salesByDay.entries()).sort((a, b) => b[1] - a[1])[0];
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${sales.length}</div>
          <div class="stat-label">Total Sales</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-positive">₹${totalRevenue.toLocaleString()}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">₹${avgSale.toFixed(2)}</div>
          <div class="stat-label">Average Sale Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${thisMonth.length}</div>
          <div class="stat-label">Sales This Month</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-positive">₹${thisMonthRevenue.toLocaleString()}</div>
          <div class="stat-label">Monthly Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${monthlyGrowth >= 0 ? 'amount-positive' : 'amount-negative'}">${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth.toFixed(1)}%</div>
          <div class="stat-label">Monthly Growth</div>
        </div>
        ${bestDay ? `
        <div class="stat-card" style="grid-column: span 2;">
          <div class="stat-value amount-positive">₹${bestDay[1].toLocaleString()}</div>
          <div class="stat-label">Best Sales Day: ${new Date(bestDay[0]).toLocaleDateString()}</div>
        </div>
        ` : ''}
      </div>
    `;
  }

  private static generateUsersTable(users: any[]): string {
    return `
      <table class="data-table" id="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Region</th>
            <th>Sub-Region</th>
            <th>Due Balance</th>
            <th>Revenue Contribution</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><strong>${user.first_name || user.name || 'Unknown'} ${user.last_name || ''}</strong></td>
              <td>${user.region || 'N/A'}  </td>
              <td>${user.sub_region || 'N/A'}  </td>
              <td>${user.due_balance || "N/A"}</td>
              <td>${user.total_revenue_generated || "N/A"}</td>
              <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateProductsStats(products: any[]): string {
    const inStock = products.filter(p => p.availability === 'in-stock').length;
    const lowStock = products.filter(p => p.availability === 'low-stock').length;
    const outOfStock = products.filter(p => p.availability === 'out-of-stock').length;
    const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${products.length}</div>
          <div class="stat-label">Total Products</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${inStock}</div>
          <div class="stat-label">In Stock</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${lowStock}</div>
          <div class="stat-label">Low Stock</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${outOfStock}</div>
          <div class="stat-label">Out of Stock</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">₹${totalValue.toLocaleString()}</div>
          <div class="stat-label">Total Value</div>
        </div>
      </div>
    `;
  }

  private static generateProductsTable(products: any[]): string {
    return `
      <table class="data-table" id="products-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Brand</th>
            <th>Price</th>
            <th>Availability</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(product => `
            <tr>
              <td><strong>${product.name || 'Unnamed Product'}</strong></td>
              <td>${product.category || 'Uncategorized'}</td>
              <td>${product.brand || 'N/A'}</td>
              <td><strong>₹${product.price || 0}</strong></td>
              <td><span class="status-badge ${product.availability === 'in-stock' ? 'status-in-stock' : product.availability === 'low-stock' ? 'status-low-stock' : 'status-out-of-stock'}">${product.availability || 'Unknown'}</span></td>
              <td>${product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateSalesTable(sales: any[]): string {
    return `
      <table class="data-table" id="sales-table">
        <thead>
          <tr>
            <th>Sale ID</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map(sale => `
            <tr>
              <td><strong>#${sale.id || 'N/A'}</strong></td>
              <td>${sale.users ? `${sale.users.first_name} ${sale.users.last_name}` : (sale.customer_name || '-')}</td>
              <td><span class="amount-positive">₹${sale.total_amount || 0}</span></td>
              <td><span class="status-badge status-active">${sale.status || 'Completed'}</span></td>
              <td>${sale.date ? new Date(sale.date).toLocaleDateString() : sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateExpensesStats(expenses: any[]): string {
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;
    const thisMonth = expenses.filter(expense => {
      const expenseDate = new Date(expense.date || expense.created_at);
      const now = new Date();
      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    });
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${expenses.length}</div>
          <div class="stat-label">Total Expenses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">₹${totalExpenses.toLocaleString()}</div>
          <div class="stat-label">Total Amount</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">₹${avgExpense.toFixed(2)}</div>
          <div class="stat-label">Average Expense</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${thisMonth.length}</div>
          <div class="stat-label">This Month</div>
        </div>
      </div>
    `;
  }

  private static generateExpensesTable(expenses: any[]): string {
    return `
      <table class="data-table" id="expenses-table">
        <thead>
          <tr>
            <th>Expense ID</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Added By</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map(expense => `
            <tr>
              <td><strong>#${expense.id || 'N/A'}</strong></td>
              <td>${expense.description || expense.title || 'No description'}</td>
              <td>${expense.category || 'Uncategorized'}</td>
              <td><span class="amount-negative">-₹${expense.amount || 0}</span></td>
              <td>${expense.date ? new Date(expense.date).toLocaleDateString() : expense.created_at ? new Date(expense.created_at).toLocaleDateString() : 'N/A'}</td>
              <td>${expense.added_by || 'System'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateTransactionsStats(transactions: any[]): string {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netFlow = income - expenses;
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${transactions.length}</div>
          <div class="stat-label">Total Transactions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-positive">₹${income.toLocaleString()}</div>
          <div class="stat-label">Total Income</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-negative">₹${expenses.toLocaleString()}</div>
          <div class="stat-label">Total Expenses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${netFlow >= 0 ? 'amount-positive' : 'amount-negative'}">₹${Math.abs(netFlow).toLocaleString()}</div>
          <div class="stat-label">Net ${netFlow >= 0 ? 'Income' : 'Loss'}</div>
        </div>
      </div>
    `;
  }

  private static generateTransactionsTable(transactions: any[]): string {
    return `
      <table class="data-table" id="transactions-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(transaction => `
            <tr>
              <td><strong>#${transaction.id || 'N/A'}</strong></td>
              <td><span class="status-badge ${transaction.type === 'income' ? 'status-in-stock' : 'status-low-stock'}">${transaction.type || 'N/A'}</span></td>
              <td>${transaction.description || transaction.title || 'No description'}</td>
              <td><span class="${transaction.type === 'income' ? 'amount-positive' : 'amount-negative'}">${transaction.type === 'income' ? '+' : '-'}₹${transaction.amount || 0}</span></td>
              <td>${transaction.date ? new Date(transaction.date).toLocaleDateString() : transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'N/A'}</td>
              <td><span class="status-badge status-active">${transaction.status || 'Completed'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateInvestmentsTable(investments: any[]): string {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Investment</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Current Value</th>
            <th>Return</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${investments.map(investment => {
            const returns = (investment.current_value || 0) - (investment.amount || 0);
            return `
              <tr>
                <td><strong>${investment.name || investment.title || 'Investment'}</strong></td>
                <td>${investment.type || 'N/A'}</td>
                <td>₹${investment.amount || 0}</td>
                <td>₹${investment.current_value || 0}</td>
                <td><span class="${returns >= 0 ? 'amount-positive' : 'amount-negative'}">${returns >= 0 ? '+' : ''}₹${returns.toFixed(2)}</span></td>
                <td>${investment.date ? new Date(investment.date).toLocaleDateString() : investment.created_at ? new Date(investment.created_at).toLocaleDateString() : 'N/A'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateLoansTable(loans: any[]): string {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Loan ID</th>
            <th>Borrower</th>
            <th>Amount</th>
            <th>Interest Rate</th>
            <th>Status</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${loans.map(loan => `
            <tr>
              <td><strong>#${loan.id || 'N/A'}</strong></td>
              <td>${loan.borrower_name || loan.borrower || 'N/A'}</td>
              <td>₹${loan.amount || 0}</td>
              <td>${loan.interest_rate || 0}%</td>
              <td><span class="status-badge ${loan.status === 'active' ? 'status-active' : loan.status === 'paid' ? 'status-in-stock' : 'status-out-of-stock'}">${loan.status || 'N/A'}</span></td>
              <td>${loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static generateRequestsTable(requests: any[]): string {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map(request => `
            <tr>
              <td><strong>#${request.id || 'N/A'}</strong></td>
              <td>${request.customer_name || request.requester || 'N/A'}</td>
              <td>${request.type || request.request_type || 'N/A'}</td>
              <td><span class="status-badge ${request.status === 'completed' ? 'status-in-stock' : request.status === 'pending' ? 'status-low-stock' : 'status-out-of-stock'}">${request.status || 'N/A'}</span></td>
              <td><span class="status-badge ${request.priority === 'high' ? 'status-out-of-stock' : request.priority === 'medium' ? 'status-low-stock' : 'status-in-stock'}">${request.priority || 'low'}</span></td>
              <td>${request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private static downloadVisualization(data: FullBackup, filename: string): void {
    try {
      console.log('🎨 Generating HTML dashboard content...');
      const htmlContent = this.generateEnhancedDashboardHTML(data);
      console.log(`📄 HTML content generated: ${htmlContent.length} characters`);
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      console.log(`📦 Blob created: ${blob.size} bytes`);
      
      const url = URL.createObjectURL(blob);
      console.log(`🔗 Blob URL created: ${url}`);
      
      const downloadFilename = filename.replace('.json', '-dashboard.html');
      console.log(`💾 Download filename: ${downloadFilename}`);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      a.style.display = 'none';
      
      console.log('🖱️ Triggering download...');
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
      
      // Clean up URL after download
      setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log('✅ HTML dashboard download completed');
      }, 100);
      
    } catch (error) {
      console.error('❌ Error downloading HTML dashboard:', error);
    }
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public static async exportFullBackup(): Promise<void> {
    // Show format selection popup
    BackupSystem.showFormatSelectionPopup();
  }


  private static async runFullBackupExport(formats: string[]): Promise<void> {
    console.log('🚀 Starting comprehensive backup export with enhanced dashboard...');
    try {
      const backupData: BackupData = {};
      let totalRecords = 0;
      let successfulTables = 0;
      for (const tableName of BACKUP_TABLES) {
        const { data, count } = await this.fetchTableData(tableName);
        if (data && data.length > 0) {
          backupData[tableName] = data;
          totalRecords += count;
          successfulTables++;
        }
      }
      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        exportedAt: new Date().toLocaleString(),
        version: '2.0.0',
        tableCount: successfulTables,
        totalRecords
      };
      const fullBackup: FullBackup = {
        metadata,
        data: backupData
      };
      const jsonString = JSON.stringify(fullBackup);
      const fileSize = new Blob([jsonString]).size;
      const filename = this.generateFileName();
      // Download selected files by name
      if (formats.includes('dashboard_html')) {
        this.downloadVisualization(fullBackup, filename);
      }
      if (formats.includes('full_json')) {
        this.downloadAsJSON(fullBackup, filename);
      }
      if (formats.includes('products_csv') && backupData.products) {
        this.downloadAsCSV(backupData.products, filename, 'Products');
      }
      if (formats.includes('sales_csv') && backupData.sales) {
        this.downloadAsCSV(backupData.sales, filename, 'Sales');
      }
      if (formats.includes('expenses_csv') && backupData.expenses) {
        this.downloadAsCSV(backupData.expenses, filename, 'Expenses');
      }
      if (formats.includes('users_csv') && backupData.users) {
        this.downloadAsCSV(backupData.users, filename, 'Users');
      }
      if (formats.includes('inventory_csv') && backupData.inventory_transactions) {
        this.downloadAsCSV(backupData.inventory_transactions, filename, 'Inventory');
      }
      // Add more file types as needed
      this.showEnhancedBackupNotification(metadata, filename, fileSize);
    } catch (error) {
      console.error('❌ Enhanced backup failed:', error);
      this.showErrorNotification(error);
    }
  }

  private static showFormatSelectionPopup(): void {
    // File options for selection
    const fileOptions = [
      { label: 'Dashboard.html', value: 'dashboard_html', checked: true, icon: '📊' },
      { label: 'FullBackup.json', value: 'full_json', checked: true, icon: '🗄️' },
      { label: 'Products.csv', value: 'products_csv', checked: false, icon: '📦' },
      { label: 'Sales.csv', value: 'sales_csv', checked: false, icon: '🛒' },
      { label: 'Expenses.csv', value: 'expenses_csv', checked: false, icon: '💸' },
      { label: 'Users.csv', value: 'users_csv', checked: false, icon: '👤' },
      { label: 'Inventory.csv', value: 'inventory_csv', checked: false, icon: '📋' }
    ];
    // Modal theme (dark mode)
    const modal = document.createElement('div');
    modal.id = 'backup-format-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(15,23,42,0.85)';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <style>
        @media (max-width: 600px) {
          #backup-format-modal .backup-modal-content {
            max-width: 98vw !important;
            margin: 24px auto !important;
            padding: 18px 8vw !important;
          }
        }
        .custom-checkbox {
          position: relative;
          width: 22px;
          height: 22px;
          margin-right: 14px;
        }
        .custom-checkbox input[type="checkbox"] {
          opacity: 0;
          width: 22px;
          height: 22px;
          position: absolute;
          left: 0;
          top: 0;
          cursor: pointer;
        }
        .custom-checkbox .checkmark {
          position: absolute;
          left: 0;
          top: 0;
          width: 22px;
          height: 22px;
          background: #0f172a;
          border: 2px solid #2563eb;
          border-radius: 7px;
          transition: box-shadow 0.2s;
        }
        .custom-checkbox input[type="checkbox"]:checked ~ .checkmark {
          background: #2563eb;
          box-shadow: 0 0 0 2px #1e40af;
        }
        .custom-checkbox .checkmark:after {
          content: '';
          position: absolute;
          display: none;
        }
        .custom-checkbox input[type="checkbox"]:checked ~ .checkmark:after {
          display: block;
        }
        .custom-checkbox .checkmark:after {
          left: 6px;
          top: 2px;
          width: 7px;
          height: 13px;
          border: solid #fff;
          border-width: 0 3px 3px 0;
          transform: rotate(45deg);
        }
      </style>
      <div class="backup-modal-content" style="background: #1e293b; max-width: 420px; margin: 80px auto; padding: 32px 28px; border-radius: 16px; box-shadow: 0 4px 32px #000a; border: 1px solid #334155; font-family: 'Segoe UI', Roboto, sans-serif;">
        <h2 style="margin-bottom: 18px; font-size: 1.35rem; color: #f1f5f9; font-weight: 600; letter-spacing: 0.01em;">Select Files to Download</h2>
        <form id="backup-format-form">
          <div style="margin-bottom: 18px;">
            ${fileOptions.map(opt => `
              <label style='display:flex;align-items:center;margin-bottom:12px;padding:8px 0;border-radius:8px;transition:background 0.2s;background:transparent;color:#e2e8f0;'>
                <span class="custom-checkbox">
                  <input type='checkbox' name='file' value='${opt.value}' ${opt.checked ? 'checked' : ''}>
                  <span class="checkmark"></span>
                </span>
                <span style='font-size:1.08em;color:#f1f5f9;'>${opt.icon} <strong>${opt.label}</strong></span>
              </label>
            `).join('')}
          </div>
        </form>
        <div style="margin-top: 18px; text-align: right;">
          <button id="backup-format-cancel" style="margin-right: 12px; padding: 7px 22px; background: #334155; color: #e2e8f0; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">Cancel</button>
          <button id="backup-format-download" style="padding: 7px 22px; background: linear-gradient(90deg,#2563eb,#1e40af); color: #fff; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">Download Selected</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('backup-format-cancel')!.onclick = () => {
      document.body.removeChild(modal);
    };
    document.getElementById('backup-format-download')!.onclick = async () => {
      const form = document.getElementById('backup-format-form') as HTMLFormElement;
      const selected: string[] = Array.from(form.querySelectorAll('input[name="file"]:checked')).map((el: any) => el.value);
      document.body.removeChild(modal);
      await BackupSystem.runFullBackupExport(selected);
    };
  }

  private static showEnhancedBackupNotification(metadata: BackupMetadata, filename: string, fileSize: number): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 20px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 450px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    notification.innerHTML = `
      <div style="font-weight: 700; font-size: 16px; margin-bottom: 12px;">🚀 Enhanced Backup Complete!</div>
      <div style="margin-bottom: 6px;"><strong>📊 Analytics Dashboard:</strong> Interactive charts & insights</div>
      <div style="margin-bottom: 6px;"><strong>📁 ${metadata.tableCount} data sources</strong> • <strong>${metadata.totalRecords.toLocaleString()} records</strong></div>
      <div style="margin-bottom: 6px;"><strong>💾 Size:</strong> ${this.formatBytes(fileSize)}</div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 12px; opacity: 0.9;">
        <div>📊 ${filename.replace('.json', '-dashboard.html')}</div>
        <div>📄 ${filename}</div>
        <div>📋 Individual CSV exports</div>
      </div>
    `;

    document.body.appendChild(notification);

    // Remove notification after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }

  private static showErrorNotification(error: any): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">❌ Backup Failed</div>
      <div style="font-size: 12px; opacity: 0.9;">${error.message || 'Unknown error occurred'}</div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // Quick backup methods for specific data types
  public static async exportFinancialData(): Promise<void> {
    console.log('💰 Exporting financial data with enhanced analytics...');
    
    try {
      const financialTables = ['cash_transactions', 'investments', 'loans', 'loan_payments', 'expenses', 'company_balance'];
      const backupData: BackupData = {};
      let totalRecords = 0;

      for (const tableName of financialTables) {
        const { data, count } = await this.fetchTableData(tableName);
        if (data && data.length > 0) {
          backupData[tableName as keyof BackupData] = data;
          totalRecords += count;
        }
      }

      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        exportedAt: new Date().toLocaleString(),
        version: '2.0.0-financial',
        tableCount: Object.keys(backupData).length,
        totalRecords
      };

      const fullBackup: FullBackup = { metadata, data: backupData };
      const filename = `blessin-financial-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
      
      this.downloadAsJSON(fullBackup, filename);
      this.downloadVisualization(fullBackup, filename);
      
      console.log(`✅ Financial data export completed: ${filename}`);
    } catch (error) {
      console.error('❌ Financial data export failed:', error);
    }
  }

  public static async exportSalesData(): Promise<void> {
    console.log('🛒 Exporting sales data with performance analytics...');
    
    try {
      const salesTables = ['sales', 'products', 'requests', 'product_request_items'];
      const backupData: BackupData = {};
      let totalRecords = 0;

      for (const tableName of salesTables) {
        const { data, count } = await this.fetchTableData(tableName);
        if (data && data.length > 0) {
          backupData[tableName as keyof BackupData] = data;
          totalRecords += count;
        }
      }

      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        exportedAt: new Date().toLocaleString(),
        version: '2.0.0-sales',
        tableCount: Object.keys(backupData).length,
        totalRecords
      };

      const fullBackup: FullBackup = { metadata, data: backupData };
      const filename = `blessin-sales-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
      
      this.downloadAsJSON(fullBackup, filename);
      this.downloadVisualization(fullBackup, filename);
      
      console.log(`✅ Sales data export completed: ${filename}`);
    } catch (error) {
      console.error('❌ Sales data export failed:', error);
    }
  }

  // Inventory Management Methods
  private static generateInventoryStats(backupData: BackupData): string {
    const inventoryTransactions = backupData.inventory_transactions || [];
    const goodsPurchases = backupData.goods_purchases || [];
    const clearances = backupData.clearances || [];
    
    const totalTransactions = inventoryTransactions.length;
    const totalPurchases = goodsPurchases.length;
    const totalClearances = clearances.length;
    
    const totalPurchaseValue = goodsPurchases.reduce((sum, purchase) => sum + (purchase.total_amount || purchase.amount || 0), 0);
    const totalClearanceValue = clearances.reduce((sum, clearance) => sum + (clearance.amount || clearance.value || 0), 0);
    
    // Calculate in/out transactions
    const inboundTransactions = inventoryTransactions.filter(t => t.type === 'in' || t.transaction_type === 'in').length;
    const outboundTransactions = inventoryTransactions.filter(t => t.type === 'out' || t.transaction_type === 'out').length;
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalTransactions}</div>
          <div class="stat-label">Inventory Transactions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${inboundTransactions}</div>
          <div class="stat-label">Inbound Movements</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${outboundTransactions}</div>
          <div class="stat-label">Outbound Movements</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalPurchases}</div>
          <div class="stat-label">Goods Purchases</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-positive">₹${totalPurchaseValue.toLocaleString()}</div>
          <div class="stat-label">Purchase Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalClearances}</div>
          <div class="stat-label">Clearances</div>
        </div>
        <div class="stat-card">
          <div class="stat-value amount-negative">₹${totalClearanceValue.toLocaleString()}</div>
          <div class="stat-label">Clearance Value</div>
        </div>
      </div>
    `;
  }

  private static generateInventoryTables(backupData: BackupData): string {
    let content = '';
    
    // Inventory Transactions Table
    if (backupData.inventory_transactions && backupData.inventory_transactions.length > 0) {
      content += `
        <h4 style="margin: 30px 0 15px 0; color: #374151;">📦 Inventory Transactions</h4>
        <input type="text" class="search-box" placeholder="🔍 Search inventory transactions..." onkeyup="searchTable(this, 'inventory-transactions-table')">
        <table class="data-table" id="inventory-transactions-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Product</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total Value</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${backupData.inventory_transactions.map(transaction => `
              <tr>
                <td><strong>#${transaction.id || 'N/A'}</strong></td>
                <td>${transaction.product_name || transaction.product_id || 'Unknown'}</td>
                <td><span class="status-badge ${transaction.type === 'in' || transaction.transaction_type === 'in' ? 'status-in-stock' : 'status-out-of-stock'}">${transaction.type || transaction.transaction_type || 'N/A'}</span></td>
                <td>${transaction.quantity || 0}</td>
                <td>₹${transaction.unit_price || transaction.price || 0}</td>
                <td><span class="${transaction.type === 'in' ? 'amount-positive' : 'amount-negative'}">₹${(transaction.quantity || 0) * (transaction.unit_price || transaction.price || 0)}</span></td>
                <td>${transaction.date ? new Date(transaction.date).toLocaleDateString() : transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Goods Purchases Table
    if (backupData.goods_purchases && backupData.goods_purchases.length > 0) {
      content += `
        <h4 style="margin: 30px 0 15px 0; color: #374151;">🛒 Goods Purchases</h4>
        <input type="text" class="search-box" placeholder="🔍 Search purchases..." onkeyup="searchTable(this, 'purchases-table')">
        <table class="data-table" id="purchases-table">
          <thead>
            <tr>
              <th>Purchase ID</th>
              <th>Supplier</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Payment Status</th>
              <th>Purchase Date</th>
            </tr>
          </thead>
          <tbody>
            ${backupData.goods_purchases.map(purchase => `
              <tr>
                <td><strong>#${purchase.id || 'N/A'}</strong></td>
                <td>${purchase.supplier_name || purchase.supplier || 'Unknown'}</td>
                <td>${purchase.items_count || purchase.total_items || 'N/A'}</td>
                <td><span class="amount-negative">₹${purchase.total_amount || purchase.amount || 0}</span></td>
                <td><span class="status-badge ${purchase.payment_status === 'paid' ? 'status-in-stock' : purchase.payment_status === 'pending' ? 'status-low-stock' : 'status-out-of-stock'}">${purchase.payment_status || purchase.status || 'N/A'}</span></td>
                <td>${purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString() : purchase.created_at ? new Date(purchase.created_at).toLocaleDateString() : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Clearances Table
    if (backupData.clearances && backupData.clearances.length > 0) {
      content += `
        <h4 style="margin: 30px 0 15px 0; color: #374151;">🗑️ Inventory Clearances</h4>
        <input type="text" class="search-box" placeholder="🔍 Search clearances..." onkeyup="searchTable(this, 'clearances-table')">
        <table class="data-table" id="clearances-table">
          <thead>
            <tr>
              <th>Clearance ID</th>
              <th>Product</th>
              <th>Reason</th>
              <th>Quantity Cleared</th>
              <th>Value Lost</th>
              <th>Date</th>
              <th>Approved By</th>
            </tr>
          </thead>
          <tbody>
            ${backupData.clearances.map(clearance => `
              <tr>
                <td><strong>#${clearance.id || 'N/A'}</strong></td>
                <td>${clearance.product_name || clearance.product_id || 'Unknown'}</td>
                <td><span class="status-badge status-out-of-stock">${clearance.reason || clearance.clearance_reason || 'N/A'}</span></td>
                <td>${clearance.quantity || clearance.quantity_cleared || 0}</td>
                <td><span class="amount-negative">-₹${clearance.value || clearance.amount || 0}</span></td>
                <td>${clearance.clearance_date ? new Date(clearance.clearance_date).toLocaleDateString() : clearance.created_at ? new Date(clearance.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>${clearance.approved_by || clearance.user_name || 'System'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    return content;
  }
}

// Event listeners for backup commands
if (typeof window !== 'undefined') {
  window.addEventListener('backup-all-data', () => {
    BackupSystem.exportFullBackup();
  });

  window.addEventListener('backup-financial-data', () => {
    BackupSystem.exportFinancialData();
  });

  window.addEventListener('backup-sales-data', () => {
    BackupSystem.exportSalesData();
  });
}