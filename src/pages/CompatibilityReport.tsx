import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Download, 
  Layers, 
  Package,
  TrendingDown,
  TrendingUp,
  Search,
  FileText
} from 'lucide-react';
import { Material, EquivalenceGroup } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CompatibilityReport() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<EquivalenceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: mats, error: matErr } = await supabase
        .from('v_materiais_detalhes')
        .select('*')
        .order('nome');
      
      const { data: grps, error: grpErr } = await supabase
        .from('EquivalenceGroup')
        .select('*')
        .order('nome');

      if (matErr) throw matErr;
      if (grpErr) throw grpErr;

      if (mats) setMaterials(mats as any[]);
      if (grps) setGroups(grps);
    } catch (error) {
      console.error('Erro ao buscar dados do relatório:', error);
    } finally {
      setLoading(false);
    }
  }

  // Organize data: Existing groups only
  const compatibilityGroups = groups.map(group => {
    const items = materials.filter(m => m.equivalence_group_id === group.id);
    const totalStock = items.reduce((sum, item) => sum + item.estoque_atual, 0);
    const minStock = items.reduce((sum, item) => sum + item.estoque_minimo, 0);
    const avgValue = items.length > 0 ? items.reduce((sum, item) => sum + item.valor_unitario, 0) / items.length : 0;
    
    return {
      id: group.id,
      nome: group.nome,
      items,
      totalStock,
      minStock,
      avgValue,
      status: totalStock <= minStock ? 'CRÍTICO' : 'NORMAL',
      isSingle: false
    };
  }).filter(group => 
    group.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.items.some(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || m.referencia?.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  const handleExport = () => {
    const exportData = compatibilityGroups.flatMap(group => 
      group.items.map(item => ({
        'Grupo de Equivalência': group.nome,
        'Estoque Total Grupo': group.totalStock,
        'Status Grupo': group.status,
        'Produto': item.nome,
        'Referência': item.referencia || '',
        'Fornecedor': (item as any).fornecedor_nome,
        'Estoque Atual': item.estoque_atual,
        'Valor Unitário': item.valor_unitario,
        'Valor Total Parcial': item.estoque_atual * item.valor_unitario
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque por Compatibilidade');
    XLSX.writeFile(wb, `relatorio_estoque_compatibilidade_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('pt-BR');
    
    // Title
    doc.setFontSize(18);
    doc.text('Relatório de Estoque por Compatibilidade', 14, 20);
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${date}`, 14, 26);

    let startY = 35;

    compatibilityGroups.forEach((group, index) => {
      // Check if we need a new page
      if (startY > 250) {
        doc.addPage();
        startY = 20;
      }

      // Group Header
      doc.setFillColor(241, 245, 249);
      doc.rect(14, startY, 182, 16, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`GRP-${String(group.id).padStart(2, '0')}: ${group.nome}`, 18, startY + 6.5);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Estoque consolid.: ${group.totalStock} UN`, 18, startY + 12.5);
      
      startY += 20;

      const tableData = group.items.map(item => [
        item.referencia || '-',
        item.nome,
        (item as any).fornecedor_nome || '-',
        item.estoque_atual.toString(),
        formatCurrency(item.valor_unitario),
        formatCurrency(item.estoque_atual * item.valor_unitario)
      ]);

      autoTable(doc, {
        startY,
        head: [['REF', 'Produto', 'Fornecedor', 'Estoque', 'V. Unit.', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 60 },
          2: { cellWidth: 35 },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 20, halign: 'right' },
        }
      });

      startY = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save(`relatorio_compatibilidade_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque por Compatibilidade</h1>
          <p className="text-slate-500">Visualização de estoque consolidado por grupos de equivalência.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-slate-200 transition-all font-medium"
          >
            <FileText className="w-5 h-5 text-blue-400" />
            Exportar PDF
          </button>
          <button 
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-green-200 transition-all font-medium"
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por grupo ou produto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : compatibilityGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">Nenhum dado compatível para exibir.</p>
          <p className="text-slate-400 text-sm mt-1">Configure grupos de equivalência para ver o estoque consolidado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {compatibilityGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4" style={{ borderLeftColor: group.status === 'CRÍTICO' ? '#ef4444' : '#10b981' }}>
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full",
                      group.status === 'CRÍTICO' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    )}>
                      {group.status}
                    </span>
                    <span className="text-xs text-blue-700 font-black tracking-tighter bg-blue-50 px-2 py-1 rounded">GRP-{String(group.id).padStart(2, '0')}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    {!group.isSingle && <Layers className="w-5 h-5 text-red-600" />}
                    {group.nome}
                  </h3>
                </div>
                <div className="flex gap-4 md:text-right">
                  <div className="p-3 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Total Disponível no Grupo</p>
                    <p className={cn(
                      "text-xl font-black",
                      group.status === 'CRÍTICO' ? "text-red-600" : "text-blue-600"
                    )}>{group.totalStock} <span className="text-xs font-medium text-slate-400">UN</span></p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Valor Médio</p>
                    <p className="text-xl font-black text-slate-700">{formatCurrency(group.avgValue)}</p>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Referência (REF)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Produto / Fornecedor</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Estoque Atual</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Estoque Mínimo</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Valor Unitário</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Total Parcial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      // Sort items within the group to cluster by similar names
                      const sortedItems = [...group.items].sort((a, b) => {
                        const cleanA = a.nome.toLowerCase().replace(/[^\w\s]/g, '').trim();
                        const cleanB = b.nome.toLowerCase().replace(/[^\w\s]/g, '').trim();
                        if (cleanA < cleanB) return -1;
                        if (cleanA > cleanB) return 1;
                        return (a.referencia || '').localeCompare(b.referencia || '');
                      });

                      return sortedItems.map(m => (
                        <tr key={m.id} className={cn(
                          "hover:bg-slate-50/50 transition-colors",
                          !group.isSingle && "font-bold bg-white"
                        )}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               {!group.isSingle && <span className="text-red-500">🔗</span>}
                               <div className="flex flex-col">
                                 <code className="text-sm text-slate-700 font-mono font-black bg-slate-100 px-2 py-1 rounded">
                                   {m.referencia || '-'}
                                 </code>
                                 {m.equivalence_refs && (
                                   <div className="mt-1 flex flex-wrap gap-1">
                                      {m.equivalence_refs.split(', ').map((ref, idx) => (
                                        <span key={idx} className="text-[10px] text-red-600 font-black uppercase">
                                          (Equiv: {ref})
                                        </span>
                                      ))}
                                   </div>
                                 )}
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-900 leading-tight">{m.nome}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{(m as any).fornecedor_nome}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                               <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.estoque_atual <= m.estoque_minimo ? '#ef4444' : '#10b981' }} />
                               <span className="text-base font-black text-slate-900">{m.estoque_atual}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm text-slate-500 font-bold">{m.estoque_minimo}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm text-slate-500 font-medium">{formatCurrency(m.valor_unitario)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black text-slate-900">{formatCurrency(m.estoque_atual * m.valor_unitario)}</span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  {!group.isSingle && (
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-right border-y-2 border-slate-100">
                           <span className="text-xs font-black text-slate-500 uppercase">Estoque Consolidado do Grupo:</span>
                        </td>
                        <td className="px-6 py-4 text-center border-y-2 border-slate-100 bg-white">
                           <span className={cn(
                             "text-xl font-black",
                             group.status === 'CRÍTICO' ? "text-red-600" : "text-blue-600"
                           )}>{group.totalStock}</span>
                        </td>
                        <td colSpan={3} className="px-6 py-4 border-y-2 border-slate-100"></td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="px-6 py-2">
                          <div className="flex items-center justify-center gap-2">
                             <div className="h-px flex-1 bg-slate-200" />
                             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">FIM DO GRUPO GRP-{String(group.id).padStart(2, '0')}</span>
                             <div className="h-px flex-1 bg-slate-200" />
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                  {group.isSingle && (
                    <tfoot className="bg-slate-50/50">
                      <tr>
                        <td colSpan={6} className="px-6 py-2 text-right italic text-[10px] text-slate-400">
                          Item Único (sem equivalentes cadastrados)
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
