import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, 
  AlertTriangle, 
  Package,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  X
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { formatCurrency, cn } from '@/lib/utils';
import { Material, Movimentacao } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    totalValue: 0,
    monthlyMovements: 0
  });
  const [recentMovements, setRecentMovements] = useState<Movimentacao[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Material[]>([]);
  const [fullLowStockList, setFullLowStockList] = useState<Material[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      // 1. Buscar métricas globais
      const { data: materials } = await supabase
        .from('Material')
        .select('id, nome, estoque_atual, estoque_minimo, valor_unitario');
      
      // 2. Buscar movimentações recentes via View
      const { data: movements } = await supabase
        .from('v_movimentacoes_detalhes')
        .select('*')
        .order('id', { ascending: false })
        .limit(5);

      // 3. Buscar apenas itens críticos via View específica
      const { data: criticalItems } = await supabase
        .from('v_estoque_critico')
        .select('*')
        .limit(5);

      if (materials) {
        const totalItems = materials.length;
        const lowStockList = materials.filter(m => m.estoque_atual <= m.estoque_minimo && m.valor_unitario !== 0);
        const lowStock = lowStockList.length;
        const totalValue = materials.reduce((acc, m) => acc + (m.estoque_atual * (m.valor_unitario || 0)), 0);
        
        setFullLowStockList(lowStockList as Material[]);
        setStats({
          totalItems,
          lowStock,
          totalValue,
          monthlyMovements: 0
        });
      }

      if (criticalItems) {
        setLowStockItems(criticalItems as any[]);
      }

      if (movements) {
        setRecentMovements(movements as any[]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Permission check
  const canView = user?.role === 'ADMINISTRADOR' || user?.perfil?.permissions?.dashboard?.visualizar;
  if (!canView) {
    return <Navigate to="/estoque" />; // Redirect to stock if dashboard is restricted
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Visão geral do seu estoque e movimentações recentes.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Itens" 
          value={stats.totalItems} 
          icon={Package} 
          color="blue" 
        />
        <StatCard 
          title="Estoque Baixo" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="amber" 
          subtitle="Itens abaixo do mínimo"
          onClick={() => setIsModalOpen(true)}
        />
        <StatCard 
          title="Valor em Estoque" 
          value={formatCurrency(stats.totalValue)} 
          icon={TrendingUp} 
          color="emerald" 
        />
        <StatCard 
          title="Movimentações" 
          value={recentMovements.length} 
          icon={ArrowLeftRight} 
          color="indigo" 
          subtitle="Últimas 5 registradas"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Movements */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Movimentações Recentes</h2>
            <Link to="/movimentacoes" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentMovements.map((mov) => (
              <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    mov.tipo === 'ENTRADA' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {mov.tipo === 'ENTRADA' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{(mov as any).material_nome || 'Material'}</p>
                    <p className="text-xs text-slate-500">{mov.data} • {(mov as any).destino_origem || 'Geral'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-bold",
                    mov.tipo === 'ENTRADA' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {mov.tipo === 'ENTRADA' ? '+' : '-'}{mov.quantidade}
                  </p>
                  <p className="text-xs text-slate-400">{formatCurrency(mov.valor_total)}</p>
                </div>
              </div>
            ))}
            {recentMovements.length === 0 && (
              <div className="p-8 text-center text-slate-500">Nenhuma movimentação recente.</div>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Alertas de Estoque</h2>
          </div>
          <div className="p-4 space-y-4">
            {lowStockItems.length > 0 ? (
              lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                      <p className="text-[10px] text-red-600 font-medium uppercase tracking-wider">Estoque Crítico</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{item.estoque_atual}</p>
                    <p className="text-[10px] text-slate-400">Mín: {item.estoque_minimo}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p className="text-sm font-medium">Tudo em ordem!</p>
                <p className="text-xs">Nenhum item com estoque baixo.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Estoque Baixo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center border border-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Itens com Estoque Baixo</h2>
                  <p className="text-xs text-amber-600 font-medium">Lista de materiais com quantidade igual ou inferior ao mínimo</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {fullLowStockList.length > 0 ? (
                fullLowStockList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-amber-200 hover:bg-amber-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm group-hover:border-amber-200 transition-colors">
                        <Package className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-amber-900">{item.nome}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">ID: {item.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-tighter">Estoque Atual</p>
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-black text-sm border border-amber-200">
                          {item.estoque_atual}
                        </span>
                      </div>
                      <div className="text-right border-l border-slate-200 pl-6">
                        <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-tighter">Mínimo</p>
                        <span className="text-slate-600 font-bold">
                          {item.estoque_minimo}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 animate-pulse">
                  Nenhum item encontrado.
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all shadow-sm active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle, onClick }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-95"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
