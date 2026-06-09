import React, { useState, useEffect } from 'react';
import { supabase, realSupabase } from '@/lib/supabase';
import { LogIn, Loader2, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchLogo();
  }, []);

  async function fetchLogo() {
    try {
      const { data } = await supabase
        .from('Setting')
        .select('value')
        .eq('key', 'logo_url')
        .single();
      
      if (data) setLogoUrl(data.value);
    } catch (e) {
      console.log('Incapaz de carregar a logo (RLS pode estar protegendo a tabela Setting para usuários anônimos)');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const lowercaseEmail = email.trim().toLowerCase();

    // Garante a remoção de sessões mockadas para permitir conexões e consultas limpas ao Supabase real
    localStorage.removeItem('clinstockpro_mock_user');
    localStorage.removeItem('clinstockpro_use_real_db');

    // LOGIN DE USUÁRIO REAL NO SUPABASE
    try {
      const { data, error: authError } = await realSupabase.auth.signInWithPassword({
        email: lowercaseEmail,
        password,
      });

      if (authError) throw authError;

      console.log('✅ Autenticação realizada com sucesso no Supabase real:', data.user?.email);
      setSuccessMsg('Login efetuado com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/', { replace: true });
        window.location.reload();
      }, 500);
    } catch (err: any) {
      console.warn('Falha na autenticação do Supabase:', err.message || err);
      let errorMessage = 'Credenciais inválidas. Por favor, verifique seu e-mail e senha cadastrados.';
      
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('invalid') || errMsg.includes('credential') || errMsg.includes('bad request') || errMsg.includes('unauthorized')) {
        errorMessage = 'Credenciais inválidas. Certifique-se de que o e-mail e a senha digitados estão corretos.';
      } else if (errMsg.includes('email not confirmed')) {
        errorMessage = 'E-mail não confirmado. Verifique sua caixa de entrada para confirmar o cadastro.';
      } else if (err.message) {
        errorMessage = `Erro de login: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="inline-flex items-center justify-center w-14 h-14 bg-[#00629B] rounded-2xl shadow-lg shadow-blue-100">
                <Package className="text-white w-7 h-7" />
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-800">ClinStockPro</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00629B] focus:border-transparent transition-all outline-none text-sm"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00629B] focus:border-transparent transition-all outline-none text-sm"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg leading-relaxed">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-lg leading-relaxed">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00629B] hover:bg-[#005180] text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400">
            © 2026 ClinStockPro - Gestão de Materiais Odontológicos
          </p>
        </div>
      </motion.div>
    </div>
  );
}
