import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar,
  History,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  Download,
  FileText
} from 'lucide-react';
import { Material, Movimentacao } from '@/types';
import { formatDate, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface AgeingData extends Material {
  data_base: string;
  dias_inatividade: number;
  classificacao: 'Giro Rápido' | 'Alerta' | 'Estoque Parado';
  origem_data: 'Última Saída' | 'Data de Entrada';
}

export default function InventoryAgeing() {
  const { user } = useAuth();
  const [ageingList, setAgeingList] = useState<AgeingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('TODOS');

  useEffect(() => {
    fetchAgeingData();
  }, []);

  async function fetchAgeingData() {
    setLoading(true);
    try {
      // 1. Fetch materials with stock > 0
      const { data: materials, error: matError } = await supabase
        .from('Material')
        .select('*, unit:UnitOfMeasure(sigla), category:Category(nome)')
        .gt('estoque_atual', 0);

      if (matError) throw matError;

      // 2. Fetch latest SAIDA for each material
      // We'll fetch all SAIDA movements and find the latest per material in JS for simplicity/reliability
      const { data: movements, error: movError } = await supabase
        .from('Movimentacao')
        .select('material_id, data')
        .eq('tipo', 'SAIDA')
        .order('data', { ascending: false });

      if (movError) throw movError;

      // Map to store latest movement date per material
      const latestMovementsMap = new Map<number, string>();
      movements?.forEach(mov => {
        if (!latestMovementsMap.has(mov.material_id)) {
          latestMovementsMap.set(mov.material_id, mov.data);
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const processedData: AgeingData[] = (materials || []).map(mat => {
        const lastSaida = latestMovementsMap.get(mat.id);
        const dataBaseStr = lastSaida || mat.data_entrada || new Date().toISOString().split('T')[0];
        const dataBase = new Date(dataBaseStr);
        dataBase.setHours(0, 0, 0, 0);

        // Calculate diff in days
        const diffTime = Math.abs(today.getTime() - dataBase.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let classificacao: AgeingData['classificacao'] = 'Giro Rápido';
        if (diffDays > 90) classificacao = 'Estoque Parado';
        else if (diffDays > 30) classificacao = 'Alerta';

        return {
          ...mat,
          data_base: dataBaseStr,
          dias_inatividade: diffDays,
          classificacao,
          origem_data: lastSaida ? 'Última Saída' : 'Data de Entrada'
        };
      });

      // Sort by days in descending order (highest ageing first)
      processedData.sort((a, b) => b.dias_inatividade - a.dias_inatividade);

      setAgeingList(processedData);
    } catch (error) {
      console.error('Erro ao calcular ageing:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = ageingList.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.referencia?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesClass = filterClass === 'TODOS' || item.classificacao === filterClass;
    return matchesSearch && matchesClass;
  });

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => ({
      'Material': item.nome,
      'Referência': item.referencia || '-',
      'Categoria': item.category?.nome || '-',
      'Estoque Atual': `${item.estoque_atual} ${item.unit?.sigla || ''}`,
      'Data Base': formatDate(item.data_base),
      'Origem': item.origem_data,
      'Dias Inativo': item.dias_inatividade,
      'Classificação': item.classificacao
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ageing_Estoque');
    XLSX.writeFile(wb, `ageing_estoque_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    // Dynamic imports to avoid "Illegal constructor" errors at boot time
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Ageing (Inatividade) de Peças', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data de Emissão: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filtros: Status: ${filterClass}`, 14, 35);

    const tableData = filteredData.map(item => [
      item.nome,
      item.referencia || '-',
      `${item.estoque_atual} ${item.unit?.sigla || ''}`,
      formatDate(item.data_base),
      item.dias_inatividade,
      item.classificacao
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Material', 'Ref.', 'Estoque', 'Data Base', 'Dias', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 },
    });

    doc.save(`ageing_estoque_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Permission check
  const canView = user?.role === 'ADMINISTRADOR' || user?.perfil?.permissions?.ageing?.visualizar;
  if (!canView && !loading) {
    return <Navigate to="/" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ageing (Inatividade) de Peças</h1>
          <p className="text-slate-500">Acompanhe o tempo que os itens estão parados no estoque.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-red-200 transition-all font-medium"
          >
            <FileText className="w-5 h-5" />
            PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all font-medium"
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Giro Rápido</p>
            <p className="text-2xl font-bold text-slate-900">{ageingList.filter(i => i.classificacao === 'Giro Rápido').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Alerta</p>
            <p className="text-2xl font-bold text-slate-900">{ageingList.filter(i => i.classificacao === 'Alerta').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Estoque Parado</p>
            <p className="text-2xl font-bold text-slate-900">{ageingList.filter(i => i.classificacao === 'Estoque Parado').length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <History className="w-5 h-5 text-blue-600" />
            <h2>Análise de Movimentação</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm w-full md:w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="Giro Rápido">Giro Rápido</option>
                <option value="Alerta">Alerta</option>
                <option value="Estoque Parado">Estoque Parado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Estoque</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data Base</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Dias Inativo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Calculando ageing...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhum dado encontrado.</td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{item.nome}</p>
                        <p className="text-xs text-slate-500">{item.referencia || 'Sem referência'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-medium text-slate-700">{item.estoque_atual} {item.unit?.sigla}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 opacity-50" />
                        <span className="text-sm">{formatDate(item.data_base)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-500 px-2 py-1 bg-slate-100 rounded-full">
                        {item.origem_data}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "font-bold",
                        item.classificacao === 'Estoque Parado' ? "text-red-600" :
                        item.classificacao === 'Alerta' ? "text-amber-600" : "text-emerald-600"
                      )}>
                        {item.dias_inatividade} dias
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        item.classificacao === 'Estoque Parado' ? "bg-red-50 text-red-700" :
                        item.classificacao === 'Alerta' ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                      )}>
                        {item.classificacao}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
