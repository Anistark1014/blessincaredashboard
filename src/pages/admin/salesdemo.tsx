


  // const [searchTerm, setSearchTerm] = useState('');

  // const addToUndoStack = (operation: UndoOperation) => {
  //   if (isUndoing) return;
  //   setUndoStack(prev => [...prev, operation].slice(-10));
  // };

  // useEffect(() => {
  //   const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
  //   checkDarkMode();
  //   const observer = new MutationObserver(checkDarkMode);
  //   observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  //   return () => observer.disconnect();
  // }, []);


  //   FIX: Join 'products' to get product details in one request

  
  // const handleImportedData = async (importedRows: Partial<Sale>[]) => {
  //   if (!importedRows || importedRows.length === 0) {
  //     alert("No data found or parsed from the imported file.");
  //     return;
  //   }
  //   const processedData = importedRows.map(row => {
  //       const qty = Number(row.qty || 0);
  //       const price = Number(row.price || 0);
  //       const paid = Number(row.paid || 0);
  //       const total = qty * price;
  //       const incoming = total - paid;
  //       const balance = incoming;
  //       const payment_status = paid >= total ? 'Fully Paid' : (paid === 0 ? 'Pending' : 'Partially Paid');
  //       return { ...row, total, incoming, balance, payment_status, type: 'sale' };
  //   });
    
  //   const { data: newRecords, error } = await supabase.from('sales').insert(processedData).select();

  //   if (error) {
  //       alert(`Import failed: ${error.message}`);
  //   } else if (newRecords) {
  //       alert(`${newRecords.length} rows imported successfully!`);
  //       addToUndoStack({ type: 'import', timestamp: Date.now(), data: { importedRecords: newRecords } });
  //       fetchSales();
  //   }
  // };
  // const handleEditChange = async (id: string, field: keyof Sale, value: any) => {
  //   const originalSale = sales.find(sale => sale.id === id);
  //   if (!originalSale) return;

  //   let updatedRecord = { ...originalSale, [field]: value };
  //   let updatePayload: Partial<Sale> = { [field]: value };

  //   if (['qty', 'price', 'paid'].includes(field as string)) {
  //       const qty = Number(field === 'qty' ? value : updatedRecord.qty || 0);
  //       const price = Number(field === 'price' ? value : updatedRecord.price || 0);
  //       const paid = Number(field === 'paid' ? value : updatedRecord.paid || 0);
  //       const total = qty * price;
  //       const incoming = total - paid;
  //       const balance = incoming;
  //       const payment_status = paid >= total ? 'Fully Paid' : (paid === 0 ? 'Pending' : 'Partially Paid');
  //       const calculatedFields = { total, incoming, balance, payment_status };
  //       updatePayload = { ...updatePayload, ...calculatedFields };
  //       updatedRecord = { ...updatedRecord, ...calculatedFields };
  //   }
    
    addToUndoStack({ type: 'edit', timestamp: Date.now(), data: { recordId: id, field, oldValue: originalSale[field], newValue: value, record: originalSale } });

    const updatedSales = sales.map((sale) =>
        sale.id === id ? updatedRecord : sale
    );
    setSales(updatedSales);

    const { error } = await supabase.from('sales').update(updatePayload).eq('id', id);
    if (error) {
        console.error('Update failed:', error.message);
        setSales(sales); 
    }
  };
  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(displayItems.map(s => s.id));
    } else {
      setSelectedRows([]);
    }
  };
  const deleteSelectedRows = async () => {
    if (selectedRows.length === 0) return;
    const deletedRecords = sales.filter((s) => selectedRows.includes(s.id));
    addToUndoStack({ type: 'delete', timestamp: Date.now(), data: { deletedRecords } });
    const { error } = await supabase.from('sales').delete().in('id', selectedRows);
    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      setSales(sales.filter((s) => !selectedRows.includes(s.id)));
      setSelectedRows([]);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) {
      alert('No operations to undo');
      return;
    }
    setIsUndoing(true);
    const lastOperation = undoStack[undoStack.length - 1];
    try {
      switch (lastOperation.type) {
        case 'import':
          if (lastOperation.data.importedRecords) {
            const idsToDelete = lastOperation.data.importedRecords.map(rec => rec.id);
            const { error } = await supabase.from('sales').delete().in('id', idsToDelete);
            if (error) {
              alert('Undo import failed: ' + error.message);
            } else {
              setSales(prev => prev.filter(s => !idsToDelete.includes(s.id)));
              alert(`Reverted the import of ${idsToDelete.length} record(s)`);
            }
          }
          break;
        case 'delete':
          if (lastOperation.data.deletedRecords) {
            const recordsToInsert = lastOperation.data.deletedRecords.map(record => {
              const { id, cumulativePaid, ...recordWithoutIdAndCumulative } = record;
              return recordWithoutIdAndCumulative;
            });
            const { data, error } = await supabase.from('sales').insert(recordsToInsert).select();
            if (error) {
              alert('Undo delete failed: ' + error.message);
            } else if (data) {
              setSales(prev => [...data, ...prev]);
            }
          }
          break;
        case 'add':
          if (lastOperation.data.addedRecord) {
            const { error } = await supabase.from('sales').delete().eq('id', lastOperation.data.addedRecord.id);
            if (error) {
              alert('Undo add failed: ' + error.message);
            } else {
              setSales(prev => prev.filter(s => s.id !== lastOperation.data.addedRecord!.id));
              alert('Removed the last added record');
            }
          }
          break;
        case 'edit':
          if (lastOperation.data.record) {
            const { cumulativePaid, ...originalRecord } = lastOperation.data.record;
            const { error } = await supabase.from('sales').update(originalRecord).eq('id', originalRecord.id);
            if (error) {
              alert('Undo edit failed: ' + error.message);
            } else {
              fetchSales();
            }
          }
          break;
      }
      setUndoStack(prev => prev.slice(0, -1));
    } catch (error) {
      console.error('Undo operation failed:', error);
      alert('Undo operation failed');
    } finally {
      setIsUndoing(false);
    }
  };
  
  const renderEditableCell = (sale: Sale, field: keyof Sale, formatter?: (value: any) => string, isCurrency = false, type = 'text') => {
    const isCalculatedField = ['total', 'incoming', 'balance'].includes(field as string);
    const isEditing = !isCalculatedField && editingCell?.rowId === sale.id && editingCell.field === field;
    const rawValue = sale[field];
    const clickHandler = isCalculatedField ? undefined : () => setEditingCell({ rowId: sale.id, field });
    const cursorClass = isCalculatedField ? 'cursor-not-allowed' : 'cursor-pointer';
    const handleBlur = () => setEditingCell(null);

    if (field === 'member' || field === 'product') {
      const options = field === 'member' ? resellers : productOptions;
      return (
        <TableCell className="px-2 py-1" onClick={clickHandler}>
          {isEditing ? (
            <Select
              options={options}
              value={options.find((o: any) => o.value === rawValue) || null}
              onChange={(selected: any) => {
                handleEditChange(sale.id, field, selected?.value);
                if (field === 'product' && selected?.value) {
                  const productPrice = getProductPrice(selected.value);
                  handleEditChange(sale.id, 'price', productPrice);
                }
                handleBlur();
              }}
              onBlur={handleBlur}
              isClearable
              isSearchable
              autoFocus
              styles={getSelectStyles(isDarkMode)}
              menuPortalTarget={document.body}
            />
          ) : (
            <div className={cursorClass}>{String(rawValue ?? '')}</div>
          )}
        </TableCell>
      );
    }

    if (field === 'payment_status') {
      return (
        <TableCell className="px-2 py-1" onClick={clickHandler}>
          {isEditing ? (
            <select
              className="w-full p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"
              value={sale.payment_status}
              onChange={(e) => handleEditChange(sale.id, field, e.target.value)}
              onBlur={handleBlur}
              autoFocus
            >
              <option value="Fully Paid">Fully Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Pending">Pending</option>
            </select>
          ) : (
            <div className={cn("font-semibold", cursorClass, statusColors[sale.payment_status])}>
              {sale.payment_status}
            </div>
          )}
        </TableCell>
      );
    }

    return (
      <TableCell className={cn("px-2 py-1", isCurrency && "text-right")} onClick={clickHandler}>
        {isEditing ? (
          <Input
            type={type}
            className="h-8"
            value={rawValue as any ?? ''}
            onChange={(e) => handleEditChange(sale.id, field, type === 'number' ? Number(e.target.value) : e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            autoFocus
          />
        ) : (
          <div className={cursorClass}>
            {isCurrency ? formatCurrency(Number(rawValue)) : String(rawValue ?? '')}
          </div>
        )}
      </TableCell>
    );
  };

  const handleNewChange = (field: keyof Sale, value: any) => {
    setNewSale((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'product' && value) {
        const productPrice = getProductPrice(value);
        updated.price = productPrice;
      }
      return updated;
    });
  };

  useEffect(() => {
    const qty = newSale.qty || 0;
    const price = newSale.price || 0;
    const paid = newSale.paid || 0;
    const total = qty * price;
    const balance = total - paid;
    const payment_status = total > 0 && paid >= total ? 'Fully Paid' : paid > 0 ? 'Partially Paid' : 'Pending';
    
    setNewSale((prev) => ({ ...prev, total, balance, payment_status, incoming: balance }));
  }, [newSale.qty, newSale.price, newSale.paid]);
  
  const handleAddNew = async () => {
    const requiredFields: (keyof Sale)[] = ['date', 'member', 'product', 'qty', 'price'];
    const allFilled = requiredFields.every((field) => newSale[field] !== undefined && newSale[field] !== '' && newSale[field] !== 0);
    if (!allFilled) {
      alert(`Please fill all required fields: ${requiredFields.join(', ')}`);
      return;
    }
    const { cumulativePaid, ...recordToInsert } = newSale;
    const { data, error } = await supabase.from('sales').insert([recordToInsert]).select();
    if (error) {
      alert('Insert failed: ' + error.message);
    } else if (data && data.length > 0) {
      const addedRecord = data[0] as Sale;
      addToUndoStack({ type: 'add', timestamp: Date.now(), data: { addedRecord } });
      setSales([addedRecord, ...sales]);
      setNewSale({});
      setAddingNew(false);
    }
  };

  const handleExportToExcel = () => {
    if (!sales || sales.length === 0) {
      alert("No sales data to export.");
      return;
    }
    const exportData = displayItems.map((s) => ({
        Date: s.date,
        Member: s.member,
        Product: s.product,
        Quantity: s.qty,
        'Price': s.price,
        'Total': s.total,
        Paid: s.paid,
        Incoming: s.incoming,
        Balance: s.balance,
        'Payment Status': s.payment_status,
        'Cumulative Paid': s.cumulativePaid
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Sales");
    const month = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'short' });
    const fileName = `Sales_${month}_${selectedYear}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const searchMatch = !searchTerm ||
        s.member.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.type && s.type.toLowerCase().includes(searchTerm.toLowerCase()));
      return searchMatch;
    });
  }, [sales, searchTerm]);

  const computedSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredSales]);

  const displayItems = useMemo(() => {
    let sortableItems = [...computedSales];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [computedSales, sortConfig]);

  const requestSort = (key: keyof Sale) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      setSortConfig({ key: 'date', direction: 'descending' });
      return;
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (name: keyof Sale) => {
    if (sortConfig.key !== name) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  }; 
  
  return (
    <div className="space-y-6">
      <EnhancedSalesDashboard data={displayItems} />
      <Card className="overflow-hidden">
        <CardHeader className="p-4 md:p-6 bg-card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <CardTitle className="text-2xl">Sales Records</CardTitle>
                        <span className="w-full sm:w-auto">
                            <MonthYearPicker onSelect={(month, year) => { setSelectedMonth(month); setSelectedYear(year); }} />
                        </span>
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
                <div className="w-full md:w-auto md:flex-grow">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by member, product, type..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
                <Button onClick={handleUndo} variant="outline" size="sm" disabled={undoStack.length === 0 || isUndoing}>
                    <Undo className="h-4 w-4 " />
                </Button>
                <ExcelImport onDataParsed={handleImportedData} />
                <Button onClick={handleExportToExcel} variant="outline" size="sm">
                    <Upload className="h-4 w-4 " />
                </Button>
                <Button onClick={() => setAddingNew(true)} size="sm" disabled={addingNew}>
                    <Plus className="h-4 w-4 " />
                </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[50px] px-4">
                    <div
                        onClick={() => handleSelectAll(!(displayItems.length > 0 && selectedRows.length === displayItems.length))}
                        className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all",
                            (displayItems.length > 0 && selectedRows.length === displayItems.length)
                                ? "bg-indigo-600 border-2 border-indigo-600"
                                : "border-2 border-gray-400 dark:border-gray-500 hover:border-indigo-500"
                        )}
                    >
                        {(selectedRows.length === displayItems.length && displayItems.length > 0) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date{getSortIndicator('date')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('member')}>Member{getSortIndicator('member')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('product')}>Product{getSortIndicator('product')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('qty')}>Qty{getSortIndicator('qty')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('price')}>Price{getSortIndicator('price')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('total')}>Total Sale{getSortIndicator('total')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('paid')}>Paid{getSortIndicator('paid')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('balance')}>Balance{getSortIndicator('balance')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('payment_status')}>Status{getSortIndicator('payment_status')}</TableHead>
                  <TableHead className="text-right pr-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={deleteSelectedRows} disabled={selectedRows.length === 0}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addingNew && (
                  <TableRow className="bg-secondary">
                    <TableCell></TableCell>
                    <TableCell className="p-1"><Input type="date" className="h-8" value={newSale.date ?? ''} onChange={(e) => handleNewChange('date', e.target.value)} /></TableCell>
                    <TableCell className="p-1 min-w-[150px]"><Select options={resellers} onChange={(s: any) => handleNewChange('member', s?.value)} styles={getSelectStyles(isDarkMode)} /></TableCell>
                    <TableCell className="p-1 min-w-[150px]"><Select options={productOptions} onChange={(s: any) => handleNewChange("product", s?.value || "")} styles={getSelectStyles(isDarkMode)} /></TableCell>
                    <TableCell className="p-1"><Input type="number" className="h-8 w-16 text-right" value={newSale.qty ?? ''} onChange={(e) => handleNewChange('qty', Number(e.target.value))} /></TableCell>
                    <TableCell className="p-1"><Input type="number" className="h-8 w-24 text-right" value={newSale.price ?? ''} onChange={(e) => handleNewChange('price', Number(e.target.value))} /></TableCell>
                    <TableCell className="p-1 text-right">{formatCurrency(newSale.total ?? 0)}</TableCell>
                    <TableCell className="p-1"><Input type="number" className="h-8 w-24 text-right" value={newSale.paid ?? ''} onChange={(e) => handleNewChange('paid', Number(e.target.value))} /></TableCell>
                    <TableCell className="p-1 text-right">{formatCurrency(newSale.balance ?? 0)}</TableCell>
                    <TableCell className="p-1"><div className={cn("font-semibold", statusColors[newSale.payment_status || 'Pending'])}>{newSale.payment_status || 'Pending'}</div></TableCell>
                    <TableCell className="p-1 text-right">
                        <div className="flex gap-2 justify-end">
                            <Button onClick={handleAddNew} size="sm" className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                            <Button onClick={() => setAddingNew(false)} variant="ghost" size="sm">Cancel</Button>
                        </div>
                    </TableCell>
                  </TableRow>
                )}
                {displayItems.map((sale) => (
                  <TableRow key={sale.id} data-state={selectedRows.includes(sale.id) ? "selected" : undefined}>
                    <TableCell className="px-4">
                        <div
                            onClick={() => handleRowSelect(sale.id)}
                            className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all",
                                selectedRows.includes(sale.id)
                                    ? "bg-indigo-600 border-2 border-indigo-600"
                                    : "border-2 border-gray-400 dark:border-gray-500 hover:border-indigo-500"
                            )}
                        >
                            {selectedRows.includes(sale.id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                    </TableCell>
                    {renderEditableCell(sale, 'date', undefined, false, 'date')}
                    {renderEditableCell(sale, 'member')}
                    {renderEditableCell(sale, 'product')}
                    {renderEditableCell(sale, 'qty', undefined, false, 'number')}
                    {renderEditableCell(sale, 'price', formatCurrency, true, 'number')}
                    {renderEditableCell(sale, 'total', formatCurrency, true, 'number')}
                    {renderEditableCell(sale, 'paid', formatCurrency, true, 'number')}
                    {renderEditableCell(sale, 'balance', formatCurrency, true, 'number')}
                    {renderEditableCell(sale, 'payment_status')}
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesTable;
