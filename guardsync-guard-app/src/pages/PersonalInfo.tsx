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

type EditMode = 'none' | 'contact' | 'bank';

export default function PersonalInfo() {
  const navigate = useNavigate();
  const { guard, updateGuard } = useAuth();
  const { toast } = useToast();

  const [editMode, setEditMode] = useState<EditMode>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    phone: guard?.phone || '',
    address: guard?.address || '',
    emergencyContact: guard?.emergencyContact || '',
  });

  // Bank form state
  const [bankForm, setBankForm] = useState({
    accountNumber: guard?.bankDetails?.accountNumber || '',
    ifsc: guard?.bankDetails?.ifsc || '',
    bankName: guard?.bankDetails?.bankName || '',
    accountHolderName: guard?.bankDetails?.accountHolderName || '',
  });

  const handleCancelEdit = () => {
    // Reset forms to original values
    setContactForm({
      phone: guard?.phone || '',
      address: guard?.address || '',
      emergencyContact: guard?.emergencyContact || '',
    });
    setBankForm({
      accountNumber: guard?.bankDetails?.accountNumber || '',
      ifsc: guard?.bankDetails?.ifsc || '',
      bankName: guard?.bankDetails?.bankName || '',
      accountHolderName: guard?.bankDetails?.accountHolderName || '',
    });
    setEditMode('none');
  };

  const handleSaveContact = async () => {
    if (!guard?.id) return;

    setIsSubmitting(true);
    try {
      const response = await api.put(`/guards/${guard.id}/profile`, {
        address: contactForm.address,
        emergencyContact: contactForm.emergencyContact,
      });

      if (response.success) {
        updateGuard({
          phone: contactForm.phone,
          address: contactForm.address,
          emergencyContact: contactForm.emergencyContact,
        });
        setEditMode('none');
        toast({
          title: 'Contact Updated',
          description: 'Your contact information has been saved.',
        });
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBank = async () => {
    if (!guard?.id) return;

    // Validate IFSC format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankForm.ifsc.toUpperCase())) {
      toast({
        title: 'Invalid IFSC',
        description: 'Please enter a valid IFSC code',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.put(`/guards/${guard.id}/profile`, {
        bankAccountNumber: bankForm.accountNumber,
        bankIfsc: bankForm.ifsc.toUpperCase(),
        bankName: bankForm.bankName,
        accountHolderName: bankForm.accountHolderName,
      });

      if (response.success) {
        updateGuard({
          bankDetails: {
            accountNumber: bankForm.accountNumber,
            ifsc: bankForm.ifsc.toUpperCase(),
            bankName: bankForm.bankName,
            accountHolderName: bankForm.accountHolderName,
          },
        });
        setEditMode('none');
        toast({
          title: 'Bank Details Updated',
          description: 'Your bank information has been saved.',
        });
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
            <Separator className="bg-white/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-mono font-medium text-primary">{guard?.employeeId || 'N/A'}</p>
              </div>
            </div>
            <Separator className="bg-white/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{guard?.email || 'N/A'}</p>
              </div>
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <Separator className="bg-white/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Date of Joining</p>
                <p className="font-medium text-foreground">{formatDate(guard?.dateOfJoining)}</p>
              </div>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <Separator className="bg-white/10" />
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
                  onClick={() => setEditMode('contact')}
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
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="bg-secondary/50"
                  />
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
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground">{guard?.address || 'Not provided'}</p>
                  </div>
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
                <Separator className="bg-white/10" />
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
            <Separator className="bg-white/10" />
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
                  onClick={() => setEditMode('bank')}
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
                    placeholder="Enter account number"
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
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="font-mono font-medium text-foreground">
                      {guard?.bankDetails?.accountNumber || 'Not provided'}
                    </p>
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">IFSC Code</p>
                    <p className="font-mono font-medium text-foreground">
                      {guard?.bankDetails?.ifsc || 'Not provided'}
                    </p>
                  </div>
                </div>
                <Separator className="bg-white/10" />
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
