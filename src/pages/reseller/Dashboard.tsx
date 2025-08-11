'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
// import { useUser } from '@supabase/auth-helpers-react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Bell, PackageSearch } from 'lucide-react';
import { Database } from '@/lib/types';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

// --- Types ---
type ProductRequest = Database['public']['Tables']['requests']['Row'];
type ProductRequestItem = Database['public']['Tables']['product_request_items']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];

// Extend ProductRequest to include nested items
type FullProductRequest = ProductRequest & {
  product_request_items: ProductRequestItem[];
};

export default function ResellerDashboard() {
  // const user = useUser();
  const {user} = useAuth()
  const [requests, setRequests] = useState<FullProductRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    
    console.log("User:", user); // 👈 Add this
    if (!user?.id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch product requests with nested items
        const { data: reqData, error: reqErr } = await supabase
          .from('requests')
          .select(`
            *,
            product_request_items (
              id, request_id, product_id, product_name, quantity, price
            )
          `)
          .eq('reseller_id', user.id)
          .order('request_date', { ascending: false });

        if (reqErr) throw reqErr;

        // Fetch notifications
        const { data: notifData, error: notifErr } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(3);

        if (notifErr) throw notifErr;

        setRequests(reqData as ProductRequestItem[]);
        setNotifications(notifData || []);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center mt-4">
        Failed to load data: {error}
      </div>
    );
  }

  // console.log(requests)

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Requests Card */}
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <PackageSearch className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Your Orders</h2>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.slice(0, 5).map((req) => {
              const statusColor = {
                pending: 'bg-yellow-100 text-yellow-800',
                approved: 'bg-green-100 text-green-800',
                rejected: 'bg-red-100 text-red-800',
              }[req.status!] || 'bg-gray-100 text-gray-800';

              const paymentColor =
                req.payment_status === 'paid'
                  ? 'text-green-600'
                  : req.payment_status === 'pending'
                  ? 'text-yellow-600'
                  : 'text-red-600';

              return (
                <li
                  key={req.id}
                  className="p-4 border rounded-lg bg-muted hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(req.request_date!), 'dd MMM yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.product_request_items?.length || 0} item(s) | ₹{req.total_amount}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-1 rounded ${statusColor}`}
                      >
                        {req.status}
                      </span>
                      <br />
                      <span className={`text-xs font-semibold ${paymentColor}`}>
                        {req.payment_status}
                      </span>
                    </div>
                  </div>

                  {req.special_instructions && (
                    <p className="text-xs mt-2 italic text-muted-foreground">
                      Note: {req.special_instructions}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>


    </div>
  );
}
