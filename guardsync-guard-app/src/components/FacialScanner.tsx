import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  areModelsLoaded, 
  detectSingleFace, 
  descriptorToString,
  stringToDescriptor,
  descriptorsMatch,
  createFaceMatcher,
  matchFace
} from '@/services/FaceApiService';

export interface FacialScannerProps {
  /** Called when scan completes - success indicates face was detected */
  onScanComplete: (success: boolean, descriptor?: Float32Array) => void;
  onCancel: () => void;
  /** Mode: 'capture' for enrollment, 'verify' for login/wake verification */
  mode?: 'capture' | 'verify';
  /** For verify mode: the stored descriptor to match against */
  storedDescriptor?: string | null;
  /** For verify mode with multiple guards: array of {id, descriptor} */
  guardDescriptors?: { id: string; descriptor: string }[];
  /** Match threshold (lower = stricter, default 0.6) */
  matchThreshold?: number;
  /** Callback with matched guard ID in verify mode */
  onMatchFound?: (guardId: string, distance: number) => void;
}

type ScanStatus = 'idle' | 'initializing' | 'scanning' | 'processing' | 'success' | 'error' | 'no-face' | 'no-match';

export function FacialScanner({ 
  onScanComplete, 
  onCancel, 
  mode = 'capture',
  storedDescriptor,
  guardDescriptors,
  matchThreshold = 0.6,
  onMatchFound
}: FacialScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [matchDistance, setMatchDistance] = useState<number | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setStatus('initializing');
    setErrorMessage('');
    
    // Check if models are loaded - if not, wait a bit for them
    if (!areModelsLoaded()) {
      console.log('[FacialScanner] Models not ready, waiting...');
      // Wait up to 5 seconds for models to load
      let attempts = 0;
      while (!areModelsLoaded() && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (!areModelsLoaded()) {
        setStatus('error');
        setErrorMessage('Face recognition models not loaded. Please refresh the app.');
        return;
      }
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStatus('scanning');
    } catch (error) {
      console.error('Camera access denied:', error);
      setStatus('error');
      setErrorMessage('Camera access denied. Please allow camera permissions.');
    }
  };

  const performScan = useCallback(async () => {
    if (!videoRef.current || !areModelsLoaded()) {
      setStatus('error');
      setErrorMessage('Unable to perform scan. Please try again.');
      return;
    }

    setStatus('processing');
    setProgress(0);

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 90));
    }, 50);

    try {
      // Detect face and get descriptor
      const descriptor = await detectSingleFace(videoRef.current);
      
      clearInterval(progressInterval);

      if (!descriptor) {
        setProgress(100);
        setStatus('no-face');
        setErrorMessage('No face detected. Please position your face in the frame and try again.');
        
        // Auto retry after 2 seconds
        setTimeout(() => {
          if (status === 'no-face') {
            setStatus('scanning');
            setProgress(0);
          }
        }, 2000);
        return;
      }

      // For capture mode, just return the descriptor
      if (mode === 'capture') {
        setProgress(100);
        setStatus('success');

        // Stop camera
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        setTimeout(() => {
          onScanComplete(true, descriptor);
        }, 1000);
        return;
      }

      // For verify mode, compare against stored descriptor(s)
      if (mode === 'verify') {
        // Multiple guards matching
        if (guardDescriptors && guardDescriptors.length > 0) {
          const labeledDescriptors = guardDescriptors.map(gd => ({
            label: gd.id,
            descriptors: [stringToDescriptor(gd.descriptor)]
          }));
          
          const matcher = createFaceMatcher(labeledDescriptors, matchThreshold);
          const result = matchFace(matcher, descriptor);
          
          if (result) {
            setProgress(100);
            setMatchDistance(result.distance);
            setStatus('success');

            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }

            setTimeout(() => {
              onMatchFound?.(result.label, result.distance);
              onScanComplete(true, descriptor);
            }, 1000);
            return;
          }
        }
        
        // Single stored descriptor matching
        if (storedDescriptor) {
          const stored = stringToDescriptor(storedDescriptor);
          const isMatch = descriptorsMatch(descriptor, stored, matchThreshold);
          
          if (isMatch) {
            setProgress(100);
            setStatus('success');

            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }

            setTimeout(() => {
              onScanComplete(true, descriptor);
            }, 1000);
            return;
          }
        }

        // No match found
        setProgress(100);
        setStatus('no-match');
        setErrorMessage('Face does not match registered profile. Please try again.');
        
        setTimeout(() => {
          setStatus('scanning');
          setProgress(0);
        }, 2500);
        return;
      }

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Face detection error:', error);
      setStatus('error');
      setErrorMessage('Face detection failed. Please try again.');
    }
  }, [mode, storedDescriptor, guardDescriptors, matchThreshold, onScanComplete, onMatchFound, stream, status]);

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing': return 'Initializing camera...';
      case 'scanning': return 'Position your face in the frame';
      case 'processing': return 'Analyzing face...';
      case 'success': return mode === 'capture' ? 'Face captured!' : 'Identity verified!';
      case 'error': return errorMessage || 'An error occurred';
      case 'no-face': return 'No face detected';
      case 'no-match': return 'Face does not match';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-primary mb-2">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-medium tracking-wide uppercase">
            {mode === 'capture' ? 'Face Enrollment' : 'Facial Recognition'}
          </span>
        </div>
        <h2 className={`text-2xl font-bold ${status === 'no-match' || status === 'no-face' ? 'text-warning' : 'text-foreground'}`}>
          {getStatusMessage()}
        </h2>
        {matchDistance !== null && status === 'success' && (
          <p className="text-sm text-muted-foreground mt-1">
            Match confidence: {Math.round((1 - matchDistance) * 100)}%
          </p>
        )}
      </div>

      {/* Scanner Frame */}
      <div className="relative w-72 h-72 mb-8">
        {/* Outer frame */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
        
        {/* Animated ring */}
        {status === 'scanning' && <div className="pulse-ring" />}
        
        {/* Corner brackets */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <path d="M 20,5 L 5,5 L 5,20" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
          <path d="M 80,5 L 95,5 L 95,20" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
          <path d="M 20,95 L 5,95 L 5,80" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
          <path d="M 80,95 L 95,95 L 95,80" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Video feed */}
        <div className="absolute inset-4 rounded-full overflow-hidden bg-secondary">
          {status === 'error' ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <AlertCircle className="w-12 h-12 text-destructive mb-2" />
              <p className="text-xs text-center text-muted-foreground">{errorMessage}</p>
            </div>
          ) : status === 'success' ? (
            <div className="w-full h-full flex items-center justify-center bg-accent/20">
              <CheckCircle className="w-16 h-16 text-accent" />
            </div>
          ) : status === 'no-match' || status === 'no-face' ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-warning/20 p-4">
              <AlertCircle className="w-12 h-12 text-warning mb-2" />
              <p className="text-xs text-center text-muted-foreground">{errorMessage}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
        </div>

        {/* Scan line */}
        {status === 'processing' && (
          <div className="absolute inset-4 rounded-full overflow-hidden">
            <div className="scan-line" />
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {status === 'processing' && (
        <div className="w-64 mb-8">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full gradient-primary transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">{progress}%</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {status === 'error' && (
          <Button variant="outline" onClick={startCamera}>
            <Camera className="w-4 h-4 mr-2" />
            Retry
          </Button>
        )}
        {(status === 'scanning' || status === 'no-face' || status === 'no-match') && (
          <Button variant="gradient" size="lg" onClick={performScan}>
            <Camera className="w-5 h-5 mr-2" />
            {mode === 'capture' ? 'Capture Face' : 'Scan Face'}
          </Button>
        )}
        {(status === 'scanning' || status === 'error' || status === 'initializing' || status === 'no-face' || status === 'no-match') && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>
      
      {/* Hidden canvas for face detection */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
