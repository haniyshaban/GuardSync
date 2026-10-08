import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Mic,
  Video,
  Square,
  Upload,
  Clock,
  MapPin,
  Check,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { FieldReport } from '@/types';
import { getFieldReports, submitFieldReport } from '@/services/staffApi';

export default function FieldReporting() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  // Recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFetchingReports, setIsFetchingReports] = useState(true);

  // Recent reports
  const [recentReports, setRecentReports] = useState<FieldReport[]>([]);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch recent reports from API
  useEffect(() => {
    const fetchReports = async () => {
      if (!staff?.id) return;
      try {
        const response = await getFieldReports(staff.id);
        if (response.success && response.data) {
          setRecentReports(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      } finally {
        setIsFetchingReports(false);
      }
    };

    fetchReports();
  }, [staff?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast({
        title: 'Recording Started',
        description: 'Speak clearly into your microphone.',
      });
    } catch (error) {
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      streamRef.current = stream;
      chunksRef.current = [];

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };

      mediaRecorder.start();
      setIsRecordingVideo(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast({
        title: 'Recording Started',
        description: 'Recording video with audio.',
      });
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const clearRecording = (type: 'audio' | 'video') => {
    if (type === 'audio') {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioBlob(null);
      setAudioUrl(null);
    } else {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoBlob(null);
      setVideoUrl(null);
    }
    setRecordingDuration(0);
  };

  const handleSubmit = async (type: 'voice_note' | 'video') => {
    const blob = type === 'voice_note' ? audioBlob : videoBlob;
    
    if (!blob || !title.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please add a title and recording before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress for media (in production, would upload to cloud storage)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Get current location
      let location: { lat: number; lng: number } | undefined;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        location = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch (geoErr) {
        console.warn('Could not get location:', geoErr);
      }

      // In production, we'd upload the blob to cloud storage and get a URL
      // For now, we'll just save the metadata to the API
      const formData = new FormData();
      formData.append('staffId', staff?.id || '');
      formData.append('staffName', staff?.name || '');
      formData.append('reportType', type);
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (location) formData.append('location', JSON.stringify(location));
      
      const response = await submitFieldReport(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to save report');
      }

      setRecentReports(prev => [response.data!, ...prev]);

      // Reset form
      setTitle('');
      setDescription('');
      clearRecording(type === 'voice_note' ? 'audio' : 'video');

      toast({
        title: 'Report Submitted',
        description: 'Your field report has been saved successfully.',
      });
    } catch (err) {
      console.error('Failed to submit report:', err);
      clearInterval(progressInterval);
      toast({
        title: 'Submission Failed',
        description: 'Could not save the report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

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

  return (
    <div className="min-h-screen bg-background pb-24">
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
            <h1 className="text-xl font-bold text-foreground">Field Reporting</h1>
            <p className="text-sm text-muted-foreground">Voice notes & video reports</p>
          </div>
        </div>

        <Tabs defaultValue="voice" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Voice Note
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Video Report
            </TabsTrigger>
          </TabsList>

          {/* Voice Note Tab */}
          <TabsContent value="voice" className="space-y-4">
            <div className="glass-card p-5">
              {/* Recording Area */}
              <div className="flex flex-col items-center justify-center py-8">
                {!audioUrl ? (
                  <>
                    <button
                      onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                        isRecordingAudio
                          ? 'bg-destructive recording-indicator'
                          : 'bg-primary/20 hover:bg-primary/30'
                      }`}
                    >
                      {isRecordingAudio ? (
                        <Square className="w-10 h-10 text-white" />
                      ) : (
                        <Mic className="w-10 h-10 text-primary" />
                      )}
                    </button>

                    {isRecordingAudio && (
                      <div className="mt-4 text-center">
                        <p className="text-2xl font-mono font-bold text-destructive">
                          {formatDuration(recordingDuration)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Recording...</p>
                      </div>
                    )}

                    {!isRecordingAudio && (
                      <p className="text-sm text-muted-foreground mt-4">
                        Tap to start recording
                      </p>
                    )}
                  </>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => {
                          if (audioRef.current) {
                            if (isPlaying) {
                              audioRef.current.pause();
                            } else {
                              audioRef.current.play();
                            }
                            setIsPlaying(!isPlaying);
                          }
                        }}
                        className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30"
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6 text-primary" />
                        ) : (
                          <Play className="w-6 h-6 text-primary" />
                        )}
                      </button>
                      <button
                        onClick={() => clearRecording('audio')}
                        className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center hover:bg-destructive/30"
                      >
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </button>
                    </div>
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                    <p className="text-center text-sm text-muted-foreground">
                      Recording ready • {formatDuration(recordingDuration)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="voice-title">Title</Label>
                <Input
                  id="voice-title"
                  placeholder="Brief description of the report"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-secondary/50 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="voice-desc">Additional Notes (Optional)</Label>
                <Textarea
                  id="voice-desc"
                  placeholder="Any additional context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-secondary/50 mt-1"
                />
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <Button
                variant="gradient"
                className="w-full"
                disabled={!audioBlob || !title.trim() || isUploading}
                onClick={() => handleSubmit('voice_note')}
              >
                <Upload className="w-5 h-5 mr-2" />
                Submit Voice Report
              </Button>
            </div>
          </TabsContent>

          {/* Video Report Tab */}
          <TabsContent value="video" className="space-y-4">
            <div className="glass-card p-5">
              {/* Video Preview */}
              <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden mb-4">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${!isRecordingVideo && 'hidden'}`}
                  />
                )}
                
                {!isRecordingVideo && !videoUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Video className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Video preview</p>
                  </div>
                )}

                {isRecordingVideo && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
                    <div className="w-2 h-2 rounded-full bg-destructive recording-indicator" />
                    <span className="text-sm font-mono text-white">
                      {formatDuration(recordingDuration)}
                    </span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                {!videoUrl ? (
                  <Button
                    variant={isRecordingVideo ? 'destructive' : 'default'}
                    size="lg"
                    onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
                  >
                    {isRecordingVideo ? (
                      <>
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Video className="w-5 h-5 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => clearRecording('video')}
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Record Again
                  </Button>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="video-title">Title</Label>
                <Input
                  id="video-title"
                  placeholder="Brief description of the incident"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-secondary/50 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="video-desc">Additional Notes (Optional)</Label>
                <Textarea
                  id="video-desc"
                  placeholder="Any additional context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-secondary/50 mt-1"
                />
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <Button
                variant="gradient"
                className="w-full"
                disabled={!videoBlob || !title.trim() || isUploading}
                onClick={() => handleSubmit('video')}
              >
                <Upload className="w-5 h-5 mr-2" />
                Submit Video Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Recent Reports</h2>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {recentReports.map((report) => (
                  <div key={report.id} className="glass-card p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          report.reportType === 'voice_note'
                            ? 'bg-primary/20'
                            : 'bg-primary/10'
                        }`}>
                          {report.reportType === 'voice_note' ? (
                            <Mic className="w-5 h-5 text-primary" />
                          ) : (
                            <Video className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{report.title}</p>
                          {report.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {report.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{formatTimeAgo(report.createdAt)}</span>
                      </div>
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
