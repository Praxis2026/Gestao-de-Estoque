import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Users,
  Tags,
  Truck,
  Ruler,
  Shield,
  UserPlus,
  FileText,
  History,
  Layers,
  ClipboardList,
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard' },
  { icon: Package, label: 'Materiais', path: '/materiais', module: 'estoque' },
  { icon: ArrowLeftRight, label: 'Movimentações', path: '/movimentacoes', module: 'movimentacoes' },
  { icon: ClipboardList, label: 'Serviços Protéticos', path: '/proteses', module: 'proteses' },
  { icon: Layers, label: 'Equivalência Produtos', path: '/equivalencias', module: 'equivalencias' },
  { icon: Tags, label: 'Categorias', path: '/categorias', module: 'estoque' },
  { icon: Ruler, label: 'Unidades', path: '/unidades', module: 'estoque' },
  { icon: Truck, label: 'Fornecedores', path: '/fornecedores', module: 'estoque' },
  { icon: Users, label: 'Pacientes/Cursos', path: '/pacientes-cursos', module: 'pacientes' },
  { icon: FileText, label: 'Relatório Movimentações', path: '/relatorios', module: 'relatorios' },
  { icon: FileText, label: 'Relatório Materiais', path: '/relatorios/materiais', module: 'relatorios' },
  { icon: History, label: 'Tempo de Estoque', path: '/relatorios/ageing', module: 'ageing' },
  { icon: Layers, label: 'Estoque por Compatibilidade', path: '/relatorios/compatibilidade', module: 'relatorios' },
  { icon: Shield, label: 'Perfis de Acesso', path: '/perfis', module: 'usuarios' },
  { icon: UserPlus, label: 'Usuários', path: '/usuarios', module: 'usuarios' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes', module: 'configuracoes' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    fetchLogo();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  async function fetchLogo() {
    const { data } = await supabase
      .from('Setting')
      .select('value')
      .eq('key', 'logo_url')
      .single();
    
    if (data) setLogoUrl(data.value);
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="text-white w-5 h-5" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <Package className="text-blue-600 w-6 h-6" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => {
            // If user is ADMINISTRADOR and has no profile, show all
            if (user?.role === 'ADMINISTRADOR' && !user.perfil_id) return true;
            
            // Check permissions from profile
            const permissions = user?.perfil?.permissions;
            if (!permissions) return user?.role === 'ADMINISTRADOR';
            
            const moduleKey = item.module as keyof typeof permissions;
            return permissions[moduleKey]?.visualizar ?? (user?.role === 'ADMINISTRADOR');
          }).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group",
                  isActive 
                    ? "bg-blue-50 text-blue-600" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-100">
            <div className={cn("flex items-center gap-3 mb-2 px-3", !isSidebarOpen && "justify-center")}>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 truncate">{user?.role}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all group",
                !isSidebarOpen && "justify-center"
              )}
            >
              <LogOut className="w-5 h-5 shrink-0 text-red-400 group-hover:text-red-600" />
              {isSidebarOpen && <span className="font-medium">Sair</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:inline">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors flex items-center justify-center"
              title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5 text-slate-500 hover:text-slate-700" /> : <Sun className="w-5 h-5 text-amber-500 hover:text-amber-400" />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
