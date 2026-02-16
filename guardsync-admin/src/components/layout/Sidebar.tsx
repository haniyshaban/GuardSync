import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Map, 
  Users, 
  Building2, 
  FileText, 
  Settings,
  HelpCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from './SidebarContext';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/live-map', icon: Map, label: 'Live Map' },
  { path: '/guards', icon: Users, label: 'Guards' },
  { path: '/sites', icon: Building2, label: 'Sites' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/support', icon: HelpCircle, label: 'Support' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebar();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (onClose) onClose();
  };

  return (
    <>
    <aside
      className={cn(
        "hidden sm:flex fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 flex-col transition-all duration-200",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary overflow-hidden">
            <img src="/favicon.ico" alt="GuardSync" className="w-6 h-6" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg text-foreground whitespace-nowrap">GuardSync</h1>
              <p className="text-xs text-muted-foreground whitespace-nowrap">Security Platform</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
              )}
              {item.path === '/live-map' ? (
                <svg className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive && "text-primary")} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C9.243 2 7 4.243 7 7c0 4.418 5 11 5 11s5-6.582 5-11c0-2.757-2.243-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              ) : (
                <item.icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive && "text-primary"
                )} />
              )}
              {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User info & Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && user && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground truncate">{user.name}</div>
            <div className="truncate">{user.email}</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full text-destructive hover:text-destructive hover:bg-destructive/10",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggle()}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="ml-2">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>

    {/* Mobile overlay sidebar */}
    {mobileOpen && (
      <div className="sm:hidden fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <aside className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 flex flex-col transition-all duration-200 w-64">
          <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary overflow-hidden">
                <img src="/favicon.ico" alt="GuardSync" className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between w-full">
                <div>
                  <h1 className="font-bold text-lg text-foreground whitespace-nowrap">GuardSync</h1>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Security Platform</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                  {item.path === '/live-map' ? (
                    <svg className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive && "text-primary")} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C9.243 2 7 4.243 7 7c0 4.418 5 11 5 11s5-6.582 5-11c0-2.757-2.243-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  ) : (
                    <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive && "text-primary")} />
                  )}
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User info & Logout - Mobile */}
          <div className="p-3 border-t border-sidebar-border space-y-2">
            {user && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground truncate">{user.name}</div>
                <div className="truncate">{user.email}</div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="ml-2">Logout</span>
            </Button>
          </div>
        </aside>
      </div>
    )}
  </>
  );
}
