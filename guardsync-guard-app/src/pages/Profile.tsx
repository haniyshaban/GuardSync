import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, Mail, CreditCard, LogOut, ChevronRight, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { PayslipViewer } from '@/components/PayslipViewer';
import { getGuardStats } from '@/services/GuardAPI';

export default function Profile() {
  const navigate = useNavigate();
  const { guard, logout } = useAuth();
  const [profileStats, setProfileStats] = useState({
    shiftsCompleted: 0,
    attendanceRate: 0,
    patrolsCompleted: 0
  });

  // Fetch profile stats from API
  useEffect(() => {
    const fetchStats = async () => {
      if (!guard?.id) return;
      try {
        const response = await getGuardStats(guard.id);
        if (response.success && response.data) {
          setProfileStats(response.data);
        }
      } catch (e) {
        console.log('Could not fetch guard stats', e);
      }
    };
    fetchStats();
  }, [guard?.id]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getOnboardingBadge = () => {
    switch (guard?.onboardingStatus) {
      case 'active':
        return <Badge className="bg-primary/10 text-primary">Verified Guard</Badge>;
      case 'verified':
        return <Badge className="bg-warning/20 text-warning">Pending Activation</Badge>;
      case 'pending':
        return <Badge className="bg-secondary text-muted-foreground">Pending Verification</Badge>;
      default:
        return null;
    }
  };

  // Only screens that exist are listed
  const menuItems = [
    { icon: User, label: 'Personal Information', description: 'View & update your details', path: '/personal-info' },
    { icon: CalendarDays, label: 'Leave History', description: 'View leave requests', path: '/leave' },
  ];

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

        <h1 className="text-2xl font-bold text-foreground mb-6">Profile</h1>

        {/* Profile Card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-10 h-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{guard?.name}</h2>
              <p className="text-primary font-mono">{guard?.employeeId}</p>
              <div className="flex items-center gap-2 mt-1">
                {getOnboardingBadge()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Mail className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{guard?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Phone className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground">{guard?.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Rate</p>
                <p className="font-medium text-foreground">₹{guard?.dailyRate?.toLocaleString('en-IN') || 'N/A'}/day</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{profileStats.shiftsCompleted}</p>
            <p className="text-sm text-muted-foreground">Shifts Completed</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-primary">{profileStats.attendanceRate}%</p>
            <p className="text-sm text-muted-foreground">Attendance Rate</p>
          </div>
        </div>

        {/* Uniform Balance */}
        {guard?.uniformInstallments && guard.uniformInstallments.remainingAmount > 0 && (
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Uniform Balance</span>
              <span className="text-sm font-medium text-warning">
                ₹{guard.uniformInstallments.remainingAmount.toLocaleString('en-IN')} remaining
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Monthly deduction: ₹{guard.uniformInstallments.monthlyDeduction}</span>
              <span>
                {Math.ceil(guard.uniformInstallments.remainingAmount / guard.uniformInstallments.monthlyDeduction)} months left
              </span>
            </div>
          </div>
        )}

        {/* Payslip Viewer */}
        {guard && (
          <div className="mb-6">
            <PayslipViewer guard={guard} />
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="w-full glass-card p-4 flex items-center justify-between hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
