import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Inbox, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { API_BASE_URL } from '@/lib/utils';
import { fetchJson, fetchWithAuth, parseApiData } from '@/lib/api';

interface SupportTicket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  response?: string;
}

export default function SupportPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch existing tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/support-tickets`);
        if (res.ok) {
          const data = await res.json();
          const tickets = parseApiData<SupportTicket[]>(data);
          setTickets(Array.isArray(tickets) ? tickets : []);
        }
      } catch (err) {
        console.error('Failed to fetch tickets:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTickets();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // The reply is {success, data: ticket}; only the ticket goes into the list
      const ticket = await fetchJson<SupportTicket>(`${API_BASE_URL}/api/support-tickets`, 'POST', { name, email, subject, message });
      if (ticket && ticket.id) setTickets(prev => [ticket, ...prev]);
      setName(''); setEmail(''); setSubject(''); setMessage('');
      
      toast({
        title: 'Ticket submitted',
        description: 'Your support request has been recorded. We will respond via email.',
      });
    } catch (err) {
      console.error('Submit failed:', err);
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Could not submit ticket. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Submit Support Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you encounter issues with the app, describe them below and our support team will respond.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Your name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2" placeholder="John Doe" />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" placeholder="john@example.com" type="email" />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2" placeholder="Brief description of the issue" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Message</label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="mt-2" rows={6} placeholder="Please describe your issue in detail..." />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setName(''); setEmail(''); setSubject(''); setMessage(''); }}>
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Existing Tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5" />
              Your Tickets ({tickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No support tickets yet. Submit one above if you need help.
              </p>
            ) : (
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{ticket.subject}</h4>
                          <Badge variant={ticket.status === 'open' ? 'warning' : 'success'}>
                            {ticket.status === 'open' ? (
                              <><Clock className="w-3 h-3 mr-1" />Open</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" />Resolved</>
                            )}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{ticket.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted {ticket.createdAt && !isNaN(Date.parse(ticket.createdAt)) ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }) : 'just now'}
                        </p>
                        {ticket.response && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Response:</p>
                            <p className="text-sm">{ticket.response}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
