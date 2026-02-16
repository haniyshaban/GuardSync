import { BaseRepository } from './BaseRepository.js';

export class ConfigRepository extends BaseRepository {
  constructor(db) {
    super(db, 'system_config');
  }

  /**
   * Get main system configuration
   */
  getConfig() {
    return this.findById('main') || this.createDefaultConfig();
  }

  /**
   * Create default configuration
   */
  createDefaultConfig() {
    const defaultConfig = {
      id: 'main',
      usePremiumAPIs: 0,
      faceRecognition: 'local',
      mapProvider: 'openstreetmap',
      locationUpdateInterval: 30,
      geofenceStrictness: 'medium',
      autoClockOut: 1,
      updatedAt: new Date().toISOString()
    };
    
    this.create(defaultConfig);
    return defaultConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(configData) {
    const updates = {
      ...configData,
      updatedAt: new Date().toISOString()
    };
    
    return this.update('main', updates);
  }

  /**
   * Toggle premium APIs
   */
  togglePremiumAPIs(enabled) {
    return this.updateConfig({ usePremiumAPIs: enabled ? 1 : 0 });
  }

  /**
   * Set face recognition mode
   */
  setFaceRecognitionMode(mode) {
    return this.updateConfig({ faceRecognition: mode });
  }

  /**
   * Set map provider
   */
  setMapProvider(provider) {
    return this.updateConfig({ mapProvider: provider });
  }

  /**
   * Set location update interval (in seconds)
   */
  setLocationUpdateInterval(interval) {
    return this.updateConfig({ locationUpdateInterval: interval });
  }

  /**
   * Set geofence strictness
   */
  setGeofenceStrictness(strictness) {
    return this.updateConfig({ geofenceStrictness: strictness });
  }

  /**
   * Toggle auto clock-out
   */
  toggleAutoClockOut(enabled) {
    return this.updateConfig({ autoClockOut: enabled ? 1 : 0 });
  }

  /**
   * Get specific config value
   */
  getValue(key) {
    const config = this.getConfig();
    return config ? config[key] : null;
  }

  /**
   * Set specific config value
   */
  setValue(key, value) {
    const updates = { [key]: value };
    return this.updateConfig(updates);
  }
}
