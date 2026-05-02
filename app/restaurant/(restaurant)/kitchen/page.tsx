'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Clock, ChefHat, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useModulePermission } from '@/hooks/useModulePermission';
import AccessDenied from '@/app/errors/403/page';
import { PageLoadingScreen } from '@/components/fallbacks/loadings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { swrFetcher } from '@/lib/swr';

interface KitchenOrder {
  id: number;
  tableId: string;
  waiterId: string;
  orderType: 'dine_in' | 'drive_thru' | 'takeaway';
  status: 'pending' | 'in_progress' | 'completed';
  description: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    menuItemName: string;
    menuItemOptionName: string | null;
    quantity: number;
    menuItemImage: string | null;
  }>;
  table: {
    id: number;
    table_number: string;
    status: string;
  } | null;
  waiter: {
    id: number;
    name: string;
  } | null;
}

interface KitchenResponse {
  orders: KitchenOrder[];
}

const statusConfig = {
  pending: {
    color: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-800',
    badge: 'bg-yellow-500 text-white',
    icon: AlertCircle,
    label: 'Pending',
  },
  in_progress: {
    color: 'bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800',
    badge: 'bg-blue-500 text-white',
    icon: ChefHat,
    label: 'In Progress',
  },
  completed: {
    color: 'bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800',
    badge: 'bg-green-500 text-white',
    icon: CheckCircle,
    label: 'Ready',
  },
};

export default function KitchenPage() {
  const { canView, loading: permLoading } = useModulePermission();
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  // Real-time polling every 3 seconds
  const { data, error, isLoading, mutate } = useSWR<KitchenResponse>(
    '/api/orders/kitchen',
    swrFetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 3000,
    }
  );

  const handleStatusUpdate = async (orderId: number, newStatus: 'in_progress' | 'completed') => {
    setUpdatingOrderId(orderId);
    try {
      const response = await fetch('/api/orders/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      toast.success('Order status updated');
      mutate();
    } catch (err) {
      console.error('Error updating order status:', err);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (permLoading || isLoading) return <PageLoadingScreen />;
  if (!canView) return <AccessDenied />;

  if (error) {
    return (
      <div className="flex-1 flex justify-center items-center text-red-600">
        Failed to load kitchen orders. Please try again.
      </div>
    );
  }

  const orders = data?.orders ?? [];
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const inProgressOrders = orders.filter((o) => o.status === 'in_progress');
  const completedOrders = orders.filter((o) => o.status === 'completed');

  return (
    <div className="w-full h-full p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* === Header === */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ChefHat className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl font-bold">Kitchen Display</h1>
        </div>
        <p className="text-muted-foreground">
          {orders.length} active order{orders.length !== 1 ? 's' : ''} • Last updated:{' '}
          {format(new Date(), 'HH:mm:ss')}
        </p>
      </div>

      {/* === Orders Grid === */}
      {orders.length === 0 ? (
        <Card className="col-span-full">
          <CardContent className="flex items-center justify-center min-h-64">
            <p className="text-muted-foreground text-lg">No pending orders</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {/* === Pending Orders (Red/Yellow Priority) === */}
          {pendingOrders.length > 0 && (
            <div className="lg:col-span-full">
              <h2 className="text-xl font-bold mb-3 text-yellow-700 dark:text-yellow-300">
                🔴 Pending Orders ({pendingOrders.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isUpdating={updatingOrderId === order.id}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* === In Progress Orders === */}
          {inProgressOrders.length > 0 && (
            <div className="lg:col-span-full">
              <h2 className="text-xl font-bold mb-3 text-blue-700 dark:text-blue-300">
                🟦 In Progress ({inProgressOrders.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {inProgressOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isUpdating={updatingOrderId === order.id}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* === Completed Orders === */}
          {completedOrders.length > 0 && (
            <div className="lg:col-span-full">
              <h2 className="text-xl font-bold mb-3 text-green-700 dark:text-green-300">
                ✅ Ready for Pickup ({completedOrders.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {completedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isUpdating={updatingOrderId === order.id}
                    onStatusUpdate={handleStatusUpdate}
                    isCompleted
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OrderCardProps {
  order: KitchenOrder;
  isUpdating: boolean;
  onStatusUpdate: (orderId: number, status: 'in_progress' | 'completed') => Promise<void>;
  isCompleted?: boolean;
}

function OrderCard({ order, isUpdating, onStatusUpdate, isCompleted }: OrderCardProps) {
  const config = statusConfig[order.status];
  const StatusIcon = config.icon;
  const orderAge = Math.floor(
    (new Date().getTime() - new Date(order.createdAt).getTime()) / 1000
  );
  const minutes = Math.floor(orderAge / 60);
  const seconds = orderAge % 60;

  return (
    <Card className={`border-2 ${config.color}`}>
      {/* === Header === */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">
                Order #{String(order.id).padStart(4, '0')}
              </CardTitle>
              <Badge className={config.badge}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {minutes}m {seconds}s ago
            </CardDescription>
          </div>
        </div>

        {/* === Table & Waiter Info === */}
        <div className="flex gap-3 text-sm mt-2">
          {order.table && (
            <div className="px-2 py-1 bg-opacity-50 rounded text-foreground font-medium">
              Table: <span className="font-bold">{order.table.table_number}</span>
            </div>
          )}
          {order.waiter && (
            <div className="px-2 py-1 bg-opacity-50 rounded text-foreground">
              <span className="text-xs text-muted-foreground">Waiter:</span>{' '}
              <span className="font-medium">{order.waiter.name}</span>
            </div>
          )}
          <div className="px-2 py-1 bg-opacity-50 rounded text-foreground text-xs">
            <Badge variant="outline">{order.orderType.replace('_', '-').toUpperCase()}</Badge>
          </div>
        </div>
      </CardHeader>

      {/* === Order Items === */}
      <CardContent className="pb-3">
        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start gap-2 text-sm">
              <div className="flex-1">
                <p className="font-medium">{item.menuItemName}</p>
                {item.menuItemOptionName && (
                  <p className="text-xs text-muted-foreground">{item.menuItemOptionName}</p>
                )}
              </div>
              <Badge variant="secondary" className="text-lg font-bold">
                x{item.quantity}
              </Badge>
            </div>
          ))}
        </div>

        {/* === Actions === */}
        <div className="flex gap-2">
          {!isCompleted && (
            <>
              {order.status === 'pending' && (
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={isUpdating}
                  onClick={() => onStatusUpdate(order.id, 'in_progress')}
                >
                  {isUpdating ? 'Updating...' : 'Start Cooking'}
                </Button>
              )}
              {order.status === 'in_progress' && (
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={isUpdating}
                  onClick={() => onStatusUpdate(order.id, 'completed')}
                >
                  {isUpdating ? 'Updating...' : 'Mark Ready'}
                </Button>
              )}
            </>
          )}
          {isCompleted && (
            <div className="w-full flex items-center justify-center py-2 text-green-700 dark:text-green-400 font-semibold">
              Ready for pickup
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
