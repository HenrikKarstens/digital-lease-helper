import { useNavigate, useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SettingsFAB = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on auth page or settings page
  if (location.pathname === '/auth' || location.pathname === '/settings') return null;

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={() => navigate('/settings')}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg border border-border/50 bg-card/90 backdrop-blur-md hover:bg-card"
      title="Einstellungen"
    >
      <Settings className="w-5 h-5 text-muted-foreground" />
    </Button>
  );
};

