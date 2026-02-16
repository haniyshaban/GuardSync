import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth, parseApiData } from '@/lib/api';
import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: string;
  guardId: string;
  siteId?: string;
  clockIn: string;
  clockOut?: string;
  withinGeofence: boolean;
  location?: { lat: number; lng: number };
  date: string;
}

interface Guard {
  id: string;
  name: string;
  employeeId: string;
}

interface Site {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [toDate, setToDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [fromDateObj, setFromDateObj] = useState<Date>(new Date(fromDate));
  const [toDateObj, setToDateObj] = useState<Date>(new Date(toDate));
  const [siteId, setSiteId] = useState<string>('all');
  const [reportType, setReportType] = useState<string>('attendance');
  
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch guards and sites for lookups
        const [guardsRes, sitesRes] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/api/guards`),
          fetchWithAuth(`${API_BASE_URL}/api/sites`),
        ]);
        
        if (guardsRes.ok) {
          const guardsData = await guardsRes.json();
          const guards = parseApiData<Guard[]>(guardsData);
          setGuards(Array.isArray(guards) ? guards : []);
        }
        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          const sites = parseApiData<Site[]>(sitesData);
          setSites(Array.isArray(sites) ? sites : []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch attendance when filters change
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const params = new URLSearchParams({
          from: fromDate,
          to: toDate,
        });
        if (siteId !== 'all') params.append('siteId', siteId);
        
        const res = await fetchWithAuth(`${API_BASE_URL}/api/attendance?${params}`);
        if (res.ok) {
          const data = await res.json();
          const attendance = parseApiData<AttendanceRecord[]>(data);
          setAttendance(Array.isArray(attendance) ? attendance : []);
        }
      } catch (err) {
        console.error('Failed to fetch attendance:', err);
      }
    };
    fetchAttendance();
  }, [fromDate, toDate, siteId]);

  const guardsById = useMemo(() => Object.fromEntries(guards.map(g => [g.id, g])), [guards]);
  const sitesById = useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites]);

  const filtered = useMemo(() => {
    return attendance.map(l => ({
      ...l,
      guard: guardsById[l.guardId],
      site: sitesById[l.siteId || ''],
    }));
  }, [attendance, guardsById, sitesById]);

  function downloadCSV() {
    const rows = filtered.map(r => ({
      id: r.id,
      guardId: r.guardId,
      guardName: r.guard?.name || '',
      siteId: r.siteId || '',
      siteName: r.site?.name || '',
      clockIn: r.clockIn ? new Date(r.clockIn).toISOString() : '',
      clockOut: r.clockOut ? new Date(r.clockOut).toISOString() : '',
      withinGeofence: String(r.withinGeofence),
    }));

    if (rows.length === 0) {
      rows.push({ id: '', guardId: '', guardName: '', siteId: '', siteName: '', clockIn: '', clockOut: '', withinGeofence: '' });
    }

    const header = Object.keys(rows[0]).join(',') + '\n';
    const csv = header + rows.map(row => Object.values(row).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportType}-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPrintable() {
    const html = `
      <html><head><title>Report</title></head><body>
        <h2>Report: ${reportType}</h2>
        <p>From: ${fromDate} To: ${toDate}</p>
        <table border="1" cellpadding="6" cellspacing="0">
          <thead><tr><th>ID</th><th>Guard</th><th>Site</th><th>Clock In</th><th>Clock Out</th><th>Within Geofence</th></tr></thead>
          <tbody>
            ${filtered.map(r => `<tr><td>${r.id}</td><td>${r.guard?.name || ''}</td><td>${r.site?.name || r.siteId || ''}</td><td>${r.clockIn ? new Date(r.clockIn).toLocaleString() : ''}</td><td>${r.clockOut ? new Date(r.clockOut).toLocaleString() : ''}</td><td>${r.withinGeofence}</td></tr>`).join('')}
          </tbody>
        </table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">Generate and export attendance and activity reports.</p>
          </div>
        </div>

        <Card>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Input readOnly value={fromDate} className="mt-2 cursor-pointer" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fromDateObj}
                      onSelect={(d) => {
                        if (d) {
                          const dd = Array.isArray(d) ? d[0] : d as Date;
                          setFromDate(format(dd, 'yyyy-MM-dd'));
                          setFromDateObj(dd);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Input readOnly value={toDate} className="mt-2 cursor-pointer" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={toDateObj}
                      onSelect={(d) => {
                        if (d) {
                          const dd = Array.isArray(d) ? d[0] : d as Date;
                          setToDate(format(dd, 'yyyy-MM-dd'));
                          setToDateObj(dd);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Site</label>
                <Select onValueChange={(v) => setSiteId(v)} defaultValue="all">
                  <SelectTrigger className="w-full mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sites</SelectItem>
                    {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Report Type</label>
                <Select onValueChange={(v) => setReportType(v)} defaultValue="attendance">
                  <SelectTrigger className="w-full mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="activity">Guard Activity</SelectItem>
                    <SelectItem value="geofence">Geofence Breaches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <Button onClick={downloadCSV} className="w-full md:w-auto">Export CSV</Button>
              <Button variant="outline" onClick={openPrintable} className="w-full md:w-auto">Export PDF (Print)</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview ({filtered.length} rows) {isLoading && <Loader2 className="w-4 h-4 inline ml-2 animate-spin" />}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-2">ID</th>
                    <th className="p-2">Guard</th>
                    <th className="p-2">Site</th>
                    <th className="p-2">Clock In</th>
                    <th className="p-2">Clock Out</th>
                    <th className="p-2">Within Geofence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        {isLoading ? 'Loading...' : 'No attendance records found for the selected filters.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 text-sm">{r.id}</td>
                        <td className="p-2 text-sm">{r.guard?.name || r.guardId}</td>
                        <td className="p-2 text-sm">{r.site?.name || r.siteId || '—'}</td>
                        <td className="p-2 text-sm">{r.clockIn ? format(new Date(r.clockIn), 'PPpp') : '—'}</td>
                        <td className="p-2 text-sm">{r.clockOut ? format(new Date(r.clockOut), 'PPpp') : '—'}</td>
                        <td className="p-2 text-sm">{r.withinGeofence ? '✓ Yes' : '✗ No'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
