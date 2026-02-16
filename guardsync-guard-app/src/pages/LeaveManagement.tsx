import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LeaveRequest } from '@/types/guard';
import api from '@/services/api';

export default function LeaveManagement() {
  const navigate = useNavigate();
  const { guard } = useAuth();
  const { toast } = useToast();

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New leave request form state
  const [newLeave, setNewLeave] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    leaveType: 'casual' as LeaveRequest['leaveType'],
  });

  // Fetch leave requests from API
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      if (!guard?.id) return;
      
      setIsLoading(true);
      try {
        const response = await api.get<LeaveRequest[]>(`/leave-requests?guardId=${guard.id}`);
        if (response.success && response.data) {
          setLeaveRequests(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch leave requests:', error);
        toast({
          title: 'Error',
          description: 'Failed to load leave history',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaveRequests();
  }, [guard?.id]);

  const getStatusColor = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-accent/20 text-accent';
      case 'pending':
        return 'bg-warning/20 text-warning';
      case 'rejected':
        return 'bg-destructive/20 text-destructive';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  const getStatusIcon = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getLeaveTypeLabel = (type: LeaveRequest['leaveType']) => {
    switch (type) {
      case 'casual':
        return 'Casual Leave';
      case 'sick':
        return 'Sick Leave';
      case 'emergency':
        return 'Emergency Leave';
      case 'annual':
        return 'Annual Leave';
      default:
        return type;
    }
  };

  const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleSubmitLeave = async () => {
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (new Date(newLeave.startDate) > new Date(newLeave.endDate)) {
      toast({
        title: 'Invalid Dates',
        description: 'End date must be after start date',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit to API
      const response = await api.post<LeaveRequest>('/leave-requests', {
        guardId: guard?.id,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        reason: newLeave.reason,
        leaveType: newLeave.leaveType,
      });

      if (response.success && response.data) {
        setLeaveRequests([response.data, ...leaveRequests]);
        setNewLeave({ startDate: '', endDate: '', reason: '', leaveType: 'casual' });
        setIsDialogOpen(false);

        toast({
          title: 'Leave Request Submitted',
          description: 'Your leave request is pending approval',
        });
      } else {
        throw new Error(response.error || 'Failed to submit');
      }
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    try {
      const response = await api.delete(`/leave-requests/${id}`);
      if (response.success) {
        setLeaveRequests(leaveRequests.filter((lr) => lr.id !== id));
        toast({
          title: 'Request Cancelled',
          description: 'Your leave request has been cancelled',
        });
      } else {
        throw new Error('Failed to cancel');
      }
    } catch (error) {
      toast({
        title: 'Failed to Cancel',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  // Calculate leave statistics
  const stats = {
    total: leaveRequests.length,
    approved: leaveRequests.filter((lr) => lr.status === 'approved').length,
    pending: leaveRequests.filter((lr) => lr.status === 'pending').length,
    rejected: leaveRequests.filter((lr) => lr.status === 'rejected').length,
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
            <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
            <p className="text-sm text-muted-foreground">Request and track your leaves</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Fill in the details for your leave request
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select
                    value={newLeave.leaveType}
                    onValueChange={(value: LeaveRequest['leaveType']) =>
                      setNewLeave({ ...newLeave, leaveType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="emergency">Emergency Leave</SelectItem>
                      <SelectItem value="annual">Annual Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newLeave.startDate}
                      onChange={(e) =>
                        setNewLeave({ ...newLeave, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newLeave.endDate}
                      onChange={(e) =>
                        setNewLeave({ ...newLeave, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                {newLeave.startDate && newLeave.endDate && (
                  <p className="text-sm text-muted-foreground">
                    Duration: {calculateDays(newLeave.startDate, newLeave.endDate)} day(s)
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please provide a reason for your leave request"
                    value={newLeave.reason}
                    onChange={(e) =>
                      setNewLeave({ ...newLeave, reason: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={handleSubmitLeave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-bold text-accent">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-bold text-warning">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-bold text-destructive">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </div>
        </div>

        {/* Leave Requests List */}
        <h2 className="text-lg font-semibold text-foreground mb-3">My Requests</h2>
        <div className="space-y-3">
          {leaveRequests.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No leave requests found</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsDialogOpen(true)}
              >
                Request Leave
              </Button>
            </div>
          ) : (
            leaveRequests.map((request) => (
              <Card key={request.id} className="glass-card border-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusIcon(request.status)}
                        <span className="ml-1 capitalize">{request.status}</span>
                      </Badge>
                      <Badge variant="outline">
                        {getLeaveTypeLabel(request.leaveType)}
                      </Badge>
                    </div>
                    {request.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleCancelRequest(request.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      {formatDate(request.startDate)}
                      {request.startDate !== request.endDate &&
                        ` - ${formatDate(request.endDate)}`}
                    </span>
                    <span className="text-muted-foreground">
                      ({calculateDays(request.startDate, request.endDate)} day
                      {calculateDays(request.startDate, request.endDate) > 1 ? 's' : ''})
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    {request.reason}
                  </p>

                  {request.adminNotes && (
                    <div className="mt-2 p-2 bg-secondary/50 rounded-md">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Admin Note:</span> {request.adminNotes}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    Applied on {formatDate(request.appliedAt)}
                    {request.reviewedAt && ` • Reviewed on ${formatDate(request.reviewedAt)}`}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
