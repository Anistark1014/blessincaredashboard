import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { DollarSign, TrendingUp, AlertCircle, Activity, PiggyBank, CreditCard } from 'lucide-react';

interface Investment {
  id: string;
  investor_name: string;
  amount: number;
  note?: string;
  created_at: string;
}

interface Loan {
  id: string;
  issuer: string;
  amount: number;
  interest_rate: number;
  monthly_payment: number;
  duration_months: number;
  remaining_balance: number;
  status: string;
  created_at: string;
}

interface LoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  note?: string;
  payment_date: string;
}

const Finance = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [ loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [loanAction, setLoanAction] = useState<'take' | 'pay'>('take');

  // Investment form state
  const [investmentForm, setInvestmentForm] = useState({
    investor_name: '',
    amount: '',
    note: ''
  });

  // Loan form state
  const [loanForm, setLoanForm] = useState({
    amount: '',
    issuer: '',
    interest_rate: '',
    monthly_payment: '',
    duration_months: '',
    selected_loan_id: '',
    note: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch investments
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: false });

      if (investmentsError) throw investmentsError;

      // Fetch loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;

      // Fetch loan payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      setInvestments(investmentsData || []);
      setLoans(loansData || []);
      setLoanPayments(paymentsData || []);

      // Calculate balance locally
      const totalInvestments = (investmentsData || []).reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalLoans = (loansData || []).reduce((sum, loan) => sum + Number(loan.amount), 0);
      const totalRepayments = (paymentsData || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
      
      setBalance(totalInvestments + totalLoans - totalRepayments);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch financial data",
        variant: "destructive",
      });
    }
  };

  const calculateKPIs = () => {
    const revenue = investments.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const outstanding = loans.reduce((sum, loan) => sum + Number(loan.remaining_balance), 0);
    const gmv = revenue + outstanding;

    return { revenue, outstanding, gmv };
  };

  const handleInvestmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('investments')
        .insert([{
          investor_name: investmentForm.investor_name,
          amount: Number(investmentForm.amount),
          note: investmentForm.note || null
        }])
        .select()
        .single();

      if (error) throw error;

      setInvestments(prev => [data, ...prev]);
      setBalance(prev => prev + Number(investmentForm.amount));
      
      setInvestmentForm({ investor_name: '', amount: '', note: '' });
      
      toast({
        title: "Success",
        description: "Investment added successfully",
      });
    } catch (error) {
      console.error('Error adding investment:', error);
      toast({
        title: "Error",
        description: "Failed to add investment",
        variant: "destructive",
      });
    }
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (loanAction === 'take') {
        const { data, error } = await supabase
          .from('loans')
          .insert([{
            issuer: loanForm.issuer,
            amount: Number(loanForm.amount),
            interest_rate: Number(loanForm.interest_rate),
            monthly_payment: Number(loanForm.monthly_payment),
            duration_months: Number(loanForm.duration_months),
            remaining_balance: Number(loanForm.amount)
          }])
          .select()
          .single();

        if (error) throw error;

        setLoans(prev => [data, ...prev]);
        setBalance(prev => prev + Number(loanForm.amount));
        
        toast({
          title: "Success",
          description: "Loan taken successfully",
        });
      } else {
        // Pay loan
        const selectedLoan = loans.find(loan => loan.id === loanForm.selected_loan_id);
        if (!selectedLoan) {
          toast({
            title: "Error",
            description: "Please select a loan to pay",
            variant: "destructive",
          });
          return;
        }

        const paymentAmount = Number(loanForm.amount);
        const newRemainingBalance = selectedLoan.remaining_balance - paymentAmount;

        // Insert payment record
        const { data: paymentData, error: paymentError } = await supabase
          .from('loan_payments')
          .insert([{
            loan_id: selectedLoan.id,
            amount: paymentAmount,
            note: loanForm.note || null
          }])
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Update loan remaining balance
        const { error: loanError } = await supabase
          .from('loans')
          .update({
            remaining_balance: Math.max(0, newRemainingBalance),
            status: newRemainingBalance <= 0 ? 'paid' : 'active'
          })
          .eq('id', selectedLoan.id);

        if (loanError) throw loanError;

        setLoanPayments(prev => [paymentData, ...prev]);
        setLoans(prev => prev.map(loan => 
          loan.id === selectedLoan.id 
            ? { ...loan, remaining_balance: Math.max(0, newRemainingBalance), status: newRemainingBalance <= 0 ? 'paid' : 'active' }
            : loan
        ));
        setBalance(prev => prev - paymentAmount);
        
        toast({
          title: "Success",
          description: "Loan payment recorded successfully",
        });
      }
      
      setLoanForm({
        amount: '',
        issuer: '',
        interest_rate: '',
        monthly_payment: '',
        duration_months: '',
        selected_loan_id: '',
        note: ''
      });
    } catch (error) {
      console.error('Error processing loan:', error);
      toast({
        title: "Error",
        description: "Failed to process loan transaction",
        variant: "destructive",
      });
    }
  };

  const { revenue, outstanding, gmv } = calculateKPIs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">
          Manage investments, loans, and financial overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${balance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Current available balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total investments received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${outstanding.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Remaining loan balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GMV</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${gmv.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Gross monetary value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Management */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="investment" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-lavender/10">
              <TabsTrigger value="investment" className="data-[state=active]:bg-lavender flex items-center gap-2">
                <PiggyBank className="w-4 h-4" />
                Manage Investment
              </TabsTrigger>
              <TabsTrigger value="loan" className="data-[state=active]:bg-blush flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Loan / Repayment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="investment" className="space-y-4">
              <form onSubmit={handleInvestmentSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="investor_name">Investor Name</Label>
                  <Input
                    id="investor_name"
                    value={investmentForm.investor_name}
                    onChange={(e) => setInvestmentForm(prev => ({ ...prev, investor_name: e.target.value }))}
                    className="border-lavender/30 focus:border-lavender"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="investment_amount">Amount</Label>
                  <Input
                    id="investment_amount"
                    type="number"
                    step="0.01"
                    value={investmentForm.amount}
                    onChange={(e) => setInvestmentForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="border-lavender/30 focus:border-lavender"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="investment_note">Note</Label>
                  <Textarea
                    id="investment_note"
                    value={investmentForm.note}
                    onChange={(e) => setInvestmentForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Optional note about the investment"
                    className="border-lavender/30 focus:border-lavender"
                  />
                </div>
                
                <Button type="submit" className="w-full btn-healthcare">
                  Add Investment
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="loan" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={loanAction} onValueChange={(value: 'take' | 'pay') => setLoanAction(value)}>
                    <SelectTrigger className="border-blush/30 focus:border-blush">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="take">Take a Loan</SelectItem>
                      <SelectItem value="pay">Pay a Loan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <form onSubmit={handleLoanSubmit} className="space-y-4">
                  {loanAction === 'take' ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="loan_amount">Amount</Label>
                        <Input
                          id="loan_amount"
                          type="number"
                          step="0.01"
                          value={loanForm.amount}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="border-blush/30 focus:border-blush"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="loan_issuer">Issuer</Label>
                        <Input
                          id="loan_issuer"
                          value={loanForm.issuer}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, issuer: e.target.value }))}
                          className="border-blush/30 focus:border-blush"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="interest_rate">Interest %</Label>
                        <Input
                          id="interest_rate"
                          type="number"
                          step="0.01"
                          value={loanForm.interest_rate}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, interest_rate: e.target.value }))}
                          className="border-blush/30 focus:border-blush"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="monthly_payment">Monthly Payment</Label>
                        <Input
                          id="monthly_payment"
                          type="number"
                          step="0.01"
                          value={loanForm.monthly_payment}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, monthly_payment: e.target.value }))}
                          className="border-blush/30 focus:border-blush"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (months)</Label>
                        <Input
                          id="duration"
                          type="number"
                          value={loanForm.duration_months}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, duration_months: e.target.value }))}
                          className="border-blush/30 focus:border-blush"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Select Loan/Issuer</Label>
                        <Select 
                          value={loanForm.selected_loan_id} 
                          onValueChange={(value) => setLoanForm(prev => ({ ...prev, selected_loan_id: value }))}
                        >
                          <SelectTrigger className="border-blush/30 focus:border-blush">
                            <SelectValue placeholder="Select a loan to pay" />
                          </SelectTrigger>
                          <SelectContent>
                            {loans.filter(loan => loan.status === 'active' && loan.remaining_balance > 0).map((loan) => (
                              <SelectItem key={loan.id} value={loan.id}>
                                {loan.issuer} - ${loan.remaining_balance.toLocaleString()} remaining
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="payment_amount">Amount</Label>
                        <Input
                          id="payment_amount"
                          type="number"
                          step="0.01"
                          value={loanForm.amount}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="border-blush/30 focus:border-blush"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="payment_note">Note</Label>
                        <Textarea
                          id="payment_note"
                          value={loanForm.note}
                          onChange={(e) => setLoanForm(prev => ({ ...prev, note: e.target.value }))}
                          placeholder="Optional note about the payment"
                          className="border-blush/30 focus:border-blush"
                        />
                      </div>
                    </>
                  )}
                  
                  <Button type="submit" className="w-full btn-healthcare">
                    {loanAction === 'take' ? 'Take Loan' : 'Make Payment'}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Finance;