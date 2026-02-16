import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, ChevronLeft, ChevronRight, 
  Clock, MapPin, CheckCircle, Sun, Moon, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getSchedules } from '@/services/GuardAPI';

interface ScheduledShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'upcoming' | 'completed' | 'today';
  isNightShift: boolean;
}

export default function Schedule() {
  const navigate = useNavigate();
  const { guard } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [apiSchedules, setApiSchedules] = useState<ScheduledShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch schedules from API
  useEffect(() => {
    if (!guard?.id) return;

    const fetchSchedules = async () => {
      try {
        // Get schedules for the past week and next 2 weeks
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - 7);
        const to = new Date(today);
        to.setDate(today.getDate() + 14);

        const response = await getSchedules(
          guard.id,
          from.toISOString().slice(0,10),
          to.toISOString().slice(0,10)
        );
        
        if (response.success && response.data) {
          const todayStr = today.toISOString().slice(0, 10);
          
          setApiSchedules(response.data.map((s) => {
            let status: 'upcoming' | 'completed' | 'today' = 'upcoming';
            if (s.date < todayStr) status = 'completed';
            else if (s.date === todayStr) status = 'today';
            
            return {
              id: s.id,
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              location: s.siteName || 'Assigned Site',
              status,
              isNightShift: s.isNightShift,
            };
          }));
        }
      } catch (err) {
        console.error('Failed to fetch schedules:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedules();
  }, [guard?.id]);

  // Use API schedules if available, otherwise generate from guard's assigned shift
  const generatedShifts = useMemo(() => {
    // If we have API schedules, use them
    if (apiSchedules.length > 0) {
      return apiSchedules;
    }

    // Otherwise generate from guard's current shift assignment
    if (!guard?.currentShift) return [];
    
    const shifts: ScheduledShift[] = [];
    const today = new Date();
    const isNightShift = guard.currentShift.isNightShift;
    const location = guard.currentShift.location || 'Assigned Site';
    const startTime = guard.currentShift.startTime || (isNightShift ? '20:00' : '08:00');
    const endTime = guard.currentShift.endTime || (isNightShift ? '08:00' : '20:00');
    
    // Generate shifts for the past week and next 2 weeks
    for (let i = -7; i < 14; i++) {
      const shiftDate = new Date(today);
      shiftDate.setDate(today.getDate() + i);
      const dateStr = shiftDate.toISOString().split('T')[0];
      
      // Skip some days to simulate realistic schedule (work 5 days, off 2)
      const dayOfWeek = shiftDate.getDay();
      if (dayOfWeek === 0) continue; // Skip Sundays
      
      let status: 'upcoming' | 'completed' | 'today' = 'upcoming';
      if (i < 0) status = 'completed';
      else if (i === 0) status = 'today';
      
      shifts.push({
        id: `shift-${dateStr}`,
        date: dateStr,
        startTime,
        endTime,
        location,
        status,
        isNightShift,
      });
    }
    
    return shifts;
  }, [guard, apiSchedules]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getWeekDates = () => {
    const dates = [];
    const current = new Date(selectedDate);
    const first = current.getDate() - current.getDay();

    for (let i = 0; i < 7; i++) {
      const date = new Date(current);
      date.setDate(first + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDate(date) === formatDate(today);
  };

  const shiftsForDate = generatedShifts.filter(
    shift => shift.date === formatDate(selectedDate)
  );

  const upcomingShifts = generatedShifts
    .filter(shift => shift.status === 'upcoming')
    .slice(0, 3);

  // Get shift type display info
  const shiftTypeInfo = guard?.currentShift?.isNightShift 
    ? { icon: Moon, label: 'Night Shift', color: 'text-purple-400' }
    : { icon: Sun, label: 'Day Shift', color: 'text-yellow-400' };

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

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
          <div className="flex items-center gap-2">
            {guard?.currentShift && (
              <div className={cn("flex items-center gap-1 text-sm", shiftTypeInfo.color)}>
                <shiftTypeInfo.icon className="w-4 h-4" />
                <span>{shiftTypeInfo.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Shift Assignment Card */}
        {guard?.currentShift && (
          <div className="glass-card p-4 mb-6 border-l-4 border-primary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Assigned Shift</span>
              <span className={cn("flex items-center gap-1 text-sm font-medium", shiftTypeInfo.color)}>
                <shiftTypeInfo.icon className="w-4 h-4" />
                {shiftTypeInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-mono font-semibold text-foreground">
                  {guard.currentShift.startTime} - {guard.currentShift.endTime}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{guard.currentShift.location}</span>
              </div>
            </div>
          </div>
        )}

        {/* Week View */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <p className="font-semibold text-foreground">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const isSelected = formatDate(date) === formatDate(selectedDate);
              const hasShift = generatedShifts.some(s => s.date === formatDate(date));

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex flex-col items-center py-3 rounded-lg transition-all",
                    isSelected 
                      ? "gradient-primary text-primary-foreground" 
                      : "hover:bg-white/10",
                    isToday(date) && !isSelected && "ring-1 ring-primary"
                  )}
                >
                  <span className="text-xs text-muted-foreground mb-1">
                    {weekDays[index]}
                  </span>
                  <span className={cn(
                    "text-lg font-semibold",
                    isSelected ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {date.getDate()}
                  </span>
                  {hasShift && !isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Shifts */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h2>

          {shiftsForDate.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <p className="text-muted-foreground">No shifts scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shiftsForDate.map((shift) => (
                <div key={shift.id} className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-mono font-semibold text-foreground">
                        {shift.startTime} - {shift.endTime}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      shift.status === 'today' && "bg-primary/20 text-primary",
                      shift.status === 'upcoming' && "bg-warning/20 text-warning",
                      shift.status === 'completed' && "bg-accent/20 text-accent"
                    )}>
                      {shift.status === 'today' ? 'Today' : 
                       shift.status === 'completed' ? 'Completed' : 'Upcoming'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{shift.location}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Shifts */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Upcoming Shifts</h2>
          <div className="space-y-3">
            {upcomingShifts.map((shift) => (
              <div key={shift.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {new Date(shift.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {shift.startTime} - {shift.endTime} • {shift.location}
                  </p>
                </div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
