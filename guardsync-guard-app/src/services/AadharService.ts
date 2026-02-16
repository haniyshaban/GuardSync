// Mock Aadhar Service - Simulates UIDAI Aadhar verification OTP flow

export interface AadharVerificationRequest {
  aadharNumber: string;
  name: string;
}

export interface AadharOTPResponse {
  success: boolean;
  transactionId: string;
  message: string;
  maskedPhone?: string;
}

export interface AadharVerifyOTPRequest {
  transactionId: string;
  otp: string;
  aadharNumber: string;
}

export interface AadharVerificationResult {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    name: string;
    maskedAadhar: string;
    gender?: string;
    dob?: string;
    address?: string;
  };
}

// Simulates OTP generation delay
const MOCK_OTP_DELAY = 1500;
// Simulates OTP verification delay
const MOCK_VERIFY_DELAY = 2000;

// Store for active OTP sessions (in real app this would be server-side)
const otpSessions: Map<string, { otp: string; aadhar: string; expiresAt: number }> = new Map();

// Generate a random 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a unique transaction ID using crypto-safe UUID
const generateTransactionId = (): string => {
  // Use browser's crypto.randomUUID() for cryptographically secure IDs
  return `TXN${crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
};

// Mask Aadhar number for display
export const maskAadharNumber = (aadhar: string): string => {
  const cleaned = aadhar.replace(/\D/g, '');
  if (cleaned.length !== 12) return 'xxxx-xxxx-xxxx';
  return `xxxx-xxxx-${cleaned.slice(-4)}`;
};

// Mask phone number for display
const maskPhoneNumber = (phone: string): string => {
  return `******${phone.slice(-4)}`;
};

/**
 * Request OTP for Aadhar verification
 * Simulates the UIDAI OTP request flow
 */
export const requestAadharOTP = async (
  request: AadharVerificationRequest
): Promise<AadharOTPResponse> => {
  await new Promise(resolve => setTimeout(resolve, MOCK_OTP_DELAY));

  const { aadharNumber } = request;
  const cleaned = aadharNumber.replace(/\D/g, '');

  // Validate Aadhar format
  if (cleaned.length !== 12) {
    return {
      success: false,
      transactionId: '',
      message: 'Invalid Aadhar number format. Must be 12 digits.',
    };
  }

  // Generate OTP and transaction ID
  const otp = generateOTP();
  const transactionId = generateTransactionId();

  // Store OTP session (expires in 10 minutes)
  otpSessions.set(transactionId, {
    otp,
    aadhar: cleaned,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // In development, log the OTP for testing
  console.log(`[AadharService] Mock OTP for ${maskAadharNumber(cleaned)}: ${otp}`);

  return {
    success: true,
    transactionId,
    message: 'OTP sent successfully to registered mobile number',
    maskedPhone: maskPhoneNumber('9876543210'), // Mock phone
  };
};

/**
 * Verify OTP for Aadhar verification
 * Simulates the UIDAI OTP verification flow
 */
export const verifyAadharOTP = async (
  request: AadharVerifyOTPRequest
): Promise<AadharVerificationResult> => {
  await new Promise(resolve => setTimeout(resolve, MOCK_VERIFY_DELAY));

  const { transactionId, otp, aadharNumber } = request;
  const session = otpSessions.get(transactionId);

  // Check if session exists
  if (!session) {
    return {
      success: false,
      verified: false,
      message: 'Session expired or invalid. Please request a new OTP.',
    };
  }

  // Check if session expired
  if (Date.now() > session.expiresAt) {
    otpSessions.delete(transactionId);
    return {
      success: false,
      verified: false,
      message: 'OTP has expired. Please request a new OTP.',
    };
  }

  // Verify OTP
  if (session.otp !== otp) {
    return {
      success: false,
      verified: false,
      message: 'Invalid OTP. Please check and try again.',
    };
  }

  // Clean up session
  otpSessions.delete(transactionId);

  // Return verified data
  const cleaned = aadharNumber.replace(/\D/g, '');
  return {
    success: true,
    verified: true,
    message: 'Aadhar verified successfully',
    data: {
      name: 'Verified User',
      maskedAadhar: maskAadharNumber(cleaned),
      gender: 'M',
      dob: '1990-01-01',
      address: 'Verified Address, State, India',
    },
  };
};

/**
 * Resend OTP for an existing session
 */
export const resendAadharOTP = async (
  transactionId: string
): Promise<AadharOTPResponse> => {
  await new Promise(resolve => setTimeout(resolve, MOCK_OTP_DELAY));

  const session = otpSessions.get(transactionId);
  
  if (!session) {
    return {
      success: false,
      transactionId: '',
      message: 'Session expired. Please start verification again.',
    };
  }

  // Generate new OTP
  const newOtp = generateOTP();
  session.otp = newOtp;
  session.expiresAt = Date.now() + 10 * 60 * 1000;

  console.log(`[AadharService] Resent Mock OTP: ${newOtp}`);

  return {
    success: true,
    transactionId,
    message: 'OTP resent successfully',
    maskedPhone: maskPhoneNumber('9876543210'),
  };
};

// Export service object for convenience
export const AadharService = {
  requestOTP: requestAadharOTP,
  verifyOTP: verifyAadharOTP,
  resendOTP: resendAadharOTP,
  maskAadhar: maskAadharNumber,
};

export default AadharService;
