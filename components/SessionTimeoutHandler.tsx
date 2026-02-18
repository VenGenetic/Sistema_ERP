import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Assuming react-router-dom is used
import { supabase } from '../supabaseClient'; // Adjust path if needed

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_LIMIT_MS = 28 * 60 * 1000; // 28 minutes
const CHECK_CX_INTERVAL_MS = 1000; // Check every second
const THROTTLE_Limit_MS = 1000; // Throttle activity updates to once per second

// Key for localStorage to sync across tabs
const STORAGE_KEY = 'lastActivityTime';

const SessionTimeoutHandler: React.FC = () => {
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const navigate = useNavigate();
    const location = useLocation();

    // Use a ref to track the last time we updated localStorage to implement throttling
    const lastUpdateRef = useRef<number>(Date.now());

    // Function to update the last activity time
    const updateActivity = useCallback(() => {
        const now = Date.now();
        // Throttle updates: only write to localStorage if enough time has passed
        if (now - lastUpdateRef.current > THROTTLE_Limit_MS) {
            localStorage.setItem(STORAGE_KEY, now.toString());
            lastUpdateRef.current = now;
        }
    }, []);

    // Effect to set initial time and listen for user activity
    useEffect(() => {
        // Initialize if not present
        if (!localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        }

        const handleActivity = () => {
            updateActivity();
        };

        // Events to listen for
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        // Add listeners
        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        // Cleanup
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [updateActivity]);

    // Effect to reset timer on route change (navigation is also activity)
    useEffect(() => {
        updateActivity();
    }, [location, updateActivity]);

    // Effect for the interval check
    useEffect(() => {
        const intervalId = setInterval(() => {
            const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || Date.now().toString(), 10);
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity;

            if (timeSinceLastActivity > INACTIVITY_LIMIT_MS) {
                // Time expired
                handleLogout();
            } else if (timeSinceLastActivity > WARNING_LIMIT_MS) {
                // Show warning
                setShowWarning(true);
                setTimeLeft(Math.ceil((INACTIVITY_LIMIT_MS - timeSinceLastActivity) / 1000));
            } else {
                // Reset warning if activity occurred (e.g. in another tab)
                if (showWarning) {
                    setShowWarning(false);
                }
            }
        }, CHECK_CX_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [showWarning]);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('sb-access-token'); // Clear Supabase token if needed manually, though signOut usually handles it
            localStorage.removeItem('sb-refresh-token');
            setShowWarning(false);
            navigate('/login');
        }
    };

    const handleContinueSession = () => {
        const now = Date.now();
        localStorage.setItem(STORAGE_KEY, now.toString());
        lastUpdateRef.current = now;
        setShowWarning(false);
    };

    if (!showWarning) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-[28px]">timer</span>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sesión por Expirar</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                            Tu sesión se cerrará automáticamente en <br />
                            <span className="font-mono text-lg font-bold text-primary">{timeLeft} segundos</span>
                            <br /> por inactividad.
                        </p>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                        <button
                            onClick={handleContinueSession}
                            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors"
                        >
                            Mantener Sesión Activa
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cerrar Sesión Ahora
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionTimeoutHandler;
