import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  MapPin,
  User,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { ConveyanceRequest } from '@/types';
import { getPendingConveyanceRequests, respondToConveyanceRequest } from '@/services/staffApi';

export default function ConveyanceApprovals() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  const [requests, setRequests] = useState<ConveyanceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ConveyanceRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'deny' | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fetch pending requests from API
  const fetchRequests = async () => {
    try {
      const response = await getPendingConveyanceRequests();
      if (response.success && response.data) {
        setRequests(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch conveyance requests:', err);
      toast({
        title: 'Error',
        description: 'Failed to fetch requests. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Poll for new requests every 30 seconds
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleAction = (request: ConveyanceRequest, action: 'approve' | 'deny') => {
    setSelectedRequest(request);
    setActionType(action);
    setNotes('');
  };

  const confirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    setIsLoading(true);

    try {
      const response = await respondToConveyanceRequest(
        selectedRequest.id,
        actionType,
        staff?.id || '',
        notes || undefined
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to process request');
      }

      // Update local state
      setRequests(prev =>
        prev.map(r => r.id === selectedRequest.id ? response.data! : r)
      );

      toast({
        title: actionType === 'approve' ? 'Request Approved' : 'Request Denied',
        description: `Conveyance request for ${selectedRequest.guardName} has been ${actionType === 'approve' ? 'approved' : 'denied'}.`,
      });
    } catch (err) {
      console.error('Failed to process request:', err);
      toast({
        title: 'Error',
        description: 'Failed to process the request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSelectedRequest(null);
      setActionType(null);
      setNotes('');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Action Confirmation Dialog */}
      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
        setSelectedRequest(null);
        setActionType(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={actionType === 'approve' ? 'text-primary' : 'text-destructive'}>
              {actionType === 'approve' ? 'Approve' : 'Deny'} Conveyance Request
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? `This will allow ${selectedRequest?.guardName} to leave their assigned geofence.`
                : `This will deny ${selectedRequest?.guardName}'s request to leave their assigned geofence.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="glass-card p-3">
              <p className="text-sm text-muted-foreground mb-1">Guard</p>
              <p className="font-medium text-foreground">{selectedRequest?.guardName}</p>
            </div>

            <div className="glass-card p-3">
              <p className="text-sm text-muted-foreground mb-1">Reason</p>
              <p className="text-sm text-foreground">{selectedRequest?.reason}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Notes (Optional)</p>
              <Textarea
                placeholder="Add any notes for the guard..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'success' : 'destructive'}
              onClick={confirmAction}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : `Confirm ${actionType === 'approve' ? 'Approval' : 'Denial'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="p-6 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Conveyance Approvals</h1>
            <p className="text-sm text-muted-foreground">Review guard requests</p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={isFetching}
            className="ml-auto w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Loading State */}
        {isFetching && requests.length === 0 && (
          <div className="glass-card p-8 text-center mb-6">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin mb-3" />
            <p className="text-muted-foreground">Loading requests...</p>
          </div>
        )}

        {/* Pending Requests */}
        {!isFetching && pendingRequests.length > 0 ? (
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-medium text-foreground">
                Pending Requests ({pendingRequests.length})
              </h2>
            </div>

            {pendingRequests.map((request) => (
              <div key={request.id} className="glass-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{request.guardName}</p>
                      <p className="text-xs text-muted-foreground">{request.siteName}</p>
                    </div>
                  </div>
                  <Badge variant="warning" className="bg-warning/20 text-warning">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTimeAgo(request.requestedAt)}
                  </Badge>
                </div>

                <p className="text-sm text-foreground mb-3">{request.reason}</p>

                <div className="flex items-center gap-2 mb-4 text-muted-foreground text-xs">
                  <Clock className="w-3 h-3" />
                  <span>Est. {request.estimatedDuration} mins</span>
                  <span className="mx-2">•</span>
                  <MapPin className="w-3 h-3" />
                  <span>GPS tracked</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => handleAction(request, 'deny')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Deny
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAction(request, 'approve')}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : !isFetching ? (
          <div className="glass-card p-8 text-center mb-6">
            <Check className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground">No pending requests to review.</p>
          </div>
        ) : null}

        {/* Processed Requests */}
        {processedRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">
              Recently Processed ({processedRequests.length})
            </h2>

            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {processedRequests.map((request) => (
                  <div key={request.id} className="glass-card p-3 opacity-75">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          request.status === 'approved' ? 'bg-primary/10' : 'bg-destructive/20'
                        }`}>
                          {request.status === 'approved' ? (
                            <Check className="w-4 h-4 text-primary" />
                          ) : (
                            <X className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{request.guardName}</p>
                          <p className="text-xs text-muted-foreground">
                            {request.status === 'approved' ? 'Approved' : 'Denied'} {formatTimeAgo(request.respondedAt || '')}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={request.status === 'approved' ? 'success' : 'destructive'}
                        className="text-xs"
                      >
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
