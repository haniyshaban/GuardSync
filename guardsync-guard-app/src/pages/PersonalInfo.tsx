import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Building,
  Edit2,
  Save,
  X,
  Shield,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import { errorMessage } from '@/lib/apiError';
import { Guard } from '@/types/guard';

type EditMode = 'none' | 'contact' | 'bank';

// The guard record PUT /guards/:id/profile answers with (only the fields this page uses)
interface SavedProfile {
  address?: string | null;
  emergencyContact?: string | null;
  bankDetails?: Guard['bankDetails'] | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  address: 'address',
  emergencyContact: 'emergency contact',
  bankAccountNumber: 'account number',
  bankIfsc: 'IFSC code',
  bankName: 'bank name',
  accountHolderName: 'account holder name',
};

// Which of the sent fields the saved record does not show (the account number comes back masked)
const fieldsNotSaved = (changes: Record<string, string>, saved: SavedProfile | undefined) =>
  Object.entries(changes)
    .filter(([field, value]) => {
      if (field === 'bankAccountNumber') return !saved?.bankDetails?.accountNumber?.endsWith(value.slice(-4));
      return saved?.[field as keyof SavedProfile] !== value;
    })
    .map(([field]) => FIELD_LABELS[field] || field);

export default function PersonalInfo() {
  const navigate = useNavigate();
  const { guard, updateGuard } = useAuth();
  const { toast } = useToast();

  const [editMode, setEditMode] = useState<EditMode>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contact form state. The phone number is not here: only a supervisor can change it.
  const contactFromGuard = () => ({
    address: guard?.address || '',
    emergencyContact: guard?.emergencyContact || '',
  });
  const [contactForm, setContactForm] = useState(contactFromGuard);

  // Bank form state. The account number starts empty: the app only ever has the masked number,
  // and saving that would overwrite the real one. It is sent only when the guard types a new one.
  const bankFromGuard = () => ({
    accountNumber: '',
    ifsc: guard?.bankDetails?.ifsc || '',
    bankName: guard?.bankDetails?.bankName || '',
    accountHolderName: guard?.bankDetails?.accountHolderName || '',
  });
  const [bankForm, setBankForm] = useState(bankFromGuard);

  // Each edit starts from what is saved now
  const startEdit = (mode: EditMode) => {
    setContactForm(contactFromGuard());
    setBankForm(bankFromGuard());
    setEditMode(mode);
  };

  const handleCancelEdit = () => {
    setEditMode('none');
  };

  const showError = (description: string) => {
    toast({ title: 'Update Failed', description, variant: 'destructive' });
  };

  // Sends only the changed fields. The screen then shows what the server saved.
  const saveProfile = async (changes: Record<string, string>, successTitle: string, successText: string) => {
    if (!guard?.id) return;
    if (Object.keys(changes).length === 0) {
      setEditMode('none');
      toast({ title: 'No changes', description: 'Nothing was changed.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.put<SavedProfile>(`/guards/${guard.id}/profile`, changes);
      if (!response.success) {
        showError(errorMessage(response.error, 'Your changes were not saved. Please try again.'));
        return;
      }
      const saved = response.data;
      updateGuard({
        address: saved?.address || undefined,
        emergencyContact: saved?.emergencyContact || undefined,
        bankDetails: {
          accountNumber: saved?.bankDetails?.accountNumber || undefined,
          ifsc: saved?.bankIfsc || undefined,
          bankName: saved?.bankName || undefined,
          accountHolderName: saved?.accountHolderName || undefined,
        },
      });
      setEditMode('none');
      const notSaved = fieldsNotSaved(changes, saved);
      if (notSaved.length > 0) {
        showError(`These were not saved: ${notSaved.join(', ')}. Please try again or ask your supervisor.`);
        return;
      }
      toast({ title: successTitle, description: successText });
    } catch (error) {
      showError(errorMessage(error, 'Your changes were not saved. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveContact = async () => {
    const address = contactForm.address.trim();
    const emergencyContact = contactForm.emergencyContact.trim();
    const changes: Record<string, string> = {};
    // A cleared field is left as it is (the server keeps the saved value)
    if (address && address !== (guard?.address || '')) changes.address = address;
    if (emergencyContact && emergencyContact !== (guard?.emergencyContact || '')) {
      if (emergencyContact.length < 10 || emergencyContact.length > 15) {
        showError('Emergency contact must be 10 to 15 characters.');
        return;
      }
      changes.emergencyContact = emergencyContact;
    }
    await saveProfile(changes, 'Contact Updated', 'Your contact information has been saved.');
  };

  const handleSaveBank = async () => {
    const accountNumber = bankForm.accountNumber.replace(/\s/g, '');
    const ifsc = bankForm.ifsc.trim().toUpperCase();
    const bankName = bankForm.bankName.trim();
    const accountHolderName = bankForm.accountHolderName.trim();
    const saved = guard?.bankDetails;
    const changes: Record<string, string> = {};

    if (accountNumber) {
      if (!/^\d{9,18}$/.test(accountNumber)) {
        showError('Account number must be 9 to 18 digits.');
        return;
      }
      changes.bankAccountNumber = accountNumber;
    }
    if (ifsc && ifsc !== (saved?.ifsc || '')) {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        showError('Please enter a valid IFSC code (for example SBIN0001234).');
        return;
      }
      changes.bankIfsc = ifsc;
    }
    if (bankName && bankName !== (saved?.bankName || '')) changes.bankName = bankName;
    if (accountHolderName && accountHolderName !== (saved?.accountHolderName || '')) {
      changes.accountHolderName = accountHolderName;
    }
    await saveProfile(changes, 'Bank Details Updated', 'Your bank information has been saved.');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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

        <h1 className="text-2xl font-bold text-foreground mb-6">Personal Information</h1>

        {/* Basic Info Card - Read Only */}
        <Card className="glass-card mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium text-foreground">{guard?.name || 'N/A'}</p>
              </div>
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-mono font-medium text-primary">{guard?.employeeId || 'N/A'}</p>
              </div>
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{guard?.email || 'N/A'}</p>
              </div>
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Date of Joining</p>
                <p className="font-medium text-foreground">{formatDate(guard?.dateOfJoining)}</p>
              </div>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily Rate</p>
                <p className="font-medium text-foreground">
                  ₹{guard?.dailyRate?.toLocaleString('en-IN') || 'N/A'}/day
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information Card - Editable */}
        <Card className="glass-card mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                Contact Information
              </CardTitle>
              {editMode !== 'contact' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit('contact')}
                  className="text-primary"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode === 'contact' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={guard?.phone || ''}
                    readOnly
                    disabled
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    To change your phone number, ask your supervisor.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={contactForm.address}
                    onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                    placeholder="Enter your address"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency">Emergency Contact</Label>
                  <Input
                    id="emergency"
                    value={contactForm.emergencyContact}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyContact: e.target.value })}
                    placeholder="+91 98765 43211"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="gradient"
                    className="flex-1"
                    onClick={handleSaveContact}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{guard?.phone || 'N/A'}</p>
                  </div>
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground">{guard?.address || 'Not provided'}</p>
                  </div>
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium text-foreground">{guard?.emergencyContact || 'Not provided'}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Documents Card - Read Only */}
        <Card className="glass-card mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aadhar Number</p>
                <p className="font-mono font-medium text-foreground">
                  {guard?.documents?.aadharNumber || 'Not provided'}
                </p>
              </div>
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PAN Number</p>
                <p className="font-mono font-medium text-foreground">
                  {guard?.documents?.panNumber || 'Not provided'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Contact admin to update document details
            </p>
          </CardContent>
        </Card>

        {/* Bank Details Card - Editable */}
        <Card className="glass-card mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Bank Details
              </CardTitle>
              {editMode !== 'bank' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit('bank')}
                  className="text-primary"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode === 'bank' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="accountHolder">Account Holder Name</Label>
                  <Input
                    id="accountHolder"
                    value={bankForm.accountHolderName}
                    onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                    placeholder="Name as per bank records"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    placeholder={guard?.bankDetails?.accountNumber
                      ? `Leave empty to keep ${guard.bankDetails.accountNumber}`
                      : 'Enter account number'}
                    inputMode="numeric"
                    autoComplete="off"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc">IFSC Code</Label>
                  <Input
                    id="ifsc"
                    value={bankForm.ifsc}
                    onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g., SBIN0001234"
                    className="bg-secondary/50 uppercase"
                    maxLength={11}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    placeholder="e.g., State Bank of India"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="gradient"
                    className="flex-1"
                    onClick={handleSaveBank}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Account Holder</p>
                    <p className="font-medium text-foreground">
                      {guard?.bankDetails?.accountHolderName || 'Not provided'}
                    </p>
                  </div>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="font-mono font-medium text-foreground">
                      {guard?.bankDetails?.accountNumber || 'Not provided'}
                    </p>
                  </div>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">IFSC Code</p>
                    <p className="font-mono font-medium text-foreground">
                      {guard?.bankDetails?.ifsc || 'Not provided'}
                    </p>
                  </div>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Name</p>
                    <p className="font-medium text-foreground">
                      {guard?.bankDetails?.bankName || 'Not provided'}
                    </p>
                  </div>
                  <Building className="w-4 h-4 text-muted-foreground" />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
