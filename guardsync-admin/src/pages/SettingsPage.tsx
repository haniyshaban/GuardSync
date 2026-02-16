import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import { SystemConfig } from '@/types';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';
import { 
  Settings, 
  Clock, 
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Default config values matching the server schema
const defaultSystemConfig: SystemConfig = {
  usePremiumAPIs: false,
  faceRecognition: 'local',
  mapProvider: 'openstreetmap',
  locationUpdateInterval: 30,
  geofenceStrictness: 'medium',
  autoClockOut: true,
};

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load config from API on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/config`);
        if (res.ok) {
          const data = await res.json();
          setConfig(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to fetch config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const updateConfig = <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast({
        title: "Settings saved",
        description: "Your configuration has been saved to the database.",
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Save failed:', err);
      toast({
        title: "Save failed",
        description: "Could not save settings to the server.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setConfig(defaultSystemConfig);
    setHasChanges(true);
    toast({
      title: "Settings reset",
      description: "Configuration reset to defaults. Click Save to persist.",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">System Configuration</h1>
              <p className="text-sm text-muted-foreground">
                Configure API providers and system settings
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isSaving} className="w-full sm:w-auto">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button variant="glow" onClick={handleSave} disabled={!hasChanges || isSaving} className="w-full sm:w-auto">
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Other Settings */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Operational Settings</CardTitle>
                <CardDescription>
                  Configure timing and thresholds for guard operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="location-interval">Location Update Interval (seconds)</Label>
                <Input
                  id="location-interval"
                  type="number"
                  value={config.locationUpdateInterval}
                  onChange={(e) => updateConfig('locationUpdateInterval', parseInt(e.target.value) || 30)}
                  min={10}
                  max={120}
                />
                <p className="text-xs text-muted-foreground">
                  How often guard locations are updated
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geofence-strictness">Geofence Strictness</Label>
                <select
                  id="geofence-strictness"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={config.geofenceStrictness}
                  onChange={(e) => updateConfig('geofenceStrictness', e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low - Allow some tolerance</option>
                  <option value="medium">Medium - Balanced</option>
                  <option value="high">High - Strict enforcement</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  How strictly geofence boundaries are enforced
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-clockout">Auto Clock-Out</Label>
                  <Switch
                    id="auto-clockout"
                    checked={config.autoClockOut}
                    onCheckedChange={(checked) => updateConfig('autoClockOut', checked)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically clock out guards at end of shift
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
