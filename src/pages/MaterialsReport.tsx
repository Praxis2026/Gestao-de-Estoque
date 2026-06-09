import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  Download,
  FileText,
  Filter,
  X,
  Package,
  Tags,
  Layers
} from 'lucide-react';
import { Material, Category } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function MaterialsReport() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchMaterials();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory, selectedType, onlyLowStock]);

  async function fetchCategories() {
    const { data } = await supabase.from('Category').select('*').order('nome');
    if (data) setCategories(data);
  }

  async function fetchMaterials() {
    setLoading(true);
    try {
      let query = supabase
        .from('Material')
        .select(`
          *,
          category:Category(nome),
          unit:UnitOfMeasure(sigla),
          supplier:Supplier(nome)
        `)
        .order('nome');

      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,referencia.ilike.%${searchTerm}%`);
      }
      
      if (selectedCategory) {
        query = query.eq('categoriaId', selectedCategory);
      }

      if (selectedType) {
        query = query.eq('tipo_material', selectedType);
      }

      query = query.neq('valor_unitario', 0);

      // No initial state limit to show full list of materials in the report

      const { data, error } = await query;
      if (error) throw error;
      if (data) setMaterials(data as Material[]);
    } catch (error) {
      console.error('Erro ao buscar materiais para relatório:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredMaterials = onlyLowStock 
    ? materials.filter(m => m.estoque_atual <= (m.estoque_minimo || 0))
    : materials;

  // Permission check
  const canView = user?.role === 'ADMINISTRADOR' || user?.perfil?.permissions?.relatorios?.visualizar;
  if (!canView && !loading) {
    return <Navigate to="/" />;
  }

  const getFullDataForExport = async () => {
    try {
      let query = supabase
        .from('Material')
        .select(`
          *,
          category:Category(nome),
          unit:UnitOfMeasure(sigla),
          supplier:Supplier(nome)
        `)
        .order('nome');

      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,referencia.ilike.%${searchTerm}%`);
      }
      
      if (selectedCategory) {
        query = query.eq('categoriaId', selectedCategory);
      }

      if (selectedType) {
        query = query.eq('tipo_material', selectedType);
      }

      query = query.neq('valor_unitario', 0);

      const { data, error } = await query;
      if (error) throw error;
      
      let results = data as Material[];
      if (onlyLowStock) {
        results = results.filter(m => m.estoque_atual <= (m.estoque_minimo || 0));
      }
      return results;
    } catch (error) {
      console.error('Erro ao buscar dados para exportação:', error);
      return materials; // Fallback to current state
    }
  };

  const handleExportExcel = async () => {
    const allData = await getFullDataForExport();
    const dataToExport = allData.map(mat => ({
      'Material': mat.nome,
      'Referência': mat.referencia || '-',
      'Fornecedor': mat.supplier?.nome || '-',
      'Categoria': mat.category?.nome || '-',
      'Tipo': mat.tipo_material,
      'Estoque': `${mat.estoque_atual} ${mat.unit?.sigla || ''}`,
      'Valor sem Desconto': mat.vl_sem_desconto || 0,
      'Valor com desconto': mat.valor_unitario,
      'Valor Total': mat.estoque_atual * (mat.valor_unitario || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Materiais');
    XLSX.writeFile(wb, `relatorio_materiais_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    // Dynamic imports to avoid "Illegal constructor" errors at boot time
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const allData = await getFullDataForExport();
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Relatório de Materiais em Estoque', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const categoryName = selectedCategory ? categories.find(c => c.id.toString() === selectedCategory)?.nome : 'Todas';
    const filterText = `Categoria: ${categoryName} | Tipo: ${selectedType || 'Todos'}${onlyLowStock ? ' | Alertas de Estoque: Sim' : ''}`;
    doc.text(`Filtros: ${filterText}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleString()}`, 14, 35);

    const tableData = allData.map(mat => [
      mat.nome,
      mat.referencia || '-',
      mat.supplier?.nome || '-',
      mat.category?.nome || '-',
      mat.tipo_material,
      `${mat.estoque_atual} ${mat.unit?.sigla || ''}`,
      formatCurrency(mat.vl_sem_desconto || 0),
      formatCurrency(mat.valor_unitario || 0),
      formatCurrency(mat.estoque_atual * (mat.valor_unitario || 0))
    ]);

    const totalValue = allData.reduce((acc, mat) => acc + (mat.estoque_atual * (mat.valor_unitario || 0)), 0);

    autoTable(doc, {
      startY: 40,
      head: [['Material', 'Ref.', 'Fornecedor', 'Categoria', 'Tipo', 'Estoque', 'Vlr. sem Desconto', 'Vlr. com Desconto', 'Valor Total']],
      body: tableData,
      foot: [['', '', '', '', '', '', 'VALOR TOTAL EM ESTOQUE:', formatCurrency(totalValue)]],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio_materiais_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Materiais</h1>
          <p className="text-slate-500">Visão geral do inventário e valor em estoque.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-red-200 transition-all font-medium"
          >
            <FileText className="w-5 h-5" />
            Exportar PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all font-medium"
          >
            <Download className="w-5 h-5" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
          <Filter className="w-5 h-5 text-blue-600" />
          <h2>Filtros do Inventário</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Buscar Material/Ref</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Nome ou referência..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoria</label>
            <select
              value={selectedCategory ?? ''}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="">Todas as Categorias</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Material</label>
            <select
              value={selectedType ?? ''}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="">Todos os Tipos</option>
              <option value="Próprio">Próprio</option>
              <option value="Consignado">Consignado</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="lowStockOnly"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="lowStockOnly" className="text-sm font-medium text-red-600 cursor-pointer">
            Mostrar apenas itens com Alerta de Estoque (Estoque Baixo)
          </label>
        </div>

        {(searchTerm || selectedCategory || selectedType || onlyLowStock) && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedType('');
                setOnlyLowStock(false);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ref.</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Estoque</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vlr. sem Desconto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vlr. com Desconto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Gerando relatório...</td>
                </tr>
              ) : filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhum material encontrado para os filtros selecionados.</td>
                </tr>
              ) : (
                <>
                  {filteredMaterials.map((mat) => (
                    <tr key={mat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Package className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-slate-900">{mat.nome}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">{mat.referencia || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 truncate max-w-[150px]" title={mat.supplier?.nome}>
                          {mat.supplier?.nome || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Tags className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">{mat.category?.nome || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">{mat.tipo_material}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "font-bold",
                          mat.estoque_atual <= mat.estoque_minimo ? "text-red-600" : "text-slate-900"
                        )}>
                          {mat.estoque_atual} {mat.unit?.sigla}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {formatCurrency(mat.vl_sem_desconto || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {formatCurrency(mat.valor_unitario || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(mat.estoque_atual * (mat.valor_unitario || 0))}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={8} className="px-6 py-4 text-right text-slate-700 uppercase tracking-wider text-xs">Valor Total em Estoque:</td>
                    <td className="px-6 py-4 text-slate-900">
                      {formatCurrency(filteredMaterials.reduce((acc, mat) => acc + (mat.estoque_atual * (mat.valor_unitario || 0)), 0))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
