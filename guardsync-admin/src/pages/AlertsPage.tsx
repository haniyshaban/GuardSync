import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Guard, Site, AttendanceLog } from '@/types';
import { toast as sonnerToast } from '@/components/ui/sonner';
import { API_BASE_URL } from '@/lib/utils';
import { fetchJson, fetchWithAuth, parseApiData } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { 
  Bell, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  MapPin,
  RefreshCw,
  Siren
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface SOSAlert {
  id: string;
  guardId: string;
  guardName: string;
  siteId?: string;
  siteName?: string;
  location?: { lat: number; lng: number };
  message?: string;
  status: 'active' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedNotes?: string;
}

// Missed check-ins acknowledged in this browser session (storage access may be blocked)
const ACKNOWLEDGED_KEY = 'guardsync_acknowledged_alerts';

function readAcknowledged(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(ACKNOWLEDGED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAcknowledged(ids: string[]) {
  try {
    sessionStorage.setItem(ACKNOWLEDGED_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: the card stays hidden until the page is reloaded
  }
}

const timeAgo = (value?: string) =>
  value && !isNaN(Date.parse(value)) ? formatDistanceToNow(new Date(value), { addSuffix: true }) : 'just now';

export default function AlertsPage() {
  const { user } = useAuth();
  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [acknowledged, setAcknowledged] = useState<string[]>(readAcknowledged);

  // Fetch guards from API
  useEffect(() => {
    const loadGuards = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/guards`);
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData(json);
          if (Array.isArray(data)) {
            setGuards(data);
          }
        }
      } catch (e) {
        console.log('Could not load guards');
      }
    };
    loadGuards();
  }, [refreshKey]);

  // Fetch sites from API
  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/sites`);
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData(json);
          if (Array.isArray(data)) {
            setSites(data);
          }
        }
      } catch (e) {
        console.log('Could not load sites');
      }
    };
    loadSites();
  }, []);

  // Fetch attendance logs from API
  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetchWithAuth(`${API_BASE_URL}/api/attendance?date=${today}`);
        if (res.ok) {
          const data = parseApiData(await res.json());
          if (Array.isArray(data)) {
            setAttendanceLogs(data);
          }
        }
      } catch (e) {
        console.log('Could not load attendance');
      }
    };
    loadAttendance();
  }, [refreshKey]);

  // Fetch SOS alerts from server
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/sos-alerts?status=active`);
        if (res.ok) {
          // The reply is {success, data: [...]}; keep only the list
          const data = parseApiData(await res.json());
          setSosAlerts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch SOS alerts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();

    // Poll for new alerts every 10 seconds
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  // Resolve SOS alert (the server also takes the guard out of 'alert')
  const handleResolveSOS = async (alertId: string) => {
    try {
      await fetchJson(`${API_BASE_URL}/api/sos-alerts/${encodeURIComponent(alertId)}/resolve`, 'PUT', {
        resolvedBy: user?.name || user?.email || 'Control room',
        resolvedNotes: 'Resolved from dashboard',
      });
      setSosAlerts(prev => prev.filter(a => a.id !== alertId));
      setRefreshKey(k => k + 1);
      sonnerToast.success('SOS Alert resolved');
    } catch (err) {
      console.error('Resolve failed:', err);
      sonnerToast.error(err instanceof Error ? err.message : 'Failed to resolve SOS alert');
    }
  };

  // A missed check-in can't be cleared on the server (it is worked out from today's clock-ins),
  // so acknowledging it only hides the card for this session; the guard's status is not changed.
  const handleAcknowledge = (guardId: string) => {
    const next = Array.from(new Set([...acknowledged, guardId]));
    writeAcknowledged(next);
    setAcknowledged(next);
  };

  const phoneOf = (guardId: string) => guards.find(g => g.id === guardId)?.phone;

  // Guard alerts (missed check-ins, status alerts)
  const missed = guards.filter(g => {
    if (!g.siteId) return false;
    const site = sites.find(s => s.id === g.siteId);
    if (!site || !site.isActive) return false;
    const attendance = attendanceLogs.find(l => l.guardId === g.id);
    const hasClockedIn = (attendance && attendance.clockIn) ?
      (new Date(attendance.clockIn).toDateString() === new Date().toDateString()) :
      (g.clockInTime ? new Date(g.clockInTime).toDateString() === new Date().toDateString() : false);
    return !hasClockedIn;
  });

  const alertMap = new Map<string, { guard: Guard; reason: 'status' | 'missed' }>();
  guards.filter(g => g.status === 'alert').forEach(g => alertMap.set(g.id, { guard: g, reason: 'status' }));
  missed.forEach(g => { if (!alertMap.has(g.id)) alertMap.set(g.id, { guard: g, reason: 'missed' }); });
  const alertGuards = Array.from(alertMap.values()).map(v => v.guard);

  // Guards with an open SOS are listed (and resolved) in the SOS section above
  const sosGuardIds = new Set(sosAlerts.map(a => a.guardId));
  const alertsToRender = alertGuards
    .filter(g => !sosGuardIds.has(g.id) && !acknowledged.includes(g.id))
    // Status 'alert' means the guard raised an SOS; the other cards are missed check-ins
    .map(g => ({ guard: g, isSos: g.status === 'alert' || g.status === 'panic' }));

  const totalAlerts = sosAlerts.length + alertsToRender.length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Active Alerts</h1>
              <p className="text-sm text-muted-foreground">
                {totalAlerts} alerts require attention
                {sosAlerts.length > 0 && (
                  <span className="text-red-500 font-medium ml-2">
                    ({sosAlerts.length} SOS)
                  </span>
                )}
              </p>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* SOS Alerts Section */}
        {sosAlerts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Siren className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-red-500">Emergency SOS Alerts</h2>
            </div>
            
            {sosAlerts.map((alert, index) => (
              <Card 
                key={alert.id}
                className="border-2 border-red-500 bg-red-500/5 animate-pulse-slow"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                          <Phone className="w-7 h-7 text-red-500" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{alert.guardName}</p>
                          <Badge className="bg-red-500 text-white animate-pulse">
                            SOS EMERGENCY
                          </Badge>
                        </div>
                        {alert.siteName && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {alert.siteName}
                          </p>
                        )}
                        {alert.message && (
                          <p className="text-sm text-foreground mt-1 bg-muted/30 px-2 py-1 rounded">
                            "{alert.message}"
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(alert.createdAt)}
                          </span>
                          {alert.location && (
                            <a 
                              href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <MapPin className="w-3 h-3" />
                              View Location
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {phoneOf(alert.guardId) ? (
                        <Button variant="outline" size="sm" className="border-primary" asChild>
                          <a href={`tel:${phoneOf(alert.guardId)}`}>
                            <Phone className="w-4 h-4 mr-1" />
                            Call
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="border-primary" disabled>
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                      )}
                      <Link to={`/guards/${alert.guardId}`}>
                        <Button variant="ghost" size="sm">View Guard</Button>
                      </Link>
                      <Button 
                        variant="success" 
                        size="sm"
                        onClick={() => handleResolveSOS(alert.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Other Alerts Section */}
        {alertsToRender.length > 0 && (
          <div className="space-y-4">
            {sosAlerts.length > 0 && (
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Other Alerts
              </h2>
            )}
            
            {alertsToRender.map(({ guard, isSos }, index) => (
              <Card 
                key={guard.id}
                variant="elevated"
                className="border-destructive/30 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-destructive" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 status-dot status-alert border-2 border-background" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{guard.name || 'Unknown Guard'}</p>
                          <Badge variant="alert">{isSos ? 'SOS' : 'Missed Check-in'}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{guard.employeeId || 'N/A'}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Last seen {guard.lastSeen ? formatDistanceToNow(new Date(guard.lastSeen), { addSuffix: true }) : 'Never'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {guard.phone ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${guard.phone}`}>Contact</a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          Contact
                        </Button>
                      )}
                      <Link to={`/guards/${guard.id}`}>
                        <Button variant="ghost" size="sm">View Guard Details</Button>
                      </Link>
                      <Button
                        variant="success"
                        size="sm"
                        title="Hide this card for this session"
                        onClick={(e) => { e.stopPropagation(); handleAcknowledge(guard.id); }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {totalAlerts === 0 && (
          <Card variant="elevated">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Clear</h3>
              <p className="text-muted-foreground">
                No active alerts. All guards are responding normally.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
