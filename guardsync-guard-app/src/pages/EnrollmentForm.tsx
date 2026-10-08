import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Upload, CheckCircle, Loader2, 
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
import { uploadFile } from '@/services/GuardAPI';

type EnrollmentStep = 'personal' | 'face' | 'documents' | 'success';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  aadharNumber: string;
  panNumber: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  accountHolderName: string;
}

interface FileUploads {
  photograph: File | null;
  aadharDoc: File | null;
  panDoc: File | null;
  relievingLetter: File | null;
}

export default function EnrollmentForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { guard, updateGuard } = useAuth();

  const [step, setStep] = useState<EnrollmentStep>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data - prepopulated from guard data if available
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    emergencyContact: '',
    aadharNumber: '',
    panNumber: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: '',
    accountHolderName: '',
  });

  // Prepopulate form with existing guard data
  useEffect(() => {
    if (guard) {
      setFormData(prev => ({
        ...prev,
        fullName: guard.name || prev.fullName,
        email: guard.email || prev.email,
        phone: guard.phone || prev.phone,
        address: guard.address || prev.address,
        emergencyContact: guard.emergencyContact || prev.emergencyContact,
        aadharNumber: guard.documents?.aadharNumber || prev.aadharNumber,
        panNumber: guard.documents?.panNumber || prev.panNumber,
        bankAccountNumber: guard.bankDetails?.accountNumber || prev.bankAccountNumber,
        bankIfsc: guard.bankDetails?.ifsc || prev.bankIfsc,
        bankName: guard.bankDetails?.bankName || prev.bankName,
        accountHolderName: guard.bankDetails?.accountHolderName || prev.accountHolderName,
      }));
    }
  }, [guard]);

  // File uploads
  const [files, setFiles] = useState<FileUploads>({
    photograph: null,
    aadharDoc: null,
    panDoc: null,
    relievingLetter: null,
  });

  const photographRef = useRef<HTMLInputElement>(null);
  const aadharDocRef = useRef<HTMLInputElement>(null);
  const panDocRef = useRef<HTMLInputElement>(null);
  const relievingLetterRef = useRef<HTMLInputElement>(null);

  // Face capture state
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<string | null>(null);
  const [isFaceCaptured, setIsFaceCaptured] = useState(false);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: keyof FileUploads, file: File | null) => {
    setFiles(prev => ({ ...prev, [field]: file }));
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
      case 'personal':
        if (!formData.fullName || !formData.email || !formData.phone) {
          toast({
            title: 'Missing Information',
            description: 'Please fill in all required fields',
            variant: 'destructive',
          });
          return false;
        }
        return true;

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

  // Upload a single file and return the URL
  const uploadSingleFile = async (file: File, fieldName: string): Promise<string | null> => {
    try {
      const response = await uploadFile(file);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Upload failed');
      }
      
      return response.data.url;
    } catch (error) {
      console.error(`Failed to upload ${fieldName}:`, error);
      return null;
    }
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
    if (!faceDescriptor) {
      toast({
        title: 'Face Capture Required',
        description: 'Please capture your face before submitting',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload files first
      let photographUrl = null;
      let aadharDocUrl = null;
      let panDocUrl = null;
      let relievingLetterUrl = null;

      if (files.photograph) {
        photographUrl = await uploadSingleFile(files.photograph, 'photograph');
      }
      if (files.aadharDoc) {
        aadharDocUrl = await uploadSingleFile(files.aadharDoc, 'aadharDoc');
      }
      if (files.panDoc) {
        panDocUrl = await uploadSingleFile(files.panDoc, 'panDoc');
      }
      if (files.relievingLetter) {
        relievingLetterUrl = await uploadSingleFile(files.relievingLetter, 'relievingLetter');
      }

      if (guard?.id) {
        // Existing guard - Update profile
        const response = await api.put(`/guards/${guard.id}/profile`, {
          address: formData.address,
          emergencyContact: formData.emergencyContact,
          aadharNumber: formData.aadharNumber.replace(/\D/g, ''), // Remove formatting
          panNumber: formData.panNumber.toUpperCase(),
          bankAccountNumber: formData.bankAccountNumber,
          bankIfsc: formData.bankIfsc.toUpperCase(),
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          faceDescriptor: faceDescriptor,
          photographUrl,
          aadharDocUrl,
          panDocUrl,
          relievingLetterUrl,
        });

        if (response.success) {
          // Update local guard state with new data
          updateGuard({
            address: formData.address,
            emergencyContact: formData.emergencyContact,
            documents: {
              ...guard.documents,
              aadharNumber: formData.aadharNumber,
              panNumber: formData.panNumber,
            },
            bankDetails: {
              accountNumber: formData.bankAccountNumber,
              ifsc: formData.bankIfsc,
              bankName: formData.bankName,
              accountHolderName: formData.accountHolderName,
            },
          });
          toast({
            title: 'Profile Updated',
            description: 'Your details have been saved successfully.',
          });
        } else {
          throw new Error(response.error || 'Failed to update profile');
        }
      } else {
        // New guard - Create enrollment
        const response = await api.post('/guards/enroll', {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          emergencyContact: formData.emergencyContact,
          aadharNumber: formData.aadharNumber.replace(/\D/g, ''),
          panNumber: formData.panNumber.toUpperCase(),
          bankAccountNumber: formData.bankAccountNumber,
          bankIfsc: formData.bankIfsc.toUpperCase(),
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          faceDescriptor: faceDescriptor,
          photographUrl,
          aadharDocUrl,
          panDocUrl,
          relievingLetterUrl,
        });

        if (response.success) {
          toast({
            title: 'Enrollment Submitted',
            description: 'Your enrollment has been submitted. You will be notified once approved.',
          });
        } else {
          throw new Error(response.error || 'Failed to submit enrollment');
        }
      }

      console.log('Enrollment Data:', formData);
      console.log('Files:', files);

      setStep('success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      toast({
        title: 'Submission Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            Your details are being reviewed. You'll be notified once verified.
          </p>
          <div className="glass-card p-5 w-full max-w-sm mb-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-warning">Pending Verification</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Aadhar</span>
                <span className="font-medium text-primary flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Verified
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
          {step === 'verification' && 'Step 4: Aadhar Verification'}
        </p>

        {/* Progress Bar */}
        <div className="flex gap-2 mt-4">
          <div className={`h-1 flex-1 rounded-full ${['personal', 'face', 'documents', 'verification'].includes(step) ? 'gradient-primary' : 'bg-secondary'}`} />
          <div className={`h-1 flex-1 rounded-full ${['face', 'documents', 'verification'].includes(step) ? 'gradient-primary' : 'bg-secondary'}`} />
          <div className={`h-1 flex-1 rounded-full ${['documents', 'verification'].includes(step) ? 'gradient-primary' : 'bg-secondary'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'verification' ? 'gradient-primary' : 'bg-secondary'}`} />
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

            {/* Photo Upload */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Profile Photo
                </CardTitle>
                <CardDescription>Upload a clear photo of yourself</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={photographRef}
                  accept="image/*"
                  onChange={(e) => handleFileChange('photograph', e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => photographRef.current?.click()}
                  className="border-2 border-dashed border-secondary rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  {files.photograph ? (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <CheckCircle className="w-5 h-5" />
                      <span>{files.photograph.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload photo</p>
                    </>
                  )}
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

                <div className="space-y-2">
                  <Label>Aadhar Document</Label>
                  <input
                    type="file"
                    ref={aadharDocRef}
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange('aadharDoc', e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => aadharDocRef.current?.click()}
                    className="border-2 border-dashed border-secondary rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    {files.aadharDoc ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">{files.aadharDoc.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Upload Aadhar copy</p>
                    )}
                  </div>
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

                <div className="space-y-2">
                  <Label>PAN Document</Label>
                  <input
                    type="file"
                    ref={panDocRef}
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange('panDoc', e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => panDocRef.current?.click()}
                    className="border-2 border-dashed border-secondary rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    {files.panDoc ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">{files.panDoc.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Upload PAN copy</p>
                    )}
                  </div>
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

            {/* Relieving Letter */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Relieving Letter (Optional)
                </CardTitle>
                <CardDescription>From previous employer if applicable</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={relievingLetterRef}
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileChange('relievingLetter', e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => relievingLetterRef.current?.click()}
                  className="border-2 border-dashed border-secondary rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  {files.relievingLetter ? (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">{files.relievingLetter.name}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Upload relieving letter</p>
                  )}
                </div>
              </CardContent>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium">
                    {[files.photograph, files.aadharDoc, files.panDoc, files.relievingLetter].filter(Boolean).length} uploaded
                  </span>
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
