import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Trash2, 
  Save,
  Loader2,
  Package,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  XCircle,
  PlusCircle
} from 'lucide-react';
import { Material, EquivalenceGroup, Category } from '@/types';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';

export default function Equivalences() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<EquivalenceGroup[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<EquivalenceGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Interactive Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardCategoryId, setWizardCategoryId] = useState<number | null>(null);
  const [wizardMainId, setWizardMainId] = useState<number | null>(null);
  const [wizardEquivIds, setWizardEquivIds] = useState<number[]>([]);
  const [wizardLeftSearch, setWizardLeftSearch] = useState('');
  const [wizardRightSearch, setWizardRightSearch] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [groupsRes, materialsRes, categoriesRes] = await Promise.all([
        supabase.from('EquivalenceGroup').select('*').order('nome'),
        supabase.from('v_materiais_detalhes').select('*').order('nome'),
        supabase.from('Category').select('*').order('nome')
      ]);

      if (groupsRes.data) setGroups(groupsRes.data);
      if (materialsRes.data) setMaterials(materialsRes.data as any[]);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!selectedGroup) return;
    setIsSaving(true);
    try {
      // Materials will have their group_id set to null due to ON DELETE SET NULL
      const { error } = await supabase
        .from('EquivalenceGroup')
        .delete()
        .eq('id', selectedGroup.id);
      
      if (error) throw error;
      await fetchInitialData();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      alert('Erro ao excluir: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishWizardGroup = async () => {
    if (!wizardMainId || wizardEquivIds.length === 0) {
      alert('Selecione um item principal e pelo menos um equivalente.');
      return;
    }

    setIsSaving(true);
    try {
      const allIds = [wizardMainId, ...wizardEquivIds];
      const mainMat = materials.find(m => m.id === wizardMainId);
      
      const { data: newGroup, error: groupErr } = await supabase
        .from('EquivalenceGroup')
        .insert({ nome: `Equiv: ${mainMat?.nome || 'Novo Grupo'}` })
        .select()
        .single();
      
      if (groupErr) throw groupErr;

      const { error: matErr } = await supabase
        .from('Material')
        .update({ equivalence_group_id: newGroup.id })
        .in('id', allIds);
      
      if (matErr) throw matErr;

      // Reset for next group but keep category
      setWizardMainId(null);
      setWizardEquivIds([]);
      await fetchInitialData();
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = user?.role === 'ADMINISTRADOR' || user?.perfil?.nome?.toLowerCase().includes('admin');
  const permissions = user?.perfil?.permissions?.equivalencias;
  const canCreate = isAdmin || permissions?.criar;
  const canEdit = isAdmin || permissions?.editar;
  const canDelete = isAdmin || permissions?.excluir;

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 backdrop-blur-sm pb-4 border-b border-slate-100 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equivalência de Produtos</h1>
          <p className="text-slate-500">Agrupe produtos compatíveis de diferentes marcas ou fornecedores.</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
             <button 
               onClick={() => setIsWizardOpen(true)}
               className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-black text-sm"
             >
               <Layers className="w-5 h-5" />
               Wizard de Vinculação
             </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center my-6">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">Nenhuma equivalência cadastrada ainda.</p>
            <p className="text-slate-400 text-sm mt-1">Crie grupos para reunir produtos compatíveis.</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {groups.map(group => {
              const groupMaterials = materials.filter(m => m.equivalence_group_id === group.id);
              return (
                <div key={group.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">{group.nome}</h3>
                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">GRP-{String(group.id).padStart(2, '0')}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {canDelete && (
                        <button 
                          onClick={() => {
                            setSelectedGroup(group);
                            setIsConfirmOpen(true);
                          }}
                          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Excluir grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-6 overflow-x-auto">
                    <div className="flex items-center gap-4 min-w-max">
                      {groupMaterials.map((m, idx) => (
                          <React.Fragment key={m.id}>
                            <div className="flex items-center gap-4 p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-200 transition-all shadow-sm w-[280px]">
                              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                                <Package className="w-6 h-6 text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                    [EQUIV-{String(group.id).padStart(2, '0')}] REF: {m.referencia || '-'}
                                  </span>
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    m.estoque_atual <= m.estoque_minimo ? "bg-red-500 animate-pulse" : "bg-green-500"
                                  )} />
                                </div>
                                <p className="text-sm font-bold text-slate-900 truncate" title={m.nome}>{m.nome}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-[10px] text-slate-400 font-medium truncate uppercase">{(m as any).fornecedor_nome}</p>
                                  <span className="text-xs font-black text-slate-700">{m.estoque_atual} UN</span>
                                </div>
                              </div>
                            </div>
                            
                            {idx < groupMaterials.length - 1 && (
                              <div className="flex flex-col items-center justify-center px-2">
                                 <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shadow-sm">
                                   <span className="text-sm">🔗</span>
                                 </div>
                                 <div className="h-px w-8 bg-blue-100 mt-2" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Grupo de Equivalência"
        message={`Tem certeza que deseja excluir o grupo "${selectedGroup?.nome}"? Os materiais voltarão a não ter equivalência definida.`}
        variant="danger"
        loading={isSaving}
      />

      {/* Interactive Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Wizard de Vinculação (Equivalência Cruzada)"
        size="full"
      >
        <div className="flex flex-col h-[80vh]">
          {/* Header / Category Filter */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Categoria Obrigatória:</span>
              </div>
              <select 
                value={wizardCategoryId || ''}
                onChange={(e) => {
                  setWizardCategoryId(Number(e.target.value) || null);
                  setWizardMainId(null);
                  setWizardEquivIds([]);
                }}
                className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 font-bold text-slate-800"
              >
                <option value="">-- Selecione a Categoria para Listar --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
               <button
                 onClick={handleFinishWizardGroup}
                 disabled={isSaving || !wizardMainId || wizardEquivIds.length === 0}
                 className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-green-100 transition-all font-black text-sm disabled:opacity-50"
               >
                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                 ENCERRAR GRUPO
               </button>
            </div>
          </div>

          {/* Main Wizard Area */}
          <div className="flex-1 overflow-hidden flex divide-x divide-slate-100">
            {/* Left Column: Main Item Selection */}
            <div className="w-1/2 flex flex-col p-6 space-y-4">
               <div className="flex items-center justify-between">
                 <div className="space-y-1">
                   <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">1. Item Principal (Referência Origem)</h4>
                   <p className="text-[10px] text-slate-400">Selecione o produto base para equivalência</p>
                 </div>
                 {wizardMainId && (
                   <button onClick={() => setWizardMainId(null)} className="text-[10px] text-red-500 font-bold hover:underline flex items-center gap-1">
                     <XCircle className="w-3 h-3" /> Limpar
                   </button>
                 )}
               </div>

               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   type="text"
                   placeholder="Buscar por Nome ou REF..."
                   value={wizardLeftSearch}
                   onChange={(e) => setWizardLeftSearch(e.target.value)}
                   className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                 />
               </div>
               
               <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                 {materials
                   .filter(m => (!wizardCategoryId || m.categoriaId === wizardCategoryId))
                   .filter(m => !wizardEquivIds.includes(m.id))
                   .filter(m => 
                     m.nome.toLowerCase().includes(wizardLeftSearch.toLowerCase()) || 
                     (m.referencia || '').toLowerCase().includes(wizardLeftSearch.toLowerCase()) ||
                     ((m as any).categoria_nome || '').toLowerCase().includes(wizardLeftSearch.toLowerCase())
                   )
                   .map(m => {
                     const isSelected = wizardMainId === m.id;
                     const alreadyHasGroup = m.equivalence_group_id !== null;
                     return (
                       <div 
                         key={m.id}
                         onClick={() => !alreadyHasGroup && setWizardMainId(m.id)}
                         className={cn(
                           "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between",
                           isSelected ? "border-blue-600 bg-blue-50 shadow-sm" : "border-slate-100 hover:border-slate-200 bg-white",
                           alreadyHasGroup && !isSelected && "opacity-40 cursor-not-allowed bg-slate-50"
                         )}
                       >
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                             <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">REF: {m.referencia || '-'}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-full">{(m as any).categoria_nome}</span>
                             {alreadyHasGroup && <span className="text-[9px] text-slate-400 font-bold italic uppercase">(Já Vinclulado)</span>}
                           </div>
                           <p className="text-sm font-bold text-slate-900 truncate">{m.nome}</p>
                           <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{(m as any).fornecedor_nome}</p>
                         </div>
                         {isSelected ? <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 ml-4" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0 ml-4" />}
                       </div>
                     );
                   })
                 }
                 {materials.length > 0 && materials.filter(m => (!wizardCategoryId || m.categoriaId === wizardCategoryId)).length === 0 && (
                   <div className="text-center py-12 text-slate-400">Nenhum material nesta categoria.</div>
                 )}
               </div>
            </div>

            {/* Right Column: Equivalents Selection */}
            <div className="w-1/2 flex flex-col p-6 space-y-4 bg-slate-50/30">
               <div className="flex items-center justify-between">
                 <div className="space-y-1">
                   <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">2. Itens Compatíveis (Busca Manual)</h4>
                   <p className="text-[10px] text-slate-400">Busque e selecione materiais equivalentes</p>
                 </div>
                 <div className="flex gap-2">
                   <span className="text-[10px] font-black text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">{wizardEquivIds.length} selecionados</span>
                 </div>
               </div>

               <div className="flex flex-col gap-2">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <input 
                     type="text"
                     placeholder="Buscar por Nome, REF ou Categoria..."
                     value={wizardRightSearch}
                     onChange={(e) => setWizardRightSearch(e.target.value)}
                     className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-100 rounded-xl outline-none focus:border-green-500 transition-all disabled:opacity-50"
                     disabled={!wizardMainId}
                   />
                 </div>
                 
                 {wizardMainId && (
                   <div className="flex items-center gap-2">
                     <Filter className="w-3 h-3 text-slate-400" />
                     <select 
                       value={wizardCategoryId || ''}
                       onChange={(e) => setWizardCategoryId(Number(e.target.value) || null)}
                       className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-green-500"
                     >
                       <option value="">Todas as Categorias</option>
                       {categories.map(c => (
                         <option key={c.id} value={c.id}>{c.nome}</option>
                       ))}
                     </select>
                   </div>
                 )}
               </div>

               {!wizardMainId ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl p-8">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                     <PlusCircle className="w-8 h-8 text-slate-300" />
                   </div>
                   <p className="font-bold text-slate-600">Aguardando Item Principal</p>
                   <p className="text-xs text-slate-400 mt-2 max-w-[240px]">Selecione primeiro o material na coluna da esquerda para habilitar a busca de compatíveis.</p>
                 </div>
               ) : (
                 <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                   {materials
                     .filter(m => (!wizardCategoryId || m.categoriaId === wizardCategoryId))
                     .filter(m => m.id !== wizardMainId)
                     .filter(m => 
                       m.nome.toLowerCase().includes(wizardRightSearch.toLowerCase()) || 
                       (m.referencia || '').toLowerCase().includes(wizardRightSearch.toLowerCase()) ||
                       ((m as any).categoria_nome || '').toLowerCase().includes(wizardRightSearch.toLowerCase())
                     )
                     .map(m => {
                       const isSelected = wizardEquivIds.includes(m.id);
                       const alreadyHasGroup = m.equivalence_group_id !== null;
                       return (
                         <div 
                           key={m.id}
                           onClick={() => !alreadyHasGroup && setWizardEquivIds(prev => isSelected ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                           className={cn(
                             "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between",
                             isSelected ? "border-green-600 bg-green-50 shadow-md transform scale-[1.02]" : "border-slate-100 hover:border-slate-200 bg-white",
                             alreadyHasGroup && !isSelected && "opacity-40 cursor-not-allowed bg-slate-50"
                           )}
                         >
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                               <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">REF: {m.referencia || '-'}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-full">{(m as any).categoria_nome}</span>
                               {alreadyHasGroup && <span className="text-[9px] text-slate-400 font-bold italic uppercase">(Já Vinclulado)</span>}
                             </div>
                             <p className="text-sm font-bold text-slate-900 truncate">{m.nome}</p>
                             <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{(m as any).fornecedor_nome}</p>
                           </div>
                           {isSelected ? (
                             <div className="bg-green-600 p-1 rounded-full shrink-0 ml-4 animate-in zoom-in">
                               <CheckCircle2 className="w-4 h-4 text-white" />
                             </div>
                           ) : (
                             <Plus className="w-5 h-5 text-slate-300 shrink-0 ml-4" />
                           )}
                         </div>
                       );
                     })
                   }
                   {materials.filter(m => (!wizardCategoryId || m.categoriaId === wizardCategoryId) && m.id !== wizardMainId).length === 0 && (
                     <div className="text-center py-12 text-slate-400">Nenhum outro material disponível nesta categoria.</div>
                   )}
                 </div>
               )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
