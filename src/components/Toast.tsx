import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export default function Toast() {
  const toast = useAppStore(s => s.toast);
  const clearToast = useAppStore(s => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, toast.ms);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const icons = {
    ok: <CheckCircle size={18} className="text-emerald-400" />,
    err: <XCircle size={18} className="text-red-400" />,
    warn: <AlertCircle size={18} className="text-amber-400" />,
    info: <Info size={18} className="text-sky-400" />,
  };

  const bgMap = {
    ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100',
    err: 'bg-red-500/10 border-red-500/30 text-red-100',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-100',
    info: 'bg-sky-500/10 border-sky-500/30 text-sky-100',
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[1000] flex justify-center pointer-events-none">
      <div className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-md animate-in slide-in-from-bottom-4 ${bgMap[toast.type]}`}>
        {icons[toast.type]}
        <span className="text-sm font-semibold">{toast.message}</span>
      </div>
    </div>
  );
}
