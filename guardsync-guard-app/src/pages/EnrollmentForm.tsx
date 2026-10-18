import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Loader2, FileText, Lock, LogOut,
  User, CreditCard, Building, Phone, Mail, MapPin, Camera, Scan
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { FacialScanner } from '@/components/FacialScanner';
import { descriptorToString } from '@/services/FaceApiService';
import { errorMessage } from '@/lib/apiError';

type EnrollmentStep = 'personal' | 'face' | 'documents' | 'success';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  address: string;
  emergencyContact: string;
  aadharNumber: string;
  panNumber: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  accountHolderName: string;
}

export default function EnrollmentForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { guard, logout } = useAuth();

  const [step, setStep] = useState<EnrollmentStep>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    emergencyContact: '',
    aadharNumber: '',
    panNumber: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: '',
    accountHolderName: '',
  });

  // Face capture state
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<string | null>(null);
  const [isFaceCaptured, setIsFaceCaptured] = useState(false);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Aadhar Validation
  const validateAadhar = (aadhar: string): boolean => {
    const cleaned = aadhar.replace(/\D/g, '');
    return cleaned.length === 12;
  };

  // PAN Validation
  const validatePAN = (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  // Validate current step
  const validateStep = (currentStep: EnrollmentStep): boolean => {
    switch (currentStep) {
      case 'personal': {
        const fail = (title: string, description: string) => {
          toast({ title, description, variant: 'destructive' });
          return false;
        };
        if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
          return fail('Missing Information', 'Please fill in all required fields');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
          return fail('Invalid Email', 'Please enter a valid email address');
        }
        const phoneLength = formData.phone.trim().length;
        if (phoneLength < 10 || phoneLength > 15) {
          return fail('Invalid Phone Number', 'Phone number must be 10 to 15 characters');
        }
        const emergencyLength = formData.emergencyContact.trim().length;
        if (emergencyLength > 0 && (emergencyLength < 10 || emergencyLength > 15)) {
          return fail('Invalid Emergency Contact', 'Emergency contact must be 10 to 15 characters');
        }
        // The password is how the guard signs in once approved
        if (formData.password.length < 8) {
          return fail('Password Too Short', 'Choose a password of at least 8 characters');
        }
        if (formData.password !== formData.confirmPassword) {
          return fail('Passwords Do Not Match', 'Please type the same password twice');
        }
        return true;
      }

      case 'face':
        if (!isFaceCaptured || !faceDescriptor) {
          toast({
            title: 'Face Capture Required',
            description: 'Please capture your face for recognition',
            variant: 'destructive',
          });
          return false;
        }
        return true;

      case 'documents':
        if (!validateAadhar(formData.aadharNumber)) {
          toast({
            title: 'Invalid Aadhar',
            description: 'Please enter a valid 12-digit Aadhar number',
            variant: 'destructive',
          });
          return false;
        }
        if (!validatePAN(formData.panNumber)) {
          toast({
            title: 'Invalid PAN',
            description: 'Please enter a valid PAN number',
            variant: 'destructive',
          });
          return false;
        }
        if (!formData.bankAccountNumber || !formData.bankIfsc || !formData.bankName) {
          toast({
            title: 'Missing Bank Details',
            description: 'Please fill in all bank details',
            variant: 'destructive',
          });
          return false;
        }
        if (!/^\d{9,18}$/.test(formData.bankAccountNumber.replace(/\s/g, ''))) {
          toast({
            title: 'Invalid Account Number',
            description: 'Account number must be 9 to 18 digits',
            variant: 'destructive',
          });
          return false;
        }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.bankIfsc.trim().toUpperCase())) {
          toast({
            title: 'Invalid IFSC',
            description: 'Please enter a valid IFSC code (for example SBIN0001234)',
            variant: 'destructive',
          });
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  // Navigate to next step
  const handleNextStep = () => {
    if (validateStep(step)) {
      if (step === 'personal') setStep('face');
      else if (step === 'face') setStep('documents');
    }
  };

  // Navigate to previous step
  const handlePreviousStep = () => {
    if (step === 'face') setStep('personal');
    else if (step === 'documents') setStep('face');
  };

  // Handle face capture complete
  const handleFaceCaptureComplete = (success: boolean, descriptor?: Float32Array) => {
    setShowFaceCapture(false);
    if (success && descriptor) {
      const descriptorStr = descriptorToString(descriptor);
      setFaceDescriptor(descriptorStr);
      setIsFaceCaptured(true);
      toast({
        title: 'Face Captured',
        description: 'Your face has been enrolled for recognition.',
      });
    } else {
      toast({
        title: 'Capture Failed',
        description: 'Failed to capture face. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Final submission
  const handleSubmit = async () => {
    // Check every step again, so nothing invalid is sent
    if (!validateStep('personal')) {
      setStep('personal');
      return;
    }
    if (!validateStep('face')) {
      setStep('face');
      return;
    }
    if (!validateStep('documents')) return;

    // Only fields that were filled in are sent.
    // Documents are not uploaded: uploading needs a login, which a new guard does not have yet.
    // The success screen tells the guard that their supervisor collects them.
    const optional = (value: string) => (value.trim() ? value.trim() : undefined);
    const body = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
      address: optional(formData.address),
      emergencyContact: optional(formData.emergencyContact),
      aadharNumber: formData.aadharNumber.replace(/\D/g, ''),
      panNumber: formData.panNumber.trim().toUpperCase(),
      bankAccountNumber: formData.bankAccountNumber.replace(/\s/g, ''),
      bankIfsc: formData.bankIfsc.trim().toUpperCase(),
      bankName: formData.bankName.trim(),
      accountHolderName: optional(formData.accountHolderName),
      faceDescriptor,
    };

    setIsSubmitting(true);
    try {
      const response = await api.post('/guards/enroll', body);
      if (!response.success) {
        throw new Error(errorMessage(response.error, 'Could not submit your enrolment. Please try again.'));
      }
      setStep('success');
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: errorMessage(error, 'Could not submit your enrolment. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enrolment creates a new guard. Someone who is signed in must sign out first; otherwise the
  // form would be mixed up with their own account.
  if (guard) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="glass-card p-6 w-full max-w-sm text-center">
          <User className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">You are signed in</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You are signed in as {guard.name}. To enrol a new guard on this phone, sign out first.
          </p>
          <div className="space-y-3">
            <Button variant="gradient" className="w-full" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out and enrol
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success Screen
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center animate-scale-in">
          <div className="w-24 h-24 rounded-full gradient-success flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Enrollment Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Your details are being reviewed. Once an admin approves them, sign in with your email and password.
          </p>
          <div className="glass-card p-5 w-full max-w-sm mb-6 text-left">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-warning">Pending Approval</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">
                  Your documents were not sent from the app. Your supervisor will collect copies of your
                  Aadhaar card, PAN card, a photo and your relieving letter (if you have one).
                </span>
              </div>
            </div>
          </div>
          <Button variant="gradient" onClick={() => navigate('/')}>
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="p-6 pt-8">
        <button
          onClick={() => step === 'personal' ? navigate('/') : handlePreviousStep()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{step === 'personal' ? 'Back to Login' : 'Previous Step'}</span>
        </button>

        <h1 className="text-2xl font-bold text-foreground">Guard Enrollment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 'personal' && 'Step 1: Personal Information'}
          {step === 'face' && 'Step 2: Face Enrollment'}
          {step === 'documents' && 'Step 3: Documents & Bank Details'}
        </p>

        {/* Progress Bar */}
        <div className="flex gap-2 mt-4">
          <div className="h-1 flex-1 rounded-full gradient-primary" />
          <div className={`h-1 flex-1 rounded-full ${['face', 'documents'].includes(step) ? 'gradient-primary' : 'bg-secondary'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'documents' ? 'gradient-primary' : 'bg-secondary'}`} />
        </div>
      </div>

      {/* Face Capture Modal */}
      {showFaceCapture && (
        <FacialScanner
          mode="capture"
          onScanComplete={handleFaceCaptureComplete}
          onCancel={() => setShowFaceCapture(false)}
        />
      )}

      <div className="px-6">
        {/* Step 1: Personal Information */}
        {step === 'personal' && (
          <div className="space-y-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Details
                </CardTitle>
                <CardDescription>Enter your basic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => updateFormData('fullName', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateFormData('email', e.target.value)}
                        placeholder="email@example.com"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        placeholder="+91 98765 43210"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={(e) => updateFormData('password', e.target.value)}
                        placeholder="At least 8 characters"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                        placeholder="Type it again"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  You will sign in with your email and this password once your enrolment is approved.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => updateFormData('address', e.target.value)}
                      placeholder="Enter your full address"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Emergency Contact</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => updateFormData('emergencyContact', e.target.value)}
                    placeholder="Emergency contact number"
                  />
                </div>
              </CardContent>
            </Card>

            <Button variant="gradient" className="w-full" onClick={handleNextStep}>
              Continue to Face Enrollment
            </Button>
          </div>
        )}

        {/* Step 2: Face Enrollment */}
        {step === 'face' && (
          <div className="space-y-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="w-5 h-5 text-primary" />
                  Face Recognition Enrollment
                </CardTitle>
                <CardDescription>
                  Capture your face for secure login and identity verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isFaceCaptured ? (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-6">
                      <Camera className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Face Not Enrolled
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      Your face will be used for quick login and identity verification during shifts. 
                      Ensure good lighting and face the camera directly.
                    </p>
                    <Button 
                      variant="gradient" 
                      size="lg"
                      onClick={() => setShowFaceCapture(true)}
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Capture Face
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-12 h-12 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Face Enrolled Successfully
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Your face has been captured for recognition. You can now use facial login.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsFaceCaptured(false);
                        setFaceDescriptor(null);
                        setShowFaceCapture(true);
                      }}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Recapture Face
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button 
                variant="gradient" 
                className="flex-1" 
                onClick={handleNextStep}
                disabled={!isFaceCaptured}
              >
                Continue to Documents
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Documents & Bank Details */}
        {step === 'documents' && (
          <div className="space-y-6">
            {/* Identity Documents */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Identity Documents
                </CardTitle>
                <CardDescription>Enter your Aadhar and PAN details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="aadharNumber">Aadhar Number *</Label>
                  <Input
                    id="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={(e) => updateFormData('aadharNumber', e.target.value)}
                    placeholder="1234 5678 9012"
                    maxLength={14}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="panNumber">PAN Number *</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) => updateFormData('panNumber', e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Bank Account Details
                </CardTitle>
                <CardDescription>For salary credit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountHolderName">Account Holder Name</Label>
                  <Input
                    id="accountHolderName"
                    value={formData.accountHolderName}
                    onChange={(e) => updateFormData('accountHolderName', e.target.value)}
                    placeholder="Name as per bank account"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number *</Label>
                  <Input
                    id="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={(e) => updateFormData('bankAccountNumber', e.target.value)}
                    placeholder="Enter account number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankIfsc">IFSC Code *</Label>
                    <Input
                      id="bankIfsc"
                      value={formData.bankIfsc}
                      onChange={(e) => updateFormData('bankIfsc', e.target.value.toUpperCase())}
                      placeholder="SBIN0000000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => updateFormData('bankName', e.target.value)}
                      placeholder="Bank name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents are collected by the supervisor */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Document Copies
                </CardTitle>
                <CardDescription>
                  Copies can't be sent from this form. After you enrol, your supervisor will collect copies of your
                  Aadhaar card, PAN card, a photo and your relieving letter (if you have one).
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Enrollment Summary */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>Enrollment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{formData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{formData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{formData.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Face</span>
                  <span className="font-medium text-primary flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Enrolled
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aadhar</span>
                  <span className="font-medium">{formData.aadharNumber ? '••••••••' + formData.aadharNumber.slice(-4) : 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PAN</span>
                  <span className="font-medium">{formData.panNumber || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium">{formData.bankName || 'Not provided'}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Enrollment'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
