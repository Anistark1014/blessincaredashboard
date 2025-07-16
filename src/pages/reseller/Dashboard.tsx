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

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Requests Card */}
      <Card>
        <CardContent className="flex flex-col p-6">
          <div className="flex items-center space-x-4">
            <PackageSearch className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Your Requests</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <li className="text-sm text-muted-foreground">No requests yet.</li>
            ) : (
              requests.slice(0, 5).map((req) => (
                <li
                  key={req.id}
                  className="text-sm border p-2 rounded-lg bg-muted"
                >
                  <span className="font-medium">{req.status}</span> —{' '}
                  {format(new Date(req.request_date!), 'dd MMM yyyy')}<br />
                  <span className="text-xs text-muted-foreground">
                    Items: {req.product_request_items?.length || 0}
                  </span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card>
        <CardContent className="flex flex-col p-6">
          <div className="flex items-center space-x-4">
            <Bell className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Recent Notifications</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <li className="text-sm text-muted-foreground">No notifications yet.</li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className="text-sm border p-2 rounded-lg bg-muted"
                >
                  {n.message} —{' '}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(n.timestamp!), 'dd MMM, hh:mm a')}
                  </span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
