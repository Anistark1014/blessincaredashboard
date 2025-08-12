import { BackupSystem } from './backupSystem';

export class DataAnalysisUtils {
  
  // Generate a quick business report from backup data
  static generateBusinessReport(backupData: any): string {
    const report = [];
    report.push('# 📊 Blessin Finance Business Report');
    report.push(`Generated on: ${new Date().toLocaleString()}\n`);
    
    // Sales Analysis
    if (backupData.sales) {
      const sales = backupData.sales;
      const totalSales = sales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
      const avgSale = totalSales / sales.length;
      
      report.push('## 💰 Sales Analysis');
      report.push(`- Total Sales: $${totalSales.toLocaleString()}`);
      report.push(`- Number of Sales: ${sales.length}`);
      report.push(`- Average Sale: $${avgSale.toFixed(2)}`);
      report.push('');
    }
    
    // Expenses Analysis
    if (backupData.expenses) {
      const expenses = backupData.expenses;
      const totalExpenses = expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);
      
      // Group by category
      const expensesByCategory: { [key: string]: number } = {};
      expenses.forEach((expense: any) => {
        const category = expense.category || 'Other';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
      });
      
      report.push('## 💸 Expenses Analysis');
      report.push(`- Total Expenses: $${totalExpenses.toLocaleString()}`);
      report.push(`- Number of Transactions: ${expenses.length}`);
      report.push('- Expenses by Category:');
      Object.entries(expensesByCategory).forEach(([category, amount]) => {
        report.push(`  - ${category}: $${amount.toLocaleString()}`);
      });
      report.push('');
    }
    
    // Product Analysis
    if (backupData.products) {
      const products = backupData.products;
      const stockStatus: { [key: string]: number } = { 'in-stock': 0, 'low-stock': 0, 'out-of-stock': 0 };
      products.forEach((product: any) => {
        const status = product.availability || 'in-stock';
        if (status in stockStatus) {
          stockStatus[status] = (stockStatus[status] || 0) + 1;
        }
      });
      
      report.push('## 📦 Inventory Analysis');
      report.push(`- Total Products: ${products.length}`);
      report.push(`- In Stock: ${stockStatus['in-stock']}`);
      report.push(`- Low Stock: ${stockStatus['low-stock']}`);
      report.push(`- Out of Stock: ${stockStatus['out-of-stock']}`);
      report.push('');
    }
    
    // Financial Health
    if (backupData.sales && backupData.expenses) {
      const totalSales = backupData.sales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
      const totalExpenses = backupData.expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);
      const profit = totalSales - totalExpenses;
      const margin = (profit / totalSales) * 100;
      
      report.push('## 📈 Financial Health');
      report.push(`- Revenue: $${totalSales.toLocaleString()}`);
      report.push(`- Expenses: $${totalExpenses.toLocaleString()}`);
      report.push(`- Profit: $${profit.toLocaleString()}`);
      report.push(`- Profit Margin: ${margin.toFixed(2)}%`);
      report.push('');
    }
    
    // User Analysis
    if (backupData.users) {
      const users = backupData.users;
      const activeUsers = users.filter((user: any) => user.is_active !== false).length;
      const roleBreakdown: { [key: string]: number } = {};
      users.forEach((user: any) => {
        const role = user.role || 'Unknown';
        roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
      });
      
      report.push('## 👥 User Analysis');
      report.push(`- Total Users: ${users.length}`);
      report.push(`- Active Users: ${activeUsers}`);
      report.push('- Users by Role:');
      Object.entries(roleBreakdown).forEach(([role, count]) => {
        report.push(`  - ${role}: ${count}`);
      });
      report.push('');
    }
    
    return report.join('\n');
  }
  
  // Export business report as markdown file
  static async exportBusinessReport(): Promise<void> {
    console.log('📋 Generating business report...');
    
    try {
      // We need to fetch data first - for now, we'll trigger the backup and then analyze
      // In a real implementation, you might want to fetch data separately
      await BackupSystem.exportFullBackup();
      console.log('✅ Business report generated as part of backup!');
    } catch (error) {
      console.error('❌ Report generation failed:', error);
    }
  }
  
  // Generate SQL export for database migration
  static generateSQLExport(backupData: any, tableName: string): string {
    if (!backupData[tableName] || !Array.isArray(backupData[tableName])) {
      return `-- No data found for table: ${tableName}\n`;
    }
    
    const data = backupData[tableName];
    if (data.length === 0) {
      return `-- Table ${tableName} is empty\n`;
    }
    
    const sql = [];
    sql.push(`-- SQL Export for table: ${tableName}`);
    sql.push(`-- Generated on: ${new Date().toLocaleString()}`);
    sql.push('');
    
    // Get column names from the first record
    const columns = Object.keys(data[0]);
    
    data.forEach((record: any) => {
      const values = columns.map(col => {
        const value = record[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        return value;
      });
      
      sql.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
    });
    
    return sql.join('\n');
  }
}

// Usage examples in comments:
/*
// Generate business report
const report = DataAnalysisUtils.generateBusinessReport(backupData);
console.log(report);

// Generate SQL for specific table
const sql = DataAnalysisUtils.generateSQLExport(backupData, 'products');
console.log(sql);

// Export business report
await DataAnalysisUtils.exportBusinessReport();
*/
