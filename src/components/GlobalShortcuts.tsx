import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from 'fuse.js';
import { BackupSystem } from '../lib/backupSystem';

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
      { label: 'Add New Reseller', action: () => {
        console.log('👥 Add New Reseller command triggered!');
        if (window.location.pathname !== '/admin/resellers') {
          console.log('📍 Not on resellers page, navigating...');
          navigate('/admin/resellers');
          setTimeout(() => {
            console.log('🔍 Dispatching add reseller event...');
            window.dispatchEvent(new Event('open-add-reseller'));
          }, 1000); // Increased timeout to ensure page is fully loaded
        } else {
          console.log('✅ Already on resellers page, dispatching event...');
          window.dispatchEvent(new Event('open-add-reseller'));
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
            { label: 'Add Stock Purchase', action: () => {
        console.log('📦 Record Stock Purchase command triggered!');
        if (window.location.pathname !== '/admin/inventory') {
          console.log('📍 Not on inventory page, navigating...');
          navigate('/admin/inventory');
          setTimeout(() => {
            console.log('🔍 Searching for add inventory button...');
            // Try to find and click the add inventory button
            const addBtn = document.querySelector('[data-add-inventory]') as HTMLElement;
            console.log('🎯 Add inventory button (data attribute):', addBtn);
            
            if (addBtn) {
              console.log('✅ Clicking add inventory button');
              addBtn.click();
            } else {
              console.log('❌ Data attribute not found, searching for Add buttons...');
              // Look for Add buttons
              const buttons = Array.from(document.querySelectorAll('button'));
              console.log('📊 Total buttons found:', buttons.length);
              
              const addInventoryBtn = buttons.find(btn => 
                btn.textContent?.toLowerCase().includes('add') ||
                btn.innerHTML.includes('Plus')
              );
              console.log('🎯 Add inventory button found:', addInventoryBtn);
              console.log('📝 Button text:', addInventoryBtn?.textContent);
              
              if (addInventoryBtn) {
                console.log('✅ Clicking found add inventory button');
                (addInventoryBtn as HTMLElement).click();
              } else {
                console.log('❌ No suitable add inventory button found');
                buttons.forEach((btn, index) => {
                  if (index < 5) { // Log first 5 buttons for debugging
                    console.log(`Button ${index}:`, btn.textContent, btn.className);
                  }
                });
              }
            }
          }, 500);
        } else {
          console.log('✅ Already on inventory page, searching for button...');
          const addBtn = document.querySelector('[data-add-inventory]') as HTMLElement;
          console.log('🎯 Add inventory button (data attribute):', addBtn);
          
          if (addBtn) {
            console.log('✅ Clicking add inventory button');
            addBtn.click();
          } else {
            console.log('❌ Data attribute not found, searching for Add buttons...');
            const buttons = Array.from(document.querySelectorAll('button'));
            const addInventoryBtn = buttons.find(btn => 
              btn.textContent?.toLowerCase().includes('add') ||
              btn.innerHTML.includes('Plus')
            );
            console.log('🎯 Add inventory button found:', addInventoryBtn);
            
            if (addInventoryBtn) {
              console.log('✅ Clicking found add inventory button');
              (addInventoryBtn as HTMLElement).click();
            } else {
              console.log('❌ No suitable add inventory button found');
            }
          }
        }
      }},
            { label: 'Add Investment', action: () => {
        console.log('🏦 Add Investment command triggered!');
        if (window.location.pathname !== '/admin/finance') {
          console.log('📍 Not on finance page, navigating...');
          navigate('/admin/finance');
          setTimeout(() => {
            console.log('🔍 Searching for investment button...');
            // The console shows we have cards, so let's look for the right structure
            // Try to find cards that contain investment-related content
            const allCards = document.querySelectorAll('[class*="cursor-pointer"]');
            console.log('📊 Found cursor-pointer elements:', allCards.length);
            
            let investmentBtn = null;
            // Look for a card that contains investment-related icons or text
            for (const card of allCards) {
              const cardHTML = card.innerHTML.toLowerCase();
              if (cardHTML.includes('piggy') || cardHTML.includes('investment') || 
                  card.querySelector('[class*="PiggyBank"]') || 
                  card.textContent?.toLowerCase().includes('investment')) {
                investmentBtn = card as HTMLElement;
                break;
              }
            }
            
            console.log('🎯 Investment button found:', investmentBtn);
            
            if (investmentBtn) {
              console.log('✅ Clicking investment button');
              investmentBtn.click();
            } else {
              console.log('❌ Investment button not found, trying to click first investment-related card...');
              // Look for any card that might be investment related
              const cards = Array.from(document.querySelectorAll('.cursor-pointer, [class*="cursor-pointer"]'));
              const investmentCard = cards.find(card => 
                card.innerHTML.toLowerCase().includes('investment') ||
                card.innerHTML.toLowerCase().includes('piggy')
              );
              if (investmentCard) {
                console.log('✅ Found investment card, clicking...');
                (investmentCard as HTMLElement).click();
              } else {
                console.log('❌ No investment card found');
              }
            }
          }, 500);
        } else {
          console.log('✅ Already on finance page, searching for button...');
          // Same logic for when already on page
          const allCards = document.querySelectorAll('[class*="cursor-pointer"]');
          console.log('📊 Found cursor-pointer elements:', allCards.length);
          
          let investmentBtn = null;
          for (const card of allCards) {
            const cardHTML = card.innerHTML.toLowerCase();
            if (cardHTML.includes('piggy') || cardHTML.includes('investment') || 
                card.querySelector('[class*="PiggyBank"]') || 
                card.textContent?.toLowerCase().includes('investment')) {
              investmentBtn = card as HTMLElement;
              break;
            }
          }
          
          console.log('🎯 Investment button found:', investmentBtn);
          
          if (investmentBtn) {
            console.log('✅ Clicking investment button');
            investmentBtn.click();
          } else {
            console.log('❌ Investment button not found, trying alternative approach...');
            const cards = Array.from(document.querySelectorAll('.cursor-pointer, [class*="cursor-pointer"]'));
            const investmentCard = cards.find(card => 
              card.innerHTML.toLowerCase().includes('investment') ||
              card.innerHTML.toLowerCase().includes('piggy')
            );
            if (investmentCard) {
              console.log('✅ Found investment card, clicking...');
              (investmentCard as HTMLElement).click();
            }
          }
        }
      }},
      { label: 'Add Loan', action: () => {
        console.log('💳 Add Loan command triggered!');
        if (window.location.pathname !== '/admin/finance') {
          console.log('📍 Not on finance page, navigating...');
          navigate('/admin/finance');
          setTimeout(() => {
            console.log('🔍 Searching for loan button...');
            // Look for loan-related cards
            const allCards = document.querySelectorAll('[class*="cursor-pointer"]');
            console.log('📊 Found cursor-pointer elements:', allCards.length);
            
            let loanBtn = null;
            for (const card of allCards) {
              const cardHTML = card.innerHTML.toLowerCase();
              if (cardHTML.includes('credit') || cardHTML.includes('loan') || 
                  card.querySelector('[class*="CreditCard"]') || 
                  card.textContent?.toLowerCase().includes('loan')) {
                loanBtn = card as HTMLElement;
                break;
              }
            }
            
            console.log('🎯 Loan button found:', loanBtn);
            
            if (loanBtn) {
              console.log('✅ Clicking loan button');
              loanBtn.click();
            } else {
              console.log('❌ Loan button not found, trying alternative approach...');
              const cards = Array.from(document.querySelectorAll('.cursor-pointer, [class*="cursor-pointer"]'));
              const loanCard = cards.find(card => 
                card.innerHTML.toLowerCase().includes('loan') ||
                card.innerHTML.toLowerCase().includes('credit')
              );
              if (loanCard) {
                console.log('✅ Found loan card, clicking...');
                (loanCard as HTMLElement).click();
              } else {
                console.log('❌ No loan card found');
              }
            }
          }, 500);
        } else {
          console.log('✅ Already on finance page, searching for button...');
          // Same logic for when already on page
          const allCards = document.querySelectorAll('[class*="cursor-pointer"]');
          console.log('📊 Found cursor-pointer elements:', allCards.length);
          
          let loanBtn = null;
          for (const card of allCards) {
            const cardHTML = card.innerHTML.toLowerCase();
            if (cardHTML.includes('credit') || cardHTML.includes('loan') || 
                card.querySelector('[class*="CreditCard"]') || 
                card.textContent?.toLowerCase().includes('loan')) {
              loanBtn = card as HTMLElement;
              break;
            }
          }
          
          console.log('🎯 Loan button found:', loanBtn);
          
          if (loanBtn) {
            console.log('✅ Clicking loan button');
            loanBtn.click();
          } else {
            console.log('❌ Loan button not found, trying alternative approach...');
            const cards = Array.from(document.querySelectorAll('.cursor-pointer, [class*="cursor-pointer"]'));
            const loanCard = cards.find(card => 
              card.innerHTML.toLowerCase().includes('loan') ||
              card.innerHTML.toLowerCase().includes('credit')
            );
            if (loanCard) {
              console.log('✅ Found loan card, clicking...');
              (loanCard as HTMLElement).click();
            }
          }
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
      { label: 'Import Resellers', action: () => {
        if (window.location.pathname !== '/admin/resellers') {
          navigate('/admin/resellers');
          setTimeout(() => {
            // console.log('Dispatching import resellers event');
            window.dispatchEvent(new Event('open-import-reseller'));
          }, 1000); // Increased timeout
        } else {
          window.dispatchEvent(new Event('open-import-reseller'));
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
      { label: 'Export Resellers', action: () => {
        if (window.location.pathname !== '/admin/resellers') {
          navigate('/admin/resellers');
          setTimeout(() => {
            // console.log('Dispatching export resellers event');
            window.dispatchEvent(new Event('open-export-reseller'));
          }, 1000); // Increased timeout
        } else {
          window.dispatchEvent(new Event('open-export-reseller'));
        }
      }},
    ],
    // 'Financial Management': [

    //   // { label: 'Add Cash Transaction', action: () => {
    //   //   console.log('💰 Add Cash Transaction command triggered!');
    //   //   if (window.location.pathname !== '/admin/CashBalancePage') {
    //   //     console.log('📍 Not on cash balance page, navigating...');
    //   //     navigate('/admin/CashBalancePage');
    //   //     setTimeout(() => {
    //   //       console.log('🔍 Searching for add transaction button...');
    //   //       // Try to find the Add button on cash balance page
    //   //       const addBtn = document.querySelector('[data-add-transaction]') as HTMLElement;
    //   //       console.log('🎯 Add transaction button (data attribute):', addBtn);
            
    //   //       if (addBtn) {
    //   //         console.log('✅ Clicking add transaction button');
    //   //         addBtn.click();
    //   //       } else {
    //   //         console.log('❌ Data attribute not found, searching for Add buttons...');
    //   //         // Look for Add buttons
    //   //         const buttons = Array.from(document.querySelectorAll('button'));
    //   //         console.log('📊 Total buttons found:', buttons.length);
              
    //   //         const addTransactionBtn = buttons.find(btn => 
    //   //           btn.textContent?.toLowerCase().includes('add') ||
    //   //           btn.innerHTML.includes('Plus')
    //   //         );
    //   //         console.log('🎯 Add button found:', addTransactionBtn);
    //   //         console.log('📝 Button text:', addTransactionBtn?.textContent);
    //   //         console.log('🔍 Button HTML:', addTransactionBtn?.innerHTML.substring(0, 100));
              
    //   //         if (addTransactionBtn) {
    //   //           console.log('✅ Clicking found add button');
    //   //           (addTransactionBtn as HTMLElement).click();
    //   //         } else {
    //   //           console.log('❌ No suitable add button found');
    //   //           buttons.forEach((btn, index) => {
    //   //             if (index < 5) { // Log first 5 buttons for debugging
    //   //               console.log(`Button ${index}:`, btn.textContent, btn.className);
    //   //             }
    //   //           });
    //   //         }
    //   //       }
    //   //     }, 500);
    //   //   } else {
    //   //     console.log('✅ Already on cash balance page, searching for button...');
    //   //     const addBtn = document.querySelector('[data-add-transaction]') as HTMLElement;
    //   //     console.log('🎯 Add transaction button (data attribute):', addBtn);
          
    //   //     if (addBtn) {
    //   //       console.log('✅ Clicking add transaction button');
    //   //       addBtn.click();
    //   //     } else {
    //   //       console.log('❌ Data attribute not found, searching for Add buttons...');
    //   //       const buttons = Array.from(document.querySelectorAll('button'));
    //   //       console.log('📊 Total buttons found:', buttons.length);
            
    //   //       const addTransactionBtn = buttons.find(btn => 
    //   //         btn.textContent?.toLowerCase().includes('add') ||
    //   //         btn.innerHTML.includes('Plus')
    //   //       );
    //   //       console.log('🎯 Add button found:', addTransactionBtn);
            
    //   //       if (addTransactionBtn) {
    //   //         console.log('✅ Clicking found add button');
    //   //         (addTransactionBtn as HTMLElement).click();
    //   //       } else {
    //   //         console.log('❌ No suitable add button found');
    //   //       }
    //   //     }
    //   //   }
    //   // }},
    // ],
    'Quick Actions': [
      { label: 'Toggle Theme', action: () => {
        console.log('🌙 Toggle Theme command triggered!');
        // Look for the ToggleTheme component which uses a label with class "switch"
        const themeToggle = document.querySelector('label.switch input[type="checkbox"]') as HTMLElement;
        console.log('🎯 Theme toggle found:', themeToggle);
        
        if (themeToggle) {
          console.log('✅ Clicking theme toggle');
          themeToggle.click();
        } else {
          console.log('❌ Theme toggle not found, trying alternative selectors...');
          // Try to find the switch label
          const switchLabel = document.querySelector('label.switch') as HTMLElement;
          console.log('🔍 Switch label found:', switchLabel);
          
          if (switchLabel) {
            console.log('✅ Clicking switch label');
            switchLabel.click();
          } else {
            console.log('❌ Switch label not found, trying to find input with title...');
            // Look for input with title "Toggle Theme"
            const themeInput = document.querySelector('input[title*="Toggle"], label[title*="Toggle"]') as HTMLElement;
            console.log('🎯 Theme input/label found:', themeInput);
            
            if (themeInput) {
              console.log('✅ Clicking theme input/label');
              themeInput.click();
            } else {
              console.log('❌ No theme toggle found, logging all available elements...');
              const allInputs = document.querySelectorAll('input[type="checkbox"]');
              console.log('📊 All checkboxes found:', allInputs.length);
              allInputs.forEach((input, index) => {
                const inputElement = input as HTMLInputElement;
                const parentLabel = input.closest('label') as HTMLLabelElement;
                console.log(`Checkbox ${index}:`, {
                  type: inputElement.type,
                  id: inputElement.id,
                  className: inputElement.className,
                  parentLabel: parentLabel?.className,
                  title: parentLabel?.title || inputElement.title
                });
              });
            }
          }
        }
      }},
      { label: 'View Profile', action: () => {
        if (window.location.pathname.includes('/admin')) {
          navigate('/admin-profile');
        } else {
          navigate('/reseller-profile');
        }
      }},
      { label: 'View Cash Balance', action: () => navigate('/admin/CashBalancePage') },
      { label: 'View Profit Analysis', action: () => navigate('/admin/GrossProfitAnalysis') },
      { label: 'View Rewards', action: () => navigate('/admin/rewards') },
    ],
    'Data Management': [
      { label: 'Refresh Dashboard', action: () => {
        if (window.location.pathname === '/admin') {
          window.location.reload();
        } else {
          navigate('/admin');
        }
      }},
      { label: 'Backup All Data', action: async () => {
        console.log('� Backup All Data command triggered!');
        
        // Try to find existing export buttons on current page first
        const exportButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
          btn.textContent?.toLowerCase().includes('export') ||
          btn.textContent?.toLowerCase().includes('download') ||
          btn.textContent?.toLowerCase().includes('backup')
        );
        
        console.log('📤 Found export buttons:', exportButtons.length);
        
        if (exportButtons.length > 0) {
          console.log('✅ Triggering export from current page');
          // Click the first export button found
          (exportButtons[0] as HTMLElement).click();
        } else {
          console.log('🚀 No export buttons found, starting comprehensive backup...');
          // Use our backup system to export all data
          try {
            await BackupSystem.exportFullBackup();
            console.log('✅ Comprehensive backup completed successfully!');
          } catch (error) {
            console.error('❌ Backup failed:', error);
          }
        }
      }},
      { label: 'Backup Financial Data', action: async () => {
        console.log('💰 Backup Financial Data command triggered!');
        try {
          await BackupSystem.exportFinancialData();
          console.log('✅ Financial data backup completed!');
        } catch (error) {
          console.error('❌ Financial backup failed:', error);
        }
      }},
      { label: 'Backup Sales Data', action: async () => {
        console.log('🛒 Backup Sales Data command triggered!');
        try {
          await BackupSystem.exportSalesData();
          console.log('✅ Sales data backup completed!');
        } catch (error) {
          console.error('❌ Sales backup failed:', error);
        }
      }},
    ],
    // 'Reseller Management': [

    //   { label: 'View Payment Status', action: () => {
    //     navigate('/admin/resellers');
    //     setTimeout(() => {
    //       const paymentSection = document.querySelector('[data-payment-section]');
    //       if (paymentSection) {
    //         paymentSection.scrollIntoView({ behavior: 'smooth' });
    //       }
    //     }, 500);
    //   }},
    //   { label: 'Send Payment Reminders', action: () => {
    //     window.dispatchEvent(new Event('send-payment-reminders'));
    //   }},
    // ],
    // 'Inventory Management': [

    //   // { label: 'Update Stock Levels', action: () => {
    //   //   if (window.location.pathname !== '/admin/inventory') {
    //   //     navigate('/admin/inventory');
    //   //     setTimeout(() => {
    //   //       // Try to find update stock button or scroll to update section
    //   //       const updateBtn = document.querySelector('[data-update-stock]') as HTMLElement;
    //   //       if (updateBtn) {
    //   //         updateBtn.click();
    //   //       } else {
    //   //         // Look for Update buttons or scroll to inventory table
    //   //         const buttons = Array.from(document.querySelectorAll('button'));
    //   //         const updateInventoryBtn = buttons.find(btn => 
    //   //           btn.textContent?.toLowerCase().includes('update')
    //   //         );
    //   //         if (updateInventoryBtn) {
    //   //           (updateInventoryBtn as HTMLElement).click();
    //   //         } else {
    //   //           // Scroll to inventory table where updates usually happen
    //   //           const inventoryTable = document.querySelector('table, [data-inventory-table]');
    //   //           if (inventoryTable) {
    //   //             inventoryTable.scrollIntoView({ behavior: 'smooth' });
    //   //           }
    //   //         }
    //   //       }
    //   //     }, 500);
    //   //   } else {
    //   //     const updateBtn = document.querySelector('[data-update-stock]') as HTMLElement;
    //   //     if (updateBtn) {
    //   //       updateBtn.click();
    //   //     } else {
    //   //       const buttons = Array.from(document.querySelectorAll('button'));
    //   //       const updateInventoryBtn = buttons.find(btn => 
    //   //         btn.textContent?.toLowerCase().includes('update')
    //   //       );
    //   //       if (updateInventoryBtn) {
    //   //         (updateInventoryBtn as HTMLElement).click();
    //   //       } else {
    //   //         const inventoryTable = document.querySelector('table, [data-inventory-table]');
    //   //         if (inventoryTable) {
    //   //           inventoryTable.scrollIntoView({ behavior: 'smooth' });
    //   //         }
    //   //       }
    //   //     }
    //   //   }
    //   // }},
    //   // { label: 'View Low Stock Alerts', action: () => {
    //   //   navigate('/admin/inventory');
    //   //   setTimeout(() => {
    //   //     const alertsSection = document.querySelector('[data-low-stock-alerts]');
    //   //     if (alertsSection) {
    //   //       alertsSection.scrollIntoView({ behavior: 'smooth' });
    //   //     }
    //   //   }, 500);
    //   // }},
    // ],
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

  // Enhanced fuzzy search with multiple strategies
  const fuse = new Fuse(commandList, { 
    keys: ['label'], 
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 1
  });

  const getFilteredCommands = (query: string) => {
    if (!query.trim()) return commandList;

    const lowerQuery = query.toLowerCase().trim();
    const normalizedQuery = lowerQuery.replace(/\s+/g, '');
    
    // Strategy 1: Exact contains matching (highest priority)
    const containsMatches = commandList.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery)
    );

    // Strategy 2: Enhanced word-based partial matching 
    // Handles both "er" and "e r" to match "Export Resellers"
    const wordPartialMatches = commandList.filter(cmd => {
      const words = cmd.label.toLowerCase().split(/\s+/);
      
      // For queries with spaces, match each part against word starts
      if (lowerQuery.includes(' ')) {
        const queryParts = lowerQuery.split(/\s+/);
        return queryParts.every(part => 
          words.some(word => word.startsWith(part))
        );
      }
      
      // For queries without spaces, prioritize cross-word matching for short queries
      
      // 1. For short queries (2-3 chars), prioritize first letters of consecutive words
      // e.g., "er" matches "Export Resellers", "es" matches "Export Sales"
      if (normalizedQuery.length <= 3) {
        const firstLetters = words.map(word => word[0]).join('');
        if (firstLetters.includes(normalizedQuery)) return true;
        
        // Also check if query can be formed by taking first letter + any letter from next words
        // e.g., "ep" matches "Export Products" (E from Export + P from Products)
        for (let i = 0; i < words.length - 1; i++) {
          if (words[i][0] === normalizedQuery[0]) {
            for (let j = i + 1; j < words.length; j++) {
              if (words[j][0] === normalizedQuery[1]) {
                if (normalizedQuery.length === 2) return true;
                // For 3-char queries, check if third char matches next word's first letter
                if (normalizedQuery.length === 3 && j + 1 < words.length && words[j + 1][0] === normalizedQuery[2]) {
                  return true;
                }
              }
            }
          }
        }
      }
      
      // 2. Check if any word contains the query (for longer queries or fallback)
      if (words.some(word => word.includes(lowerQuery))) return true;
      
      // 3. Check if query can be split across word boundaries (character sequence)
      // e.g., "er" matches "Export" (e) + "Resellers" (r)
      let queryIndex = 0;
      for (const word of words) {
        if (queryIndex >= normalizedQuery.length) break;
        
        for (let i = 0; i < word.length && queryIndex < normalizedQuery.length; i++) {
          if (word[i] === normalizedQuery[queryIndex]) {
            queryIndex++;
          }
        }
      }
      return queryIndex === normalizedQuery.length;
    });

    // Strategy 3: Acronym matching (e.g., "anp" matches "Add New Product")
    const acronymMatches = commandList.filter(cmd => {
      const words = cmd.label.toLowerCase().split(/\s+/);
      const acronym = words.map(word => word[0]).join('');
      return acronym === normalizedQuery || acronym.startsWith(normalizedQuery);
    });

    // Strategy 4: Initial letters matching (e.g., "a n p" matches "Add New Product")
    const initialLettersMatches = commandList.filter(cmd => {
      const words = cmd.label.toLowerCase().split(/\s+/);
      const queryParts = lowerQuery.split(/\s+/);
      
      if (queryParts.length > words.length) return false;
      
      return queryParts.every((part, index) => {
        return index < words.length && words[index].startsWith(part);
      });
    });

    // Strategy 5: Character sequence matching (e.g., "er" matches "ExpoRt Resellers")
    const charSequenceMatches = commandList.filter(cmd => {
      const labelChars = cmd.label.toLowerCase().replace(/\s+/g, '');
      const queryChars = normalizedQuery;
      let queryIndex = 0;
      
      for (let i = 0; i < labelChars.length && queryIndex < queryChars.length; i++) {
        if (labelChars[i] === queryChars[queryIndex]) {
          queryIndex++;
        }
      }
      
      return queryIndex === queryChars.length;
    });

    // Strategy 6: Fuzzy search using Fuse.js
    const fuseResults = fuse.search(query).map(res => res.item);

    // Combine results with proper prioritization and deduplication
    const seenIds = new Set();
    const allMatches = [];

    // Add exact matches first
    for (const cmd of containsMatches) {
      const id = `${cmd.group}-${cmd.label}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allMatches.push(cmd);
      }
    }

    // Add word partial matches
    for (const cmd of wordPartialMatches) {
      const id = `${cmd.group}-${cmd.label}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allMatches.push(cmd);
      }
    }

    // Add acronym matches
    for (const cmd of acronymMatches) {
      const id = `${cmd.group}-${cmd.label}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allMatches.push(cmd);
      }
    }

    // Add initial letters matches
    for (const cmd of initialLettersMatches) {
      const id = `${cmd.group}-${cmd.label}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allMatches.push(cmd);
      }
    }

    // Add character sequence matches
    for (const cmd of charSequenceMatches) {
      const id = `${cmd.group}-${cmd.label}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allMatches.push(cmd);
      }
    }

    // Add fuzzy matches last
    for (const cmd of fuseResults) {
      const id = `${cmd.group}-${cmd.label}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allMatches.push(cmd);
      }
    }

    return allMatches;
  };

  const filteredCommands = getFilteredCommands(commandQuery);

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
