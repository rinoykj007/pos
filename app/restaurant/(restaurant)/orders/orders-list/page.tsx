'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Edit, Eye, AlertCircle, Check } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { useModulePermission } from '@/hooks/useModulePermission';
import AccessDenied from '@/app/errors/403/page';
import { PageLoadingScreen } from '@/components/fallbacks/loadings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { swrFetcher } from '@/lib/swr';

interface OrderItem {
  id: number;
  menuItemName: string;
  menuItemOptionName: string | null;
  quantity: number;
  price: string;
}

interface Order {
  id: number;
  tableId: string;
  orderType: 'dine_in' | 'drive_thru' | 'takeaway';
  status: 'pending' | 'in_progress' | 'completed';
  description: string | null;
  createdAt: string;
  items: OrderItem[];
  table?: {
    table_number: string;
  };
}

interface OrdersResponse {
  orders: Order[];
}

const statusConfig = {
  pending: {
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: AlertCircle,
    label: 'Pending',
    canEdit: true,
  },
  in_progress: {
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: Edit,
    label: 'In Progress',
    canEdit: false,
  },
  completed: {
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: Check,
    label: 'Completed',
    canEdit: false,
  },
};

export default function OrdersListPage() {
  const { canView, loading: permLoading } = useModulePermission();
  const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'active'>('all');

  const { data, error, isLoading } = useSWR<OrdersResponse>(
    '/api/orders/list',
    swrFetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5000,
    }
  );

  if (permLoading || isLoading) return <PageLoadingScreen />;
  if (!canView) return <AccessDenied />;

  if (error) {
    return (
      <div className="flex-1 flex justify-center items-center text-red-600">
        Failed to load orders. Please try again.
      </div>
    );
  }

  const orders = data?.orders ?? [];
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const activeOrders = orders.filter((o) => o.status === 'pending' || o.status === 'in_progress');

  const displayOrders =
    selectedTab === 'pending' ? pendingOrders : selectedTab === 'active' ? activeOrders : orders;

  return (
    <div className="w-full h-full p-4 space-y-4">
      {/* === Header === */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Orders Management</h1>
        <p className="text-muted-foreground">
          View and modify orders before they're sent to the kitchen
        </p>
      </div>

      {/* === Tabs === */}
      <div className="flex gap-2">
        <Button
          variant={selectedTab === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('all')}
        >
          All Orders ({orders.length})
        </Button>
        <Button
          variant={selectedTab === 'pending' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('pending')}
        >
          Pending ({pendingOrders.length})
        </Button>
        <Button
          variant={selectedTab === 'active' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('active')}
        >
          Active ({activeOrders.length})
        </Button>
      </div>

      {/* === Orders Grid === */}
      {displayOrders.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center min-h-40">
            <p className="text-muted-foreground text-lg">No orders found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {displayOrders.map((order) => {
            const config = statusConfig[order.status];
            const StatusIcon = config.icon;
            const subtotal = order.items.reduce(
              (sum, item) => sum + parseFloat(item.price) * item.quantity,
              0
            );

            return (
              <Card key={order.id} className="flex flex-col">
                {/* === Header === */}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        Order #{String(order.id).padStart(4, '0')}
                      </CardTitle>
                      <CardDescription>
                        {order.table?.table_number && `Table ${order.table.table_number}`}
                        {order.table?.table_number && ' • '}
                        {format(new Date(order.createdAt), 'MMM dd, HH:mm')}
                      </CardDescription>
                    </div>
                    <Badge className={config.badge}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>

                  {/* === Order Type === */}
                  <div className="mt-2">
                    <Badge variant="outline">
                      {order.orderType.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>

                {/* === Items === */}
                <CardContent className="flex-1">
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-semibold text-muted-foreground">Items ({order.items.length})</p>
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-sm flex justify-between">
                          <span>{item.menuItemName}</span>
                          <span className="text-muted-foreground">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* === Subtotal === */}
                  <div className="pt-2 border-t">
                    <p className="text-sm flex justify-between font-semibold">
                      <span>Subtotal:</span>
                      <span>PKR {subtotal.toFixed(2)}</span>
                    </p>
                  </div>
                </CardContent>

                {/* === Actions === */}
                <div className="px-6 pb-6 flex gap-2">
                  {config.canEdit ? (
                    <Link href={`/restaurant/orders?editOrder=${order.id}`} className="flex-1">
                      <Button variant="default" className="w-full" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Order
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" disabled className="w-full" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Only
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
