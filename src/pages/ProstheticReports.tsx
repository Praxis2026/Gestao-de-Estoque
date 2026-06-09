import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Calendar,
  Truck,
  AlertCircle,
  CheckCircle2,
  PieChart,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { ProstheticService, Supplier } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ProstheticReports() {
  const [services, setServices] = useState<ProstheticService[]>([]);
  const [laboratories, setLaboratories] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedLab, setSelectedLab] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedLab, selectedStatus]);

  async function fetchData() {
    setLoading(true);
    try {
      let query = supabase.from('prosthetic_services')
        .select('*, patient:patient_id(nome), supplier:supplier_id(nome)')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + ' 23:59:59');

      if (selectedLab !== 'ALL') {
        query = query.eq('supplier_id', selectedLab);
      }

      if (selectedStatus !== 'ALL') {
        query = query.eq('status', selectedStatus);
      }

      const [servicesRes, labsRes] = await Promise.all([
        query.order('created_at', { ascending: false }),
        supabase.from('Supplier').select('*').order('nome')
      ]);

      if (servicesRes.data) setServices(servicesRes.data);
      if (labsRes.data) setLaboratories(labsRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  // Statistics
  const stats = {
    total: services.length,
    finalizados: services.filter(s => s.status === 'FINALIZADO').length,
    totalValor: services.filter(s => s.status === 'FINALIZADO' && s.onus_repeticao !== 'LABORATORIO')
      .reduce((sum, s) => sum + s.valor_servico, 0),
    taxaErro: services.length > 0 
      ? (services.filter(s => s.is_repeticao).length / services.length) * 100 
      : 0,
    repeticoesLab: services.filter(s => s.is_repeticao && s.onus_repeticao === 'LABORATORIO').length,
    repeticoesClinica: services.filter(s => s.is_repeticao && s.onus_repeticao === 'CLINICA').length,
  };

  const handleExportExcel = () => {
    const data = services.map(s => ({
      'Referência OS': s.referencia_os,
      'Data Envio': new Date(s.data_envio).toLocaleDateString(),
      'Data Finalização': s.data_finalizacao ? new Date(s.data_finalizacao).toLocaleDateString() : '-',
      'Paciente': (s.patient as any)?.nome,
      'Laboratório': (s.supplier as any)?.nome,
      'Status': s.status,
      'Repetição': s.is_repeticao ? 'SIM' : 'NÃO',
      'Ônus': s.onus_repeticao || '-',
      'Valor Serviço': s.valor_servico,
    }));

    // Add Total Row
    const totalValor = services.reduce((sum, s) => sum + (s.valor_servico || 0), 0);
    data.push({
      'Referência OS': 'TOTAL',
      'Data Envio': '',
      'Data Finalização': '',
      'Paciente': '',
      'Laboratório': '',
      'Status': '',
      'Repetição': '',
      'Ônus': '',
      'Valor Serviço': totalValor,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fechamento Protético');
    XLSX.writeFile(wb, `fechamento_proteses_${dateRange.start}_a_${dateRange.end}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const totalValor = services.reduce((sum, s) => sum + (s.valor_servico || 0), 0);
    
    doc.setFontSize(16);
    doc.text('Fechamento Mensal - Serviços Protéticos', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${new Date(dateRange.start).toLocaleDateString()} a ${new Date(dateRange.end).toLocaleDateString()}`, 14, 22);
    doc.text(`Emitido em: ${dateStr}`, 150, 22);

    // Summary Box
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 28, 182, 20, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Finalizado (Faturamento):', 20, 38);
    doc.text(formatCurrency(stats.totalValor), 150, 38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Total de OS no período: ${stats.total} | Taxa de Repetição: ${stats.taxaErro.toFixed(1)}%`, 20, 44);

    const tableData = services.map(s => [
      s.referencia_os,
      (s.patient as any)?.nome,
      (s.supplier as any)?.nome,
      s.status,
      s.is_repeticao ? `SIM (${s.onus_repeticao})` : 'NÃO',
      formatCurrency(s.valor_servico)
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['OS', 'Paciente', 'Laboratório', 'Status', 'Repet/Ônus', 'Valor']],
      body: tableData,
      foot: [['', '', '', '', 'TOTAL', formatCurrency(totalValor)]],
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        5: { halign: 'right' }
      }
    });

    doc.save(`relatorio_fechamento_proteses_${dateRange.start}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/proteses" className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Gestão de Serviços
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios e Fechamento Protético</h1>
          <p className="text-slate-500 text-sm">Indicadores de qualidade e faturamento mensal de serviços.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-slate-200 transition-all font-medium text-sm"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            Exportar PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-green-200 transition-all font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase">Início:</span>
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase">Fim:</span>
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase">Laboratório:</span>
          <select 
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
            className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todos Laboratórios</option>
            {laboratories.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todos Status</option>
            <option value="ABERTO">Aberto</option>
            <option value="RECEBIDO">Recebido</option>
            <option value="AJUSTE_REQUISITADO">Ajuste Requisitado</option>
            <option value="REPETICAO">Repetição</option>
            <option value="FINALIZADO">Finalizado</option>
          </select>
        </div>
      </div>

      {/* Dashboard Mini Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Total de OS</h3>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
             <TrendingUp className="w-3 h-3 text-green-500" /> 
             <span>No período selecionado</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
             <div className={cn(
               "p-1.5 rounded-lg",
               stats.taxaErro > 15 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
             )}>
                <AlertCircle className="w-4 h-4" />
             </div>
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Taxa de Repetição</h3>
          </div>
          <p className={cn(
            "text-2xl font-black",
            stats.taxaErro > 15 ? "text-red-600" : "text-green-600"
          )}>{stats.taxaErro.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-500">Média ideal: abaixo de 8%</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <PieChart className="w-5 h-5 text-slate-600" />
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Responsabilidade</h3>
          </div>
          <div className="flex flex-col gap-1">
             <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-blue-600">CLÍNICA</span>
                <span>{stats.repeticoesClinica}</span>
             </div>
             <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-red-600">LABORATÓRIO</span>
                <span>{stats.repeticoesLab}</span>
             </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Total a Pagar</h3>
          </div>
          <p className="text-2xl font-black text-white">{formatCurrency(stats.totalValor)}</p>
          <p className="text-[10px] text-slate-400 font-medium">Considerando apenas OS novas e pagas.</p>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
           <h2 className="font-black text-slate-900 flex items-center gap-2">
             <Filter className="w-4 h-4 text-blue-600" />
             OS Detalhadas no Período
           </h2>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 border-b border-slate-100 first:rounded-tl-2xl">Status / OS</th>
                <th className="px-6 py-4 border-b border-slate-100">Paciente</th>
                <th className="px-6 py-4 border-b border-slate-100">Laboratório</th>
                <th className="px-6 py-4 border-b border-slate-100">Qualidade</th>
                <th className="px-6 py-4 border-b border-slate-100 text-right last:rounded-tr-2xl">Custo Serviço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                   <td colSpan={5} className="py-20 text-center">
                     <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" />
                   </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                   <td colSpan={5} className="py-20 text-center text-slate-400 italic font-bold">
                     Nenhum dado encontrado para este filtro.
                   </td>
                </tr>
              ) : services.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900">{s.referencia_os}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">{s.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{(s.patient as any)?.nome}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{(s.supplier as any)?.nome}</td>
                  <td className="px-6 py-4">
                    {s.is_repeticao ? (
                      <div className="flex flex-col">
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black w-fit mb-1">REPETIÇÃO</span>
                        <span className="text-[9px] text-slate-400 italic">ÔNUS: {s.onus_repeticao}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-black w-fit">OK (1ª VIA)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">
                    {formatCurrency(s.valor_servico)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
