import { createContext, useCallback, useContext, useMemo, useState } from "react";
type ToastTone = "good" | "warn" | "bad";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastApi = { items: ToastItem[]; showToast: (message: string, tone?: ToastTone) => void; dismissToast: (id: number) => void };
const ToastContext = createContext<ToastApi | null>(null);
export function ToastProvider({ children }: { children: React.ReactNode }) { const [items, setItems] = useState<ToastItem[]>([]); const dismissToast = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []); const showToast = useCallback((message: string, tone: ToastTone = "good") => { const id = Date.now() + Math.random(); setItems((current) => [...current, { id, message, tone }]); window.setTimeout(() => dismissToast(id), 3000); }, [dismissToast]); const value = useMemo(() => ({ items, showToast, dismissToast }), [items, showToast, dismissToast]); return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>; }
export function useToast() { const value = useContext(ToastContext); if (!value) throw new Error("useToast must be used inside ToastProvider"); return value; }
export function ToastHost() { const { items, dismissToast } = useToast(); return <div className="transient-toast-host" role="region" aria-live="polite" aria-label="Notifications">{items.map((item) => <button key={item.id} className={`transient-toast ${item.tone}`} onClick={() => dismissToast(item.id)}>{item.message}</button>)}</div>; }
