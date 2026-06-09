import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  Calendar,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  User as UserIcon,
  BookOpen,
  Filter,
  X,
  Printer
} from 'lucide-react';
import { Movimentacao, Material, Patient, Course } from '@/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function DateInput({ value, onChange, label }: DateInputProps) {
  const [localText, setLocalText] = useState('');

  useEffect(() => {
    if (value) {
      setLocalText(formatDate(value));
    } else {
      setLocalText('');
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const isDeleting = val.length < localText.length;
    let clean = val.replace(/\D/g, '');
    if (clean.length > 8) {
      clean = clean.slice(0, 8);
    }
    
    let formatted = val;
    if (!isDeleting) {
      if (clean.length > 2 && clean.length <= 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
      } else if (clean.length > 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
      } else {
        formatted = clean;
      }
    } else {
      if (localText.endsWith('/') && val.length === localText.length - 1) {
        clean = clean.slice(0, -1);
      }
      if (clean.length > 2 && clean.length <= 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
      } else if (clean.length > 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`;
      } else {
        formatted = clean;
      }
    }
    
    setLocalText(formatted);
    
    if (formatted.length === 10) {
      const parts = formatted.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
          const padD = d.toString().padStart(2, '0');
          const padM = m.toString().padStart(2, '0');
          const padY = y.toString().padStart(4, '0');
          const ymd = `${padY}-${padM}-${padD}`;
          const testDate = new Date(`${ymd}T12:00:00`);
          if (!isNaN(testDate.getTime())) {
            onChange(ymd);
          }
        }
      }
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="DD/MM/AAAA"
          value={localText}
          onChange={handleTextChange}
          maxLength={10}
          className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 pointer-events-none">
          <Calendar className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="date"
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              onChange(val);
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 cursor-pointer w-8 h-8 pointer-events-auto"
        />
      </div>
    </div>
  );
}

function removeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .toLowerCase();
}

export default function Reports() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Filter state
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'TODOS' | 'ENTRADA' | 'SAIDA' | 'TROCA'>('TODOS');
  const [filterMaterialType, setFilterMaterialType] = useState<string>('TODOS');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchMovements();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [startDate, endDate, filterType, filterMaterialType, selectedPatient, selectedCourse]);

  async function fetchLookups() {
    const [matRes, patRes, courRes] = await Promise.all([
      supabase.from('Material').select('*, unit:UnitOfMeasure(sigla)').order('nome'),
      supabase.from('Patient').select('*').order('nome'),
      supabase.from('Course').select('*').order('nome')
    ]);

    if (matRes.data) setMaterials(matRes.data);
    if (patRes.data) setPatients(patRes.data);
    if (courRes.data) setCourses(courRes.data);
  }

  async function fetchMovements() {
    setLoading(true);
    try {
      let query = supabase
        .from('Movimentacao')
        .select(`
          *,
          material:Material!inner(nome, referencia, preco_venda, tipo_material, unit:UnitOfMeasure(sigla), supplier:Supplier(nome))
        `)
        .order('data', { ascending: false });

      if (startDate) query = query.gte('data', startDate);
      if (endDate) query = query.lte('data', endDate);
      
      if (filterType === 'ENTRADA') {
        query = query.eq('tipo', 'ENTRADA');
      } else if (filterType === 'SAIDA') {
        query = query.eq('tipo', 'SAIDA');
      } else if (filterType === 'TROCA') {
        query = query.or('tipo_entrada.eq.Troca,tipo_entrada.eq.Reposição por Troca,tipo_entrada.eq.Troca de Material');
      }

      if (filterMaterialType !== 'TODOS') {
        query = query.eq('material.tipo_material', filterMaterialType);
      }

      if (selectedCourse) {
        query = query.eq('paciente_ou_curso', selectedCourse);
      }

      // If no specific filters (other than default dates), limit to 20
      // But wait, it always has default dates. 
      // The user said "mostrar os 20 primeiros registros".
      // I'll apply limit(20) if no specific target or type is selected? 
      // Or just always limit to 20 and let them filter?
      // Let's follow the "Materials" pattern: if searching/filtering, show all matching (or a larger limit), otherwise 20.
      
      // No initial state limit to show full list of movements in the period

      const { data, error } = await query;
      if (error) throw error;
      if (data) setMovements(data as Movimentacao[]);
    } catch (error) {
      console.error('Erro ao buscar movimentações:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredMovements = movements.filter(mov => {
    if (!selectedPatient) return true;
    return removeAccents(mov.paciente_ou_curso ?? '').includes(removeAccents(selectedPatient));
  });

  // Permission check
  const canView = user?.role === 'ADMINISTRADOR' || user?.perfil?.permissions?.relatorios?.visualizar;
  if (!canView && !loading) {
    return <Navigate to="/" />;
  }

  const getFullDataForExport = async () => {
    try {
      let query = supabase
        .from('Movimentacao')
        .select(`
          *,
          material:Material!inner(nome, referencia, preco_venda, tipo_material, unit:UnitOfMeasure(sigla), supplier:Supplier(nome))
        `)
        .order('data', { ascending: false });

      if (startDate) query = query.gte('data', startDate);
      if (endDate) query = query.lte('data', endDate);
      
      if (filterType === 'ENTRADA') {
        query = query.eq('tipo', 'ENTRADA');
      } else if (filterType === 'SAIDA') {
        query = query.eq('tipo', 'SAIDA');
      } else if (filterType === 'TROCA') {
        query = query.or('tipo_entrada.eq.Troca,tipo_entrada.eq.Reposição por Troca,tipo_entrada.eq.Troca de Material');
      }

      if (filterMaterialType !== 'TODOS') {
        query = query.eq('material.tipo_material', filterMaterialType);
      }

      if (selectedCourse) {
        query = query.eq('paciente_ou_curso', selectedCourse);
      }

      const { data, error } = await query;
      if (error) throw error;

      const movementsData = data as Movimentacao[];
      if (!selectedPatient) return movementsData;

      return movementsData.filter(mov =>
        removeAccents(mov.paciente_ou_curso ?? '').includes(removeAccents(selectedPatient))
      );
    } catch (error) {
      console.error('Erro ao buscar dados para exportação:', error);
      return movements; // Fallback to current state
    }
  };

  const handleExportExcel = async () => {
    const allData = await getFullDataForExport();
    const dataToExport = allData.map(mov => ({
      'Data': formatDate(mov.data),
      'Tipo': mov.tipo,
      'Subtipo': mov.tipo_entrada,
      'Material': mov.material?.nome,
      'REF.': mov.material?.referencia || '-',
      'Fornecedor': mov.material?.supplier?.nome || '-',
      'Quantidade': mov.quantidade,
      'Unidade': mov.material?.unit?.sigla,
      'Valor Unit.': mov.valor_unitario,
      'Preço Venda': mov.material?.preco_venda,
      'Valor Total (Venda)': mov.quantidade * (mov.material?.preco_venda || 0),
      'Destino/Origem': mov.paciente_ou_curso,
      'Responsável': mov.profissional_responsavel,
      'Observações': mov.observacoes
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Movimentacoes');
    XLSX.writeFile(wb, `relatorio_movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    // Dynamic imports to avoid "Illegal constructor" errors at boot time
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const allData = await getFullDataForExport();
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Relatório de Movimentações', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${formatDate(startDate)} até ${formatDate(endDate)}`, 14, 30);
    doc.text(`Filtros: Tipo: ${filterType} | Mat. Tipo: ${filterMaterialType} | Paciente: ${selectedPatient || 'Todos'} | Curso: ${selectedCourse || 'Todos'}`, 14, 35);
    doc.text(`Data de Emissão: ${new Date().toLocaleString()}`, 14, 40);

    const tableData = allData.map(mov => [
      formatDate(mov.data),
      `${mov.tipo} (${mov.tipo_entrada})`,
      mov.material?.nome || '-',
      mov.material?.referencia || '-',
      mov.material?.supplier?.nome || '-',
      `${mov.quantidade} ${mov.material?.unit?.sigla || ''}`,
      mov.paciente_ou_curso || '-',
      formatCurrency(mov.quantidade * (mov.material?.preco_venda || 0))
    ]);

    const total = allData.reduce((acc, mov) => acc + (mov.quantidade * (mov.material?.preco_venda || 0)), 0);

    autoTable(doc, {
      startY: 45,
      head: [['Data', 'Tipo', 'Material', 'REF.', 'Fornecedor', 'Qtd', 'Destino/Origem', 'Total']],
      body: tableData,
      foot: [['', '', '', '', '', 'TOTAL DO PERÍODO:', formatCurrency(total)]],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio_movimentacoes_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handlePrintThermal = () => {
    const printContent = document.getElementById('thermal-receipt');
    if (!printContent) {
      console.error('Conteúdo do cupom não encontrado');
      return;
    }

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Write the content to the iframe
    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Cupom ClinStockPro</title>
          <style>
            @page { 
              size: 80mm auto; 
              margin: 0; 
            }
            body { 
              width: 72mm; /* Slightly less than 80mm to account for margins */
              margin: 0 auto; 
              padding: 4mm 0;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
              font-size: 10pt;
              line-height: 1.4;
              color: black;
              -webkit-font-smoothing: antialiased;
            }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 4mm 0; }
            th { text-align: left; padding: 4px 0; font-weight: 800; border-bottom: 2px solid black; }
            td { text-align: left; padding: 6px 0; word-wrap: break-word; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 800; }
            .border-bottom { border-bottom: 2px solid black; }
            .border-top { border-top: 2px solid black; }
            .mb-2 { margin-bottom: 12px; }
            .my-1 { margin: 8px 0; }
            .mt-2 { margin-top: 12px; }
            .mt-4 { margin-top: 24px; }
            .pt-1 { padding-top: 8px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .uppercase { text-transform: uppercase; letter-spacing: 0.5px; }
            .text-base { font-size: 12pt; }
            .text-xs { font-size: 9pt; }
            .item-name { font-weight: 600; display: block; margin-bottom: 2px; }
            .item-meta { font-size: 8.5pt; color: #333; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for content to load and then print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove the iframe after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Movimentações</h1>
          <p className="text-slate-500">Consulte e exporte o histórico detalhado do estoque.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrintThermal}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-slate-200 transition-all font-medium"
          >
            <Printer className="w-5 h-5" />
            Imprimir Cupom (80mm)
          </button>
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 print:hidden">
        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
          <Filter className="w-5 h-5 text-blue-600" />
          <h2>Filtros do Relatório</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <DateInput
            value={startDate}
            onChange={setStartDate}
            label="Início"
          />
          <DateInput
            value={endDate}
            onChange={setEndDate}
            label="Fim"
          />
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo Mov.</label>
            <select
              value={filterType ?? ''}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="TODOS">Todos (Entrada/Saída)</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
              <option value="TROCA">Troca</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Material</label>
            <select
              value={filterMaterialType}
              onChange={(e) => setFilterMaterialType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="TODOS">Todos os Materiais</option>
              <option value="Próprio">Próprio</option>
              <option value="Consignado">Consignado</option>
              <option value="Doação">Doação</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Paciente</label>
            <div className="relative flex items-center">
              <input
                type="text"
                list="patients-list"
                placeholder="Busca por nome..."
                value={selectedPatient ?? ''}
                onChange={(e) => {
                  setSelectedPatient(e.target.value);
                  if (e.target.value) setSelectedCourse('');
                }}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
              {selectedPatient && (
                <button
                  type="button"
                  onClick={() => setSelectedPatient('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <datalist id="patients-list">
              {patients.map(p => (
                <option key={p.id} value={p.nome} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Curso/Turma</label>
            <select
              value={selectedCourse ?? ''}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                if (e.target.value) setSelectedPatient('');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="">Todos os Cursos</option>
              {courses.map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        <div className="p-6 border-b border-slate-100 hidden print:block">
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Movimentações</h1>
          <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-slate-600">
            <p>Período: {formatDate(startDate)} até {formatDate(endDate)}</p>
            <p>Tipo Mov.: {filterType}</p>
            <p>Tipo Material: {filterMaterialType}</p>
            <p>Paciente: {selectedPatient || 'Todos'}</p>
            <p>Curso/Turma: {selectedCourse || 'Todos'}</p>
            <p>Data de Emissão: {new Date().toLocaleString()}</p>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] print:max-h-none">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm print:static print:bg-white print:shadow-none">
              <tr className="border-b border-slate-200 print:bg-white">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">REF.</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Qtd</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino/Origem</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Gerando relatório...</td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma movimentação encontrada para os filtros selecionados.</td>
                </tr>
              ) : (
                <>
                  {filteredMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(mov.data)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span 
                            translate="no"
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                              mov.tipo === 'ENTRADA' ? "text-emerald-700" : "text-red-700"
                            )}
                          >
                            {mov.tipo === 'ENTRADA' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {mov.tipo}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{mov.tipo_entrada}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">{mov.material?.nome}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">{mov.material?.referencia || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 truncate max-w-[120px]" title={mov.material?.supplier?.nome}>
                          {mov.material?.supplier?.nome || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-900">{mov.quantidade} {mov.material?.unit?.sigla}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {mov.tipo === 'SAIDA' ? <UserIcon className="w-4 h-4 text-slate-400" /> : <BookOpen className="w-4 h-4 text-slate-400" />}
                          <span className="text-sm text-slate-600">{mov.paciente_ou_curso || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{formatCurrency(mov.quantidade * (mov.material?.preco_venda || 0))}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold print:bg-white">
                    <td colSpan={7} className="px-6 py-4 text-right text-slate-700">TOTAL DO PERÍODO (VENDA):</td>
                    <td className="px-6 py-4 text-slate-900">
                      {formatCurrency(filteredMovements.reduce((acc, mov) => acc + (mov.quantidade * (mov.material?.preco_venda || 0)), 0))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Receipt (Hidden in UI, only used as template for iframe print) */}
      <div id="thermal-receipt" className="hidden">
        <div className="text-center mb-2">
          <div className="font-bold text-base uppercase">ClinStockPro</div>
          <div className="text-xs">Relatório de Movimentações</div>
          <div className="border-bottom my-1"></div>
          <div className="text-xs">Período: {formatDate(startDate)} - {formatDate(endDate)}</div>
          <div className="text-xs">Emissão: {new Date().toLocaleString()}</div>
        </div>

        <table>
          <thead>
            <tr className="border-bottom font-bold text-xs uppercase">
              <th style={{ width: '15%' }}>QTD</th>
              <th style={{ width: '65%' }} colSpan={3}>DESCRIÇÃO</th>
              <th style={{ width: '20%' }} className="text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.map((mov) => (
              <tr key={mov.id} className="text-xs">
                <td style={{ verticalAlign: 'top' }}>{mov.quantidade}</td>
                <td colSpan={3}>
                  <span className="item-name">{mov.material?.nome}</span>
                  <div className="item-meta">
                    REF: {mov.material?.referencia || '-'} | DEST: {mov.paciente_ou_curso || '-'}
                  </div>
                </td>
                <td className="text-right" style={{ verticalAlign: 'top' }}>
                  {formatCurrency(mov.quantidade * (mov.material?.preco_venda || 0)).replace('R$', '').trim()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-top mt-2 pt-1">
          <div className="flex justify-between font-bold text-xs">
            <span>TOTAL:</span>
            <span>
              {formatCurrency(filteredMovements.reduce((acc, mov) => acc + (mov.quantidade * (mov.material?.preco_venda || 0)), 0))}
            </span>
          </div>
        </div>

        <div className="text-center mt-4 text-xs">
          <div>Obrigado por usar o ClinStockPro</div>
          <div>Praxis Instituto de Pós-Graduação em Saúde</div>
        </div>
      </div>
    </div>
  );
}
