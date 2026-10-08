import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, AlertTriangle, Info, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/GuardAPI';

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function Alerts() {
  const navigate = useNavigate();
  const { guard } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!guard?.id) return;
    
    const fetchNotifications = async () => {
      try {
        const response = await getNotifications(guard.id);
        if (response.success && response.data) {
          setAlerts(response.data.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            timestamp: formatTimestamp(n.timestamp),
            read: n.read,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [guard?.id]);

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const markAsRead = async (alertId: string) => {
    try {
      await markNotificationAsRead(alertId);
      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, read: true } : a
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!guard?.id) return;
    try {
      await markAllNotificationsAsRead(guard.id);
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'info': return <Info className="w-5 h-5 text-primary" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-primary" />;
    }
  };

  const getAlertBg = (type: Alert['type']) => {
    switch (type) {
      case 'warning': return 'bg-warning/20';
      case 'info': return 'bg-primary/20';
      case 'success': return 'bg-primary/10';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="p-6 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
            <p className="text-muted-foreground text-sm">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
            <div className="relative">
              <Bell className="w-6 h-6 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="glass-card p-8 text-center">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin mb-3" />
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        )}

        {/* Alerts List */}
        {!isLoading && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => !alert.read && markAsRead(alert.id)}
              className={cn(
                "glass-card p-4 transition-all cursor-pointer",
                !alert.read && "ring-1 ring-primary/30"
              )}
            >
              <div className="flex gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  getAlertBg(alert.type)
                )}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={cn(
                      "font-semibold text-foreground",
                      !alert.read && "text-primary"
                    )}>
                      {alert.title}
                    </h3>
                    {!alert.read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{alert.timestamp}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
