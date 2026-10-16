import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Guard, Site, AttendanceLog, Shift } from '@/types';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Calendar, 
  Building2, 
  CreditCard,
  Shield,
  Edit2,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Banknote,
  Search,
  Trash2,
  FileText,
  Image,
  ExternalLink,
  Sun,
  Moon,
  ScanFace
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface GuardDocuments {
  photographUrl?: string | null;
  aadharDocUrl?: string | null;
  panDocUrl?: string | null;
  relievingLetterUrl?: string | null;
}

interface ExtendedGuard extends Guard {
  email?: string;
  address?: string;
  emergencyContact?: string;
  dateOfJoining?: string;
  dailyRate?: number;
  aadharNumber?: string;
  panNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  accountHolderName?: string;
  shiftType?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  documents?: GuardDocuments;
}

const GuardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [guard, setGuard] = useState<ExtendedGuard | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedGuard, setEditedGuard] = useState<Partial<ExtendedGuard>>({});
  
  // Site assignment dialog
  const [showSiteDialog, setShowSiteDialog] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  
  // Shift assignment dialog  
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [selectedShiftType, setSelectedShiftType] = useState<'day' | 'night' | null>(null);

  // Delete guard dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingFace, setIsResettingFace] = useState(false);

  // Document preview dialog
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; title: string } | null>(null);

  // Enrollment approval
  const [isApproving, setIsApproving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Fetch guard from API
  useEffect(() => {
    const loadGuard = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${id}`);
        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;
          setGuard(data);
          setEditedGuard(data);
          setSelectedSiteId(data.siteId);
          setSelectedShiftId(data.currentShiftId);
          setSelectedShiftType(data.shiftType || null);
        }
      } catch (e) {
        console.log('Could not load guard from backend');
      }
    };
    loadGuard();
  }, [id]);

  // Fetch all sites
  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/sites`);
        if (res.ok) {
          const data = await res.json();
          setSites(Array.isArray(data) ? data : data.data || []);
        }
      } catch (e) {
        console.log('Could not load sites');
      }
    };
    loadSites();
  }, []);

  // Fetch attendance for this guard
  useEffect(() => {
    const loadAttendance = async () => {
      if (!id) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetchWithAuth(`${API_BASE_URL}/api/attendance?guardId=${id}&date=${today}`);
        if (res.ok) {
          const response = await res.json();
          const data = Array.isArray(response) ? response : (response.data || []);
          if (Array.isArray(data) && data.length > 0) {
            setAttendance(data[0]);
          }
        }
      } catch (e) {
        console.log('Could not load attendance');
      }
    };
    loadAttendance();
  }, [id]);

  // Load site when guard changes
  useEffect(() => {
    if (!guard?.siteId) {
      setSite(null);
      return;
    }
    const loadSite = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/sites/${guard.siteId}`);
        if (res.ok) {
          const response = await res.json();
          setSite(response.data || response);
        }
      } catch (e) {
        console.log('Could not load site');
      }
    };
    loadSite();
  }, [guard?.siteId]);

  const saveGuardChanges = async () => {
    if (!guard) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guard, ...editedGuard }),
      });
      if (res.ok) {
        const response = await res.json();
        setGuard(response.data || response);
        setIsEditing(false);
        toast({ title: 'Guard updated', description: 'Changes saved successfully.' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    }
  };

  const assignToSite = async () => {
    if (!guard) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guard, siteId: selectedSiteId }),
      });
      if (res.ok) {
        const response = await res.json();
        setGuard(response.data || response);
        setShowSiteDialog(false);
        toast({ title: 'Site assigned', description: selectedSiteId ? 'Guard assigned to site.' : 'Guard unassigned from site.' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to assign site.', variant: 'destructive' });
    }
  };

  const assignShift = async () => {
    if (!guard) return;
    try {
      const shiftData: any = {
        currentShiftId: selectedShiftId,
        shiftType: selectedShiftType,
      };
      
      // Set default shift times based on shift type
      if (selectedShiftType === 'day') {
        shiftData.shiftStartTime = '06:00';
        shiftData.shiftEndTime = '18:00';
      } else if (selectedShiftType === 'night') {
        shiftData.shiftStartTime = '18:00';
        shiftData.shiftEndTime = '06:00';
      } else {
        shiftData.shiftStartTime = null;
        shiftData.shiftEndTime = null;
      }
      
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guard, ...shiftData }),
      });
      if (res.ok) {
        const response = await res.json();
        setGuard(response.data || response);
        setShowShiftDialog(false);
        toast({ title: 'Shift assigned', description: 'Guard shift updated.' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to assign shift.', variant: 'destructive' });
    }
  };

  const deleteGuard = async () => {
    if (!guard || deleteConfirmText.toLowerCase() !== 'delete') {
      toast({ title: 'Error', description: 'Please type "delete" to confirm.', variant: 'destructive' });
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Guard deleted', description: data.message || `${guard.name} has been removed from the system.` });
        navigate('/guards');
      } else {
        const data = await res.json();
        const errorMessage = data.error?.message || data.error || 'Failed to delete guard';
        throw new Error(errorMessage);
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to delete guard.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  };

  // Clears the enrolled face; the guard enrols again from their own phone at the next check-in.
  // (Nobody can set a face for a guard: whoever picks it could then log in as them.)
  const resetFace = async () => {
    if (!guard) return;
    setIsResettingFace(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}/face`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reset face');
      setGuard({ ...guard, faceEnrolled: false });
      toast({ title: 'Face reset', description: data.message || `${guard.name} will enrol again at their next check-in.` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to reset face.', variant: 'destructive' });
    } finally {
      setIsResettingFace(false);
    }
  };

  const openDocumentPreview = (url: string, title: string) => {
    // Prepend API base URL if the URL is a relative path
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    setPreviewDocument({ url: fullUrl, title });
    setShowDocumentPreview(true);
  };

  const approveGuard = async () => {
    if (!guard) return;
    
    setIsApproving(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setGuard(data.data.guard);
        toast({ 
          title: 'Enrollment Approved', 
          description: data.message || `${guard.name} has been approved and is now ${data.data.guard.status}.` 
        });
      } else {
        const data = await res.json();
        const errorMessage = data.error?.message || data.error || 'Failed to approve guard';
        throw new Error(errorMessage);
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to approve guard.', variant: 'destructive' });
    } finally {
      setIsApproving(false);
    }
  };

  const rejectGuard = async () => {
    if (!guard) return;
    
    setIsRejecting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards/${guard.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: 'Enrollment Rejected', 
          description: data.message || `${guard.name}'s enrollment has been rejected.` 
        });
        navigate('/guards');
      } else {
        const data = await res.json();
        const errorMessage = data.error?.message || data.error || 'Failed to reject guard';
        throw new Error(errorMessage);
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to reject guard.', variant: 'destructive' });
    } finally {
      setIsRejecting(false);
      setShowRejectDialog(false);
      setRejectReason('');
    }
  };

  if (!guard) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Guard not found</p>
              <Link to="/guards">
                <Button variant="outline" className="mt-4">Back to guards</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Helper: determine if guard has clocked in today
  const hasClockedInToday = (() => {
    if (attendance && attendance.clockIn) return isSameDay(new Date(attendance.clockIn), new Date());
    if (guard.clockInTime) return isSameDay(new Date(guard.clockInTime), new Date());
    return false;
  })();

  // Helper: determine guard's assigned/current shift label
  const shiftInfo = (() => {
    // First check guard's own shiftType property
    if (guard.shiftType) {
      return {
        id: guard.shiftType,
        label: guard.shiftType === 'day' ? 'Day Shift' : 'Night Shift',
        startTime: guard.shiftStartTime || (guard.shiftType === 'day' ? '08:00' : '20:00'),
        endTime: guard.shiftEndTime || (guard.shiftType === 'day' ? '20:00' : '08:00'),
      };
    }
    // Fallback to site shifts if defined
    if (!site || !site.shifts || site.shifts.length === 0) return null;
    if (guard.currentShiftId) {
      const s = site.shifts.find(sh => sh.id === guard.currentShiftId);
      if (s) return s;
    }
    return null;
  })();

  const filteredSites = sites.filter(s => 
    s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
    s.address.toLowerCase().includes(siteSearchQuery.toLowerCase())
  );

  const getStatusVariant = (status: string): "online" | "offline" | "idle" | "alert" | "pending" | "secondary" => {
    const validStatuses = ['online', 'offline', 'idle', 'alert', 'pending'];
    return validStatuses.includes(status) ? status as any : 'secondary';
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/guards')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {(guard.name || '??').split(' ').map(n => n[0]).join('').slice(0,2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{guard.name || 'Unknown Guard'}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono">{guard.employeeId || 'N/A'}</span>
                <span>•</span>
                <span>{guard.phone || 'No phone'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={getStatusVariant(guard.status)} className="capitalize text-sm px-3 py-1">
              {guard.status}
            </Badge>
            {!hasClockedInToday && guard.status !== 'pending' && (
              <Badge variant="alert" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Missed Check-in
              </Badge>
            )}
            {guard.status === 'pending' ? (
              // Show approval buttons for pending guards
              <>
                <Button 
                  variant="default" 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={approveGuard}
                  disabled={isApproving}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isApproving ? 'Approving...' : 'Approve Enrollment'}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowRejectDialog(true)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            ) : isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={saveGuardChanges}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Guard
              </Button>
            )}
          </div>
        </div>

        {/* Pending Enrollment Banner */}
        {guard.status === 'pending' && (
          <Card className="border-2 border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Pending Enrollment Review</p>
                  <p className="text-sm text-muted-foreground">
                    This guard has submitted their enrollment and is waiting for approval. Review their documents and information before approving.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assignment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Site Assignment Card */}
              <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Assigned Site</p>
                        <p className="font-semibold">
                          {site ? site.name : 'Not Assigned'}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowSiteDialog(true)}>
                      {site ? 'Change' : 'Assign'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Assignment Card */}
              <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Shift</p>
                        <p className="font-semibold">
                          {shiftInfo ? `${shiftInfo.label || 'Shift'} (${shiftInfo.startTime} - ${shiftInfo.endTime})` : 'Not Assigned'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowShiftDialog(true)}
                    >
                      {shiftInfo ? 'Change' : 'Assign'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Full Name</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.name || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, name: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{guard.name || 'Unknown'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Employee ID</label>
                    <p className="font-medium font-mono">{guard.employeeId || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Phone Number</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.phone || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, phone: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {guard.phone || 'No phone'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.email || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, email: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {guard.email || '—'}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Address</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.address || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, address: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{guard.address || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Emergency Contact</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.emergencyContact || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, emergencyContact: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{guard.emergencyContact || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Date of Joining</label>
                    {isEditing ? (
                      <Input 
                        type="date"
                        value={editedGuard.dateOfJoining || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, dateOfJoining: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {guard.dateOfJoining ? format(new Date(guard.dateOfJoining), 'PP') : '—'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Identity Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Identity Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Aadhar Number</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.aadharNumber || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, aadharNumber: e.target.value})}
                        className="mt-1"
                        placeholder="XXXX XXXX XXXX"
                      />
                    ) : (
                      <p className="font-medium font-mono">
                        {guard.aadharNumber ? `${guard.aadharNumber.slice(0,4)} •••• ••••` : '—'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">PAN Number</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.panNumber || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, panNumber: e.target.value})}
                        className="mt-1"
                        placeholder="ABCDE1234F"
                      />
                    ) : (
                      <p className="font-medium font-mono">
                        {guard.panNumber ? `${guard.panNumber.slice(0,5)}•••••` : '—'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Uploaded Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Photograph */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Image className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Photograph</p>
                          <p className="text-xs text-muted-foreground">Profile photo</p>
                        </div>
                      </div>
                      {guard.documents?.photographUrl ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openDocumentPreview(guard.documents!.photographUrl!, 'Photograph')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      ) : (
                        <Badge variant="secondary">Not uploaded</Badge>
                      )}
                    </div>
                  </div>

                  {/* Aadhar Document */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">Aadhar Card</p>
                          <p className="text-xs text-muted-foreground">Identity proof</p>
                        </div>
                      </div>
                      {guard.documents?.aadharDocUrl ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openDocumentPreview(guard.documents!.aadharDocUrl!, 'Aadhar Card')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      ) : (
                        <Badge variant="secondary">Not uploaded</Badge>
                      )}
                    </div>
                  </div>

                  {/* PAN Document */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium">PAN Card</p>
                          <p className="text-xs text-muted-foreground">Tax document</p>
                        </div>
                      </div>
                      {guard.documents?.panDocUrl ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openDocumentPreview(guard.documents!.panDocUrl!, 'PAN Card')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      ) : (
                        <Badge variant="secondary">Not uploaded</Badge>
                      )}
                    </div>
                  </div>

                  {/* Relieving Letter */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Relieving Letter</p>
                          <p className="text-xs text-muted-foreground">Previous employer</p>
                        </div>
                      </div>
                      {guard.documents?.relievingLetterUrl ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openDocumentPreview(guard.documents!.relievingLetterUrl!, 'Relieving Letter')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      ) : (
                        <Badge variant="secondary">Not uploaded</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5" />
                  Bank Details & Compensation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Bank Name</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.bankName || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, bankName: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{guard.bankName || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Account Holder Name</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.accountHolderName || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, accountHolderName: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{guard.accountHolderName || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Account Number</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.bankAccountNumber || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, bankAccountNumber: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium font-mono">
                        {guard.bankAccountNumber ? `••••••${guard.bankAccountNumber.slice(-4)}` : '—'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">IFSC Code</label>
                    {isEditing ? (
                      <Input 
                        value={editedGuard.bankIfsc || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, bankIfsc: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium font-mono">{guard.bankIfsc || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Daily Rate (₹)</label>
                    {isEditing ? (
                      <Input 
                        type="number"
                        value={editedGuard.dailyRate || ''} 
                        onChange={(e) => setEditedGuard({...editedGuard, dailyRate: Number(e.target.value)})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">
                        {guard.dailyRate ? `₹${guard.dailyRate.toLocaleString()}` : '—'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Current Status</span>
                  <Badge variant={getStatusVariant(guard.status)} className="capitalize">
                    {guard.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Clocked In</span>
                  {guard.clockedIn ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {guard.clockInTime && format(new Date(guard.clockInTime), 'HH:mm')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Last Seen</span>
                  <span className="text-sm font-medium">
                    {guard.lastSeen ? formatDistanceToNow(new Date(guard.lastSeen), { addSuffix: true }) : 'Never'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Location Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Last Known Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                {guard.location ? (
                  <>
                    <div className="h-48 w-full rounded-lg overflow-hidden">
                      <MapContainer 
                        center={[guard.location.lat, guard.location.lng]} 
                        zoom={15} 
                        className="h-full w-full" 
                        scrollWheelZoom={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[guard.location.lat, guard.location.lng]}>
                          <Popup>
                            {guard.name || 'Unknown'} <br /> {site?.name || 'Unknown site'}
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 font-mono text-center">
                      {guard.location.lat.toFixed(6)}, {guard.location.lng.toFixed(6)}
                    </p>
                  </>
                ) : (
                  <div className="h-48 w-full rounded-lg bg-muted/50 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No location data</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Attendance */}
            {attendance && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Today's Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Clock In</p>
                    <p className="font-medium">{format(new Date(attendance.clockIn), 'PPpp')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {attendance.withinGeofence ? '✓ Within geofence' : '⚠ Outside geofence'}
                    </p>
                  </div>
                  {attendance.clockOut && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">Clock Out</p>
                      <p className="font-medium">{format(new Date(attendance.clockOut), 'PPpp')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              {guard.faceEnrolled && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Resetting the face clears the guard's enrolled face. They enrol it again from their own phone at their next check-in. Admins only.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={isResettingFace} className="w-full sm:w-auto">
                        <ScanFace className="w-4 h-4 mr-2" />
                        {isResettingFace ? 'Resetting...' : 'Reset Face'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset {guard.name}'s face?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Their enrolled face is cleared and they enrol it again from their own phone at their next check-in. Until then, check-in has no face check.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={resetFace}>Reset Face</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-4">
                Deleting a guard will permanently remove their profile, attendance records, leave requests, and all associated data. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full sm:w-auto border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Guard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Site Assignment Dialog */}
      <Dialog open={showSiteDialog} onOpenChange={setShowSiteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Assign to Site
            </DialogTitle>
            <DialogDescription>
              Select a site to assign {guard.name || 'this guard'} to
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search sites..."
                value={siteSearchQuery}
                onChange={(e) => setSiteSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2">
              {/* Unassign option */}
              <div
                onClick={() => setSelectedSiteId(null)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSiteId === null 
                    ? 'bg-primary/10 border-2 border-primary' 
                    : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
                }`}
              >
                <p className="font-medium">Unassigned</p>
                <p className="text-xs text-muted-foreground">Remove from current site</p>
              </div>
              
              {filteredSites.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSiteId(s.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSiteId === s.id 
                      ? 'bg-primary/10 border-2 border-primary' 
                      : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
                  }`}
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.address}</p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSiteDialog(false)}>Cancel</Button>
            <Button onClick={assignToSite}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Assignment Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Assign Shift
            </DialogTitle>
            <DialogDescription>
              Select a shift for {guard.name || 'this guard'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {/* No Shift option */}
            <div
              onClick={() => setSelectedShiftType(null)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedShiftType === null 
                  ? 'bg-primary/10 border-2 border-primary' 
                  : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
              }`}
            >
              <p className="font-medium">No Shift</p>
              <p className="text-xs text-muted-foreground">Remove shift assignment</p>
            </div>
            
            {/* Day Shift option */}
            <div
              onClick={() => setSelectedShiftType('day')}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedShiftType === 'day' 
                  ? 'bg-amber-100 dark:bg-amber-900/20 border-2 border-amber-500 dark:border-amber-600 text-amber-900 dark:text-amber-100' 
                  : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
              }`}
              style={selectedShiftType === 'day' ? { color: '#78350f' } : undefined}
            >
              <div className="flex items-center gap-2">
                <Sun
                  className={`w-5 h-5 ${selectedShiftType === 'day' ? '!text-amber-600' : 'text-amber-500'}`}
                  style={selectedShiftType === 'day' ? { color: '#78350f' } : undefined}
                />
                <p className="font-medium" style={selectedShiftType === 'day' ? { color: '#78350f' } : undefined}>Day Shift</p>
              </div>
              <p className="text-xs mt-1" style={selectedShiftType === 'day' ? { color: '#92400e' } : undefined}>
                06:00 AM - 06:00 PM
              </p>
            </div>
            
            {/* Night Shift option */}
            <div
              onClick={() => setSelectedShiftType('night')}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedShiftType === 'night' 
                  ? 'bg-indigo-100 dark:bg-indigo-900/20 border-2 border-indigo-500 dark:border-indigo-600 text-indigo-900 dark:text-indigo-100' 
                  : 'bg-muted/50 hover:bg-muted border-2 border-transparent'
              }`}
              style={selectedShiftType === 'night' ? { color: '#4338ca' } : undefined}
            >
              <div className="flex items-center gap-2">
                <Moon
                  className={`w-5 h-5 ${selectedShiftType === 'night' ? '!text-indigo-600' : 'text-indigo-500'}`}
                  style={selectedShiftType === 'night' ? { color: '#4338ca' } : undefined}
                />
                <p className="font-medium" style={selectedShiftType === 'night' ? { color: '#4338ca' } : undefined}>Night Shift</p>
              </div>
              <p className="text-xs mt-1" style={selectedShiftType === 'night' ? { color: '#3730a3' } : undefined}>
                06:00 PM - 06:00 AM
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShiftDialog(false)}>Cancel</Button>
            <Button onClick={assignShift}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Guard Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmText('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Guard
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete <span className="font-semibold">{guard.name || 'this guard'}</span> and all their associated records including attendance, leave requests, and SOS alerts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive font-medium mb-2">Warning:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• All attendance records will be deleted</li>
                <li>• All leave requests will be deleted</li>
                <li>• All conveyance requests will be deleted</li>
                <li>• Guard profile will be permanently removed</li>
              </ul>
            </div>
            
            <div>
              <label className="text-sm font-medium">
                Type <span className="font-mono text-destructive">delete</span> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="mt-2"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmText('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteGuard}
              disabled={deleteConfirmText.toLowerCase() !== 'delete' || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Guard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={showDocumentPreview} onOpenChange={setShowDocumentPreview}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {previewDocument?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center p-4 bg-muted/30 rounded-lg min-h-[400px]">
            {previewDocument?.url ? (
              previewDocument.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img 
                  src={previewDocument.url} 
                  alt={previewDocument.title}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              ) : previewDocument.url.match(/\.pdf$/i) ? (
                <iframe
                  src={previewDocument.url}
                  className="w-full h-[60vh] rounded-lg"
                  title={previewDocument.title}
                />
              ) : (
                <div className="text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                  <a href={previewDocument.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in new tab
                    </Button>
                  </a>
                </div>
              )
            ) : (
              <p className="text-muted-foreground">No document available</p>
            )}
          </div>

          <DialogFooter>
            {previewDocument?.url && (
              <a href={previewDocument.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in new tab
                </Button>
              </a>
            )}
            <Button onClick={() => setShowDocumentPreview(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Enrollment Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        setShowRejectDialog(open);
        if (!open) setRejectReason('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="w-5 h-5" />
              Reject Enrollment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject <span className="font-semibold">{guard.name || 'this guard'}</span>'s enrollment? 
              This will remove their application from the system.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection (optional):</label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Incomplete documents, failed verification..."
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectReason('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={rejectGuard}
              disabled={isRejecting}
            >
              {isRejecting ? 'Rejecting...' : 'Reject Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GuardPage;
