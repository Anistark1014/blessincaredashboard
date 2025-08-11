import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from 'fuse.js';

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/resellers', label: 'Resellers' },
  { to: '/admin/sales', label: 'Sales' },
  { to: '/admin/expenses', label: 'Expenses' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/finance', label: 'Finance' },
];

export function GlobalShortcuts() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandListRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Define commands inside component to access navigate
  const commandGroups = {
    'Navigation': [
      { label: 'Go to Dashboard', action: () => {
        // console.log('Go to Dashboard command triggered!');
        window.location.pathname === '/admin' ? null : navigate('/admin');
      }},
      { label: 'Go to Products', action: () => {
        // console.log('Go to Products command triggered!');
        window.location.pathname === '/admin/products' ? null : navigate('/admin/products');
      }},
      { label: 'Go to Sales', action: () => navigate('/admin/sales') },
      { label: 'Go to Expenses', action: () => navigate('/admin/expenses') },
      { label: 'Go to Resellers', action: () => navigate('/admin/resellers') },
      { label: 'Go to Inventory', action: () => navigate('/admin/inventory') },
      { label: 'Go to Finance', action: () => navigate('/admin/finance') },
    ],
    'Add New': [
      { label: 'Add New Product', action: () => {
        // console.log('Add New Product command triggered!');
        if (window.location.pathname !== '/admin/products') {
          console.log('Not on products page, navigating...');
          navigate('/admin/products');
          setTimeout(() => {
            console.log('Dispatching add product event');
            window.dispatchEvent(new Event('open-add-product-modal'));
          }, 500);
        } else {
          console.log('Already on products page, dispatching event directly');
          window.dispatchEvent(new Event('open-add-product-modal'));
        }
      }},
      { label: 'Add New Sale', action: () => {
        console.log('Add New Sale command triggered!');
        if (window.location.pathname !== '/admin/sales') {
          console.log('Not on sales page, navigating...');
          navigate('/admin/sales');
          setTimeout(() => {
            console.log('Dispatching add sale event');
            window.dispatchEvent(new Event('open-add-sale-modal'));
          }, 500);
        } else {
          console.log('Already on sales page, dispatching event directly');
          window.dispatchEvent(new Event('open-add-sale-modal'));
        }
      }},
      { label: 'Add New Expense', action: () => {
        // console.log('Add New Expense command triggered!');
        if (window.location.pathname !== '/admin/expenses') {
        //   console.log('Not on expenses page, navigating...');
          navigate('/admin/expenses');
          setTimeout(() => {
            // console.log('Dispatching add expense event');
            window.dispatchEvent(new Event('open-add-expense-modal'));
          }, 500);
        } else {
        //   console.log('Already on expenses page, dispatching event directly');
          window.dispatchEvent(new Event('open-add-expense-modal'));
        }
      }},
    ],
    'Import Data': [
      { label: 'Import Products', action: () => {
        if (window.location.pathname !== '/admin/products') {
          navigate('/admin/products');
          setTimeout(() => {
            // console.log('Dispatching import products event');
            window.dispatchEvent(new Event('open-import-product'));
          }, 500);
        } else {
          window.dispatchEvent(new Event('open-import-product'));
        }
      }},
      { label: 'Import Sales', action: () => {
        if (window.location.pathname !== '/admin/sales') {
          navigate('/admin/sales');
          setTimeout(() => {
            // console.log('Dispatching import sales event');
            window.dispatchEvent(new Event('open-import-sale'));
          }, 500);
        } else {
          window.dispatchEvent(new Event('open-import-sale'));
        }
      }},
      { label: 'Import Expenses', action: () => {
        if (window.location.pathname !== '/admin/expenses') {
          navigate('/admin/expenses');
          setTimeout(() => {
            // console.log('Dispatching import expenses event');
            window.dispatchEvent(new Event('open-import-expense'));
          }, 500);
        } else {
          window.dispatchEvent(new Event('open-import-expense'));
        }
      }},
    ],
    'Export Data': [
      { label: 'Export Products', action: () => {
        if (window.location.pathname !== '/admin/products') {
          navigate('/admin/products');
          setTimeout(() => {
            // console.log('Dispatching export products event');
            window.dispatchEvent(new Event('open-export-product'));
          }, 500);
        } else {
          window.dispatchEvent(new Event('open-export-product'));
        }
      }},
      { label: 'Export Sales', action: () => {
        if (window.location.pathname !== '/admin/sales') {
          navigate('/admin/sales');
          setTimeout(() => {
            // console.log('Dispatching export sales event');
            window.dispatchEvent(new Event('open-export-sale'));
          }, 500);
        } else {
          window.dispatchEvent(new Event('open-export-sale'));
        }
      }},
      { label: 'Export Expenses', action: () => {
        if (window.location.pathname !== '/admin/expenses') {
          navigate('/admin/expenses');
          setTimeout(() => {
            // console.log('Dispatching export expenses event');
            window.dispatchEvent(new Event('open-export-expense'));
          }, 500);
        } else {
          window.dispatchEvent(new Event('open-export-expense'));
        }
      }},
    ],
  };

  // Flatten grouped commands for search
  const commandList = Object.entries(commandGroups).flatMap(([group, commands]) => 
    commands.map(cmd => ({ ...cmd, group }))
  );

  // Command Palette: Ctrl+Space (toggle open/close)
  useHotkeys('ctrl+space', (e) => {
    e.preventDefault();
    setShowCommandPalette((prev) => {
      if (prev) {
        // If open, close it
        return false;
      } else {
        // If closed, open and focus
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
        return true;
      }
    });
  }, { enableOnFormTags: true });

  // Fuzzy search
  const fuse = new Fuse(commandList, { keys: ['label'], threshold: 0.4 });
  const filteredCommands = commandQuery.trim()
    ? fuse.search(commandQuery).map(res => res.item)
    : commandList;

  // Group filtered commands for display
  const groupedFilteredCommands = commandQuery.trim() 
    ? filteredCommands.reduce((acc, cmd) => {
        const group = cmd.group || 'Other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(cmd);
        return acc;
      }, {} as Record<string, typeof filteredCommands>)
    : commandGroups;

  // Flatten for navigation index calculation
  const flattenedForNavigation = Object.values(groupedFilteredCommands).flat();

  // Scroll selected command into view
  const scrollToCommand = (index: number) => {
    if (commandListRef.current) {
      // Find the command element by data-index attribute
      const commandElement = commandListRef.current.querySelector(`[data-command-index="${index}"]`) as HTMLElement;
      if (commandElement) {
        commandElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  };

  // Scroll to selected command when index changes
  useEffect(() => {
    if (showCommandPalette && flattenedForNavigation.length > 0) {
      scrollToCommand(commandIndex);
    }
  }, [commandIndex, showCommandPalette, flattenedForNavigation.length]);

  // Remove Esc hotkey. Arrow keys and Enter handled in input's onKeyDown.

//   Menu navigation: Ctrl+Up/Down (when palette is not open)
  useHotkeys('ctrl+up', (e) => {
    e.preventDefault();
    const currentIndex = adminNavItems.findIndex(item => item.to === location.pathname);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + adminNavItems.length) % adminNavItems.length;
    navigate(adminNavItems[prevIndex].to);
  }, { enabled: !showCommandPalette });
  useHotkeys('ctrl+down', (e) => {
    e.preventDefault();
    const currentIndex = adminNavItems.findIndex(item => item.to === location.pathname);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % adminNavItems.length;
    navigate(adminNavItems[nextIndex].to);
  }, { enabled: !showCommandPalette });

  // Command Palette Modal
  return showCommandPalette ? (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-border" tabIndex={0} aria-label="Command Palette">
        <h2 className="text-xl font-bold mb-4 text-foreground">Command Palette</h2>
        <input
          ref={inputRef}
          className="bg-muted/50 w-full p-3 mb-4 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
          placeholder="Type a command or search..."
          value={commandQuery}
          onChange={e => { setCommandQuery(e.target.value); setCommandIndex(0); }}
          aria-label="Command search"
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const newIndex = Math.min(commandIndex + 1, flattenedForNavigation.length - 1);
              setCommandIndex(newIndex);
              scrollToCommand(newIndex);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const newIndex = Math.max(commandIndex - 1, 0);
              setCommandIndex(newIndex);
              scrollToCommand(newIndex);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (flattenedForNavigation[commandIndex]) {
                // console.log('Enter pressed for command:', flattenedForNavigation[commandIndex].label);
                try {
                  flattenedForNavigation[commandIndex].action();
                //   console.log('Action executed successfully via Enter');
                } catch (error) {
                //   console.error('Error executing action via Enter:', error);
                }
                setShowCommandPalette(false);
                setCommandQuery('');
                setCommandIndex(0);
              } else {
                // console.log('No command selected at index:', commandIndex);
              }
            }
          }}
        />
        <div ref={commandListRef} className="mb-4 max-h-80 overflow-y-auto border border-border rounded-lg bg-muted/20">
          {Object.keys(groupedFilteredCommands).length === 0 && (
            <div className="p-4 text-center text-muted-foreground">No commands found</div>
          )}
          {Object.entries(groupedFilteredCommands).map(([groupName, commands]) => {
            // Calculate the starting index for this group
            const groupStartIndex = Object.entries(groupedFilteredCommands)
              .slice(0, Object.keys(groupedFilteredCommands).indexOf(groupName))
              .reduce((acc, [, cmds]) => acc + cmds.length, 0);

            return (
              <div key={groupName} className="border-b border-border last:border-b-0">
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0 z-10">
                  {groupName}
                </div>
                <div className="py-1">
                  {commands.map((cmd, i) => {
                    const globalIndex = groupStartIndex + i;
                    return (
                      <div
                        key={cmd.label}
                        data-command-index={globalIndex}
                        className={`px-4 py-3 mx-2 my-1 rounded-md cursor-pointer transition-all duration-150 ${
                          globalIndex === commandIndex 
                            ? 'bg-primary text-primary-foreground shadow-md transform scale-[1.02]' 
                            : 'hover:bg-muted/60 hover:transform hover:scale-[1.01]'
                        }`}
                        onClick={() => { 
                        //   console.log('Command clicked:', cmd.label);
                        //   console.log('Executing action for:', cmd.label);
                          try {
                            cmd.action(); 
                            // console.log('Action executed successfully for:', cmd.label);
                          } catch (error) {
                            // console.error('Error executing action:', error);
                          }
                          setShowCommandPalette(false); 
                          setCommandQuery(''); 
                          setCommandIndex(0); 
                        }}
                        onMouseEnter={() => setCommandIndex(globalIndex)}
                        tabIndex={-1}
                        aria-selected={globalIndex === commandIndex}
                      >
                        <div className="text-sm font-medium">{cmd.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
          <div className="flex flex-wrap gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Enter</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Ctrl+Space</kbd> Toggle</span>
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Ctrl+↑↓</kbd> Menu Nav</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;
}
