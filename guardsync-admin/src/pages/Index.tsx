import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { GuardList } from '@/components/dashboard/GuardList';
import { LiveMap } from '@/components/map/LiveMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth, parseApiData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Guard, Site, AttendanceLog } from '@/types';
import L from 'leaflet';
import { 
  Users, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  Building2, 
  MapPin,
  RefreshCw,
  Download,
  Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const Index = () => {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    avgClockInTime: '--:--',
    geofenceCompliance: 0,
    clockedInToday: 0,
    totalGuards: 0
  });

  // Fetch dashboard stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/stats/dashboard`);
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData(json);
          setDashboardStats(data);
        }
      } catch (e) {
        console.log('Could not fetch dashboard stats', e);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

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
        console.log('Could not load guards from backend', e);
      }
    };
    loadGuards();
    const interval = setInterval(loadGuards, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

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
        console.log('Could not load sites from backend', e);
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
          const json = await res.json();
          const data = parseApiData(json);
          if (Array.isArray(data)) {
            setAttendanceLogs(data);
          }
        }
      } catch (e) {
        console.log('Could not load attendance from backend', e);
      }
    };
    loadAttendance();
    const interval = setInterval(loadAttendance, 30000);
    return () => clearInterval(interval);
  }, []);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // compute dashboard stats (core counts)
  const stats = {
    totalGuards: guards.length,
    activeGuards: guards.filter(g => g.status === 'online').length,
    offlineGuards: guards.filter(g => g.status === 'offline').length,
    alertGuards: guards.filter(g => g.status === 'alert').length,
    totalSites: sites.length,
    activeSites: sites.filter(s => s.isActive).length,
  };

  // compute missed check-ins (no clock-in today)
  const missedCheckins = guards.filter(g => {
    if (!g.siteId) return false;
    const site = sites.find(s => s.id === g.siteId);
    if (!site || !site.isActive) return false;
    const attendance = attendanceLogs.find(l => l.guardId === g.id);
    const hasClockedIn = (attendance && attendance.clockIn) ?
      (new Date(attendance.clockIn).toDateString() === new Date().toDateString()) :
      (g.clockInTime ? new Date(g.clockInTime).toDateString() === new Date().toDateString() : false);
    return !hasClockedIn;
  });

  // Attrition: how many are working today vs total expected (assigned) on active sites
  // derive expected from current guard roster assigned to active sites (avoids stale site.assignedGuards)
  const expectedAssigned = guards.filter(g => {
    if (!g.siteId) return false;
    const s = sites.find(x => x.id === g.siteId);
    return !!s && s.isActive;
  }).length;

  const workingToday = guards.filter(g => {
    if (!g.siteId) return false;
    const site = sites.find(s => s.id === g.siteId);
    if (!site || !site.isActive) return false;
    const attendance = attendanceLogs.find(l => l.guardId === g.id);
    const hasClockedIn = (attendance && attendance.clockIn) ?
      (new Date(attendance.clockIn).toDateString() === new Date().toDateString()) :
      (g.clockInTime ? new Date(g.clockInTime).toDateString() === new Date().toDateString() : false);
    return !!hasClockedIn;
  }).length;

  const attritionPercent = expectedAssigned > 0 ? Math.round(((expectedAssigned - workingToday) / expectedAssigned) * 100) : 0;

  // Helper: point-in-polygon + radius check (copied from LiveMap) to compute not-on-site
  const pointInPolygon = (point: [number, number], vs: Array<[number, number]>): boolean => {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1];
      const xj = vs[j][0], yj = vs[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + Number.EPSILON) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isPointInsideSiteGeofence = (lat: number, lng: number, site: typeof sites[number]) => {
    if ((site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon) && (site as any).geofencePolygon.length > 0) {
      const vs = (site as any).geofencePolygon.map((p: any) => [p.lat, p.lng] as [number, number]);
      return pointInPolygon([lat, lng], vs);
    }
    const dist = L.latLng(lat, lng).distanceTo(L.latLng(site.location.lat, site.location.lng));
    return dist <= (site.geofenceRadius || 0);
  };

  const notOnSiteCount = guards.filter(g => {
    if (!g.siteId) return false;
    const site = sites.find(s => s.id === g.siteId);
    if (!site || !site.isActive) return false;
    if (!g.location) return true;
    try {
      return !isPointInsideSiteGeofence(g.location.lat, g.location.lng, site);
    } catch (e) { return true; }
  }).length;

  // recent alerts should include status alerts plus missed check-ins (non-destructive)
  const alertSet = new Map<string, { guard: typeof guards[number]; reason: string }>();
  guards.filter(g => g.status === 'alert').forEach(g => alertSet.set(g.id, { guard: g, reason: 'status' }));
  missedCheckins.forEach(g => { if (!alertSet.has(g.id)) alertSet.set(g.id, { guard: g, reason: 'missed' }); });
  const combinedAlerts = Array.from(alertSet.values()).map(v => v.guard);
  const recentAlerts = combinedAlerts.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
            <p className="text-muted-foreground mt-1">
              Real-time overview of all security operations
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground w-full sm:w-auto">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{format(now, 'HH:mm:ss')}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="glow" size="sm" className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Guards"
            value={stats.totalGuards}
            icon={Users}
            variant="info"
            to="/guards"
          />
          <StatCard
            title="Clocked In"
            value={stats.activeGuards}
            icon={UserCheck}
            variant="success"
            to="/guards?status=online"
          />
          <StatCard
            title="Not On Site"
            value={notOnSiteCount}
            icon={UserX}
            variant="destructive"
            to="/guards?filter=not-on-site"
          />
          <StatCard
            title="Offline"
            value={stats.offlineGuards}
            icon={UserX}
            variant="destructive"
            to="/guards?status=offline"
          />
          <StatCard
            title="Total Sites"
            value={stats.totalSites}
            icon={Building2}
            to="/sites"
          />
          <StatCard
            title="Active Sites"
            value={stats.activeSites}
            icon={MapPin}
            variant="success"
            to="/sites"
          />
          <StatCard
            title={`Attrition (${attritionPercent}%)`}
            value={`${workingToday}/${expectedAssigned}`}
            icon={Users}
            variant="warning"
            to="/guards"
          />
          <StatCard
            title="Alerts"
            value={stats.alertGuards}
            icon={AlertTriangle}
            variant="destructive"
            to="/alerts"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Map - Takes 2 columns */}
          <Card variant="elevated" className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Live Guard Positions
              </CardTitle>
              <Link to="/live-map">
                <Button variant="ghost" size="sm">
                  Expand Map →
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] rounded-b-lg overflow-hidden">
                <LiveMap 
                  guards={guards} 
                  sites={sites}
                  showGeofences={true}
                />
              </div>
            </CardContent>
          </Card>

          {/* Guard List Panel */}
          <Card variant="elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Guard Status
                </CardTitle>
                <Badge variant="secondary" className="font-mono">
                  {guards.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <GuardList 
                guards={guards.slice(0, 20)} 
                maxHeight="340px"
              />
              <Link to="/guards">
                <Button variant="ghost" className="w-full mt-4">
                  View All Guards →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {recentAlerts.length > 0 && (
          <Card variant="elevated" className="border-destructive/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentAlerts.map(guard => (
                  <Link to="/alerts" key={guard.id} className="block">
                    <div 
                      className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors"
                    >
                      <div className="status-dot status-alert" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{guard.name}</p>
                        <p className="text-xs text-muted-foreground">{guard.employeeId}</p>
                      </div>
                            <Badge variant="alert">{(!attendanceLogs.find(l => l.guardId === guard.id) || !guard.clockInTime) ? 'Missed Check-in' : 'Alert'}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Clock-in Time</p>
                  <p className="text-2xl font-bold font-mono mt-1">{dashboardStats.avgClockInTime}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Geofence Compliance</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-success">{dashboardStats.geofenceCompliance}%</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Clocked In Today</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-warning">{dashboardStats.clockedInToday}/{dashboardStats.totalGuards}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
