import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  editable: boolean;
  options?: string[]; // For select type
}

interface ColumnManagerProps {
  columns: Column[];
  onColumnsChange: (columns: Column[]) => void;
}

const ColumnManager: React.FC<ColumnManagerProps> = ({ columns, onColumnsChange }) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState<Partial<Column>>({
    name: '',
    type: 'text',
    editable: true,
    options: []
  });

  const handleAddColumn = () => {
    if (newColumn.name) {
      const column: Column = {
        id: `custom_${Date.now()}`,
        name: newColumn.name,
        type: newColumn.type || 'text',
        editable: true,
        options: newColumn.type === 'select' ? newColumn.options : undefined
      };
      onColumnsChange([...columns, column]);
      setNewColumn({ name: '', type: 'text', editable: true, options: [] });
      setIsAddingColumn(false);
    }
  };

  const handleEditColumn = (columnId: string, updates: Partial<Column>) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, ...updates } : col
    );
    onColumnsChange(updatedColumns);
    setEditingColumn(null);
  };

  const handleDeleteColumn = (columnId: string) => {
    const updatedColumns = columns.filter(col => col.id !== columnId);
    onColumnsChange(updatedColumns);
  };

  const addSelectOption = (value: string) => {
    if (value && newColumn.options && !newColumn.options.includes(value)) {
      setNewColumn({
        ...newColumn,
        options: [...newColumn.options, value]
      });
    }
  };

  const removeSelectOption = (index: number) => {
    if (newColumn.options) {
      const updatedOptions = newColumn.options.filter((_, i) => i !== index);
      setNewColumn({
        ...newColumn,
        options: updatedOptions
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Column Management
          <Button
            onClick={() => setIsAddingColumn(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Column
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Columns */}
        <div className="grid gap-2">
          {columns.map((column) => (
            <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg">
              {editingColumn === column.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={column.name}
                    onChange={(e) => handleEditColumn(column.id, { name: e.target.value })}
                    className="max-w-xs"
                  />
                  <select
                    value={column.type}
                    onChange={(e) => handleEditColumn(column.id, { type: e.target.value as Column['type'] })}
                    className="px-2 py-1 border rounded"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                  </select>
                  <Button size="sm" onClick={() => setEditingColumn(null)}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{column.name}</span>
                    <Badge variant="outline">{column.type}</Badge>
                    {!column.editable && <Badge variant="secondary">System</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {column.editable && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingColumn(column.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteColumn(column.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add New Column Form */}
        {isAddingColumn && (
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Add New Column</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Column Name</label>
                <Input
                  value={newColumn.name}
                  onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  placeholder="Enter column name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Column Type</label>
                <select
                  value={newColumn.type}
                  onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value as Column['type'] })}
                  className="w-full px-2 py-1 border rounded"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select (Dropdown)</option>
                </select>
              </div>
            </div>

            {newColumn.type === 'select' && (
              <div>
                <label className="block text-sm font-medium mb-1">Dropdown Options</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add option..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addSelectOption((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                      if (input) {
                        addSelectOption(input.value);
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newColumn.options?.map((option, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      {option}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeSelectOption(index)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleAddColumn}>
                <Save className="h-4 w-4 mr-2" />
                Save Column
              </Button>
              <Button variant="outline" onClick={() => setIsAddingColumn(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ColumnManager;