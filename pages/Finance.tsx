import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Link, useParams, Outlet, useNavigate } from 'react-router-dom';
import FinanceDashboard from '../components/FinanceDashboard';
import FinanceConfig from '../components/FinanceConfig';
import AccountDetails from '../components/AccountDetails';
import { supabase } from '../supabaseClient';

const FinanceBreadcrumbs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [accountName, setAccountName] = useState<string>('');

    // path parts
    const pathnames = location.pathname.split('/').filter((x) => x);
    // pathnames = ['finance', 'config'] or ['finance', 'account', '123']

    const isDashboard = pathnames.length === 1 && pathnames[0] === 'finance';
    const isConfig = pathnames.includes('config');
    const isAccount = pathnames.includes('account');
    const accountId = isAccount ? pathnames[pathnames.indexOf('account') + 1] : null;

    useEffect(() => {
        if (accountId) {
            // fetch account name for breadcrumb
            const fetchName = async () => {
                const { data } = await supabase.from('accounts').select('name').eq('id', accountId).single();
                if (data) setAccountName(data.name);
            };
            fetchName();
        } else {
            setAccountName('');
        }
    }, [accountId]);

    return (
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <span
                className="hover:text-primary transition-colors cursor-pointer"
                onClick={() => navigate('/')}
            >
                Inicio
            </span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span
                className={`transition-colors cursor-pointer ${isDashboard ? 'text-slate-900 dark:text-white font-medium' : 'hover:text-primary'}`}
                onClick={() => navigate('/finance')}
            >
                Finanzas
            </span>

            {isConfig && (
                <>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-slate-900 dark:text-white font-medium">Configuración</span>
                </>
            )}

            {isAccount && (
                <>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                        {accountName || 'Cuenta'}
                    </span>
                </>
            )}
        </div>
    );
};

const Finance: React.FC = () => {
    return (
        <div className="flex flex-col gap-4 p-6 md:p-8 max-w-[1400px] mx-auto">
            <FinanceBreadcrumbs />
            <Routes>
                <Route index element={<FinanceDashboard />} />
                <Route path="config" element={<FinanceConfig />} />
                <Route path="account/:id" element={<AccountDetails />} />
            </Routes>
        </div>
    );
};

export default Finance;