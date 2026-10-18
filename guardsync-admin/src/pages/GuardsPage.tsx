import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth, parseApiData } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Guard, Site } from '@/types';
import { 
  Users, 
  Search, 
  Filter, 
  Download,
  Phone,
  MapPin,
  Clock
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { isNotOnSite } from '@/lib/geofence';
import { downloadCsv } from '@/lib/csv';

type GuardFilter = Guard['status'] | 'all' | 'unassigned' | 'not-on-site';
const STATUS_FILTERS = ['all', 'online', 'idle', 'offline', 'alert', 'panic', 'pending', 'unassigned'];
const FILTER_BUTTONS: { value: GuardFilter; label: string }[] = [
  ...STATUS_FILTERS.map(value => ({ value: value as GuardFilter, label: value })),
  { value: 'not-on-site', label: 'not on site' },
];

export default function GuardsPage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GuardFilter>('all');
  const [searchParams, setSearchParams] = useSearchParams();

  // The filter follows the URL: ?status=online, ?filter=not-on-site (the dashboard's cards
  // link here), or nothing for all guards (e.g. the sidebar's Guards link).
  useEffect(() => {
    const status = searchParams.get('status');
    if (searchParams.get('filter') === 'not-on-site') {
      setStatusFilter('not-on-site');
    } else if (status && STATUS_FILTERS.includes(status)) {
      setStatusFilter(status as GuardFilter);
    } else {
      setStatusFilter('all');
    }
  }, [searchParams]);

  // Fetch guards from API
  useEffect(() => {
    const loadGuards = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/guards`);
        console.log('🔵 Guards fetch response:', res.status, res.ok);
        if (res.ok) {
          const json = await res.json();
          console.log('🔵 Guards API response:', json);
          const data = parseApiData(json);
          console.log('🔵 Guards data extracted:', Array.isArray(data) ? data.length : 'not array', 'guards');
          if (Array.isArray(data) && data.length > 0) {
            console.log('🔵 First guard sample:', data[0]);
          }
          if (Array.isArray(data)) {
            setGuards(data);
          }
        } else {
          console.error('❌ Guards fetch failed:', res.status);
        }
      } catch (e) {
        console.log('Could not load guards from backend', e);
      }
    };
    loadGuards();
    const interval = setInterval(loadGuards, 15000);
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

  const filteredGuards = guards.filter(guard => {
    const matchesSearch = (guard.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (guard.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (guard.phone || '').includes(searchQuery);
    let matchesStatus = false;
    if (statusFilter === 'all') matchesStatus = true;
    else if (statusFilter === 'unassigned') matchesStatus = !guard.siteId;
    else if (statusFilter === 'not-on-site') matchesStatus = isNotOnSite(guard, sites);
    else matchesStatus = guard.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSiteName = (siteId: string | null) => {
    if (!siteId) return 'Unassigned';
    const site = sites.find(s => s.id === siteId);
    return site?.name || 'Unknown Site';
  };

  const getStatusVariant = (status: Guard['status']): "online" | "offline" | "idle" | "alert" | "pending" | "secondary" => {
    if (status === 'panic') return 'alert';
    return (['online', 'offline', 'idle', 'alert', 'pending'] as const).find(v => v === status) ?? 'secondary';
  };

  // The guard's own shift comes first (same rule as the guard detail page), then the site's shifts
  const getShiftLabel = (guard: Guard): string => {
    const g = guard as any;
    if (g.shiftType) {
      const isDay = g.shiftType === 'day';
      const start = g.shiftStartTime || (isDay ? '08:00' : '20:00');
      const end = g.shiftEndTime || (isDay ? '20:00' : '08:00');
      return `${isDay ? 'Day' : 'Night'} ${start}-${end}`;
    }
    const site = sites.find(s => s.id === guard.siteId);
    if (!site) return '—';
    const shifts = (site as any).shifts as any[] | undefined;
    if (!shifts || shifts.length === 0) return '—';
    const s = shifts.find(ss => ss.id === guard.currentShiftId);
    return s ? (s.label || `${s.startTime}-${s.endTime}`) : '—';
  };

  // Downloads the guards currently shown (search and filter applied)
  const exportGuards = () => {
    downloadCsv(
      `guards-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Name', 'Employee ID', 'Phone', 'Email', 'Status', 'Assigned Site', 'Shift', 'Last Seen', 'Clocked In'],
      filteredGuards.map(g => [
        g.name || '',
        g.employeeId || '',
        g.phone || '',
        g.email || '',
        g.status,
        getSiteName(g.siteId ?? null),
        getShiftLabel(g),
        g.lastSeen ? new Date(g.lastSeen).toISOString() : '',
        g.clockedIn ? 'Yes' : 'No',
      ])
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Guard Management</h1>
              <p className="text-sm text-muted-foreground">
                {guards.length} total guards • {guards.filter(g => g.status === 'online').length} active
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            {/* Guards are added by enrolling in the guard app, then approved on their page */}
            <Button variant="outline" className="w-full sm:w-auto" onClick={exportGuards} disabled={filteredGuards.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2 overflow-auto">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {FILTER_BUTTONS.map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={statusFilter === value ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        setStatusFilter(value);
                        if (value === 'all') setSearchParams({});
                        else if (value === 'not-on-site') setSearchParams({ filter: value });
                        else setSearchParams({ status: value });
                      }}
                      className="capitalize whitespace-nowrap"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guards Table */}
        <Card variant="elevated">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Guard</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Assigned Site</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Shift</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Last Seen</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Clock Status</th>
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuards.map((guard, index) => (
                    <tr 
                      key={guard.id}
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="p-4">
                        <Link to={`/guards/${guard.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                              {(guard.name || '??').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 status-dot border-2 border-background status-${guard.status}`} />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-primary hover:underline">{guard.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{guard.employeeId || '—'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusVariant(guard.status)} className="capitalize">
                          {guard.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {getSiteName(guard.siteId)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {getShiftLabel(guard)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {guard.lastSeen ? formatDistanceToNow(new Date(guard.lastSeen), { addSuffix: true }) : 'Never'}
                        </div>
                      </td>
                      <td className="p-4">
                        {guard.clockedIn ? (
                          <div className="flex items-center gap-2 text-success text-sm">
                            <Clock className="w-4 h-4" />
                            {guard.clockInTime && format(guard.clockInTime, 'HH:mm')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not clocked in</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {guard.phone ? (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`tel:${guard.phone}`} aria-label={`Call ${guard.name || 'guard'}`} title={`Call ${guard.phone}`}>
                                <Phone className="w-4 h-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" disabled aria-label="No phone number">
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}
                          <Link to={`/guards/${guard.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
