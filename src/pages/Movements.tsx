import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Search, 
  Calendar,
  User as UserIcon,
  BookOpen,
  X,
  Save,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
  Layers,
  Minus,
  QrCode,
  CheckCircle2
} from 'lucide-react';
import { Movimentacao, Material, Patient, Course, Supplier } from '@/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import QRScanner from '@/components/QRScanner';
import { useAuth } from '@/contexts/AuthContext';

export default function Movements() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [modalType, setModalType] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movimentacao | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [targetSearch, setTargetSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Batch state
  const [batchItems, setBatchItems] = useState<{ material_id: number; quantidade: number; valor_unitario: number }[]>([
    { material_id: 0, quantidade: 1, valor_unitario: 0 }
  ]);
  const [batchFormData, setBatchFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo_entrada: 'Paciente',
    paciente_ou_curso: '',
    profissional_responsavel: '',
    observacoes: ''
  });
  const [batchMaterials, setBatchMaterials] = useState<Record<number, Material>>({});

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'TODOS' | 'ENTRADA' | 'SAIDA'>('TODOS');
  const [filterMaterialId, setFilterMaterialId] = useState<number | 'TODOS'>('TODOS');

  // Form state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [originType, setOriginType] = useState<'PACIENTE' | 'CURSO' | 'FORNECEDOR'>('FORNECEDOR');
  const [formData, setFormData] = useState<Partial<Movimentacao>>({
    material_id: undefined,
    quantidade: 1,
    valor_unitario: 0,
    valor_total: 0,
    tipo: 'ENTRADA',
    tipo_entrada: 'Compra',
    paciente_ou_curso: '',
    profissional_responsavel: '',
    observacoes: '',
    data: new Date().toISOString().split('T')[0]
  });

  const [showSingleDropdown, setShowSingleDropdown] = useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);

  useEffect(() => {
    fetchMovements();
    fetchLookups();
  }, []);

  useEffect(() => {
    if (isModalOpen || isBatchModalOpen) {
      fetchLookups();
    }
  }, [isModalOpen, isBatchModalOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('#single-target-container')) {
        setShowSingleDropdown(false);
      }
      if (!target.closest('#batch-target-container')) {
        setShowBatchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .toLowerCase();
  }

  function getFilteredTargets(queryStr: string) {
    const list = originType === 'PACIENTE' 
      ? patients 
      : originType === 'CURSO' 
        ? courses 
        : suppliers;
    
    if (!queryStr) return list;
    
    const normalizedQuery = removeAccents(queryStr);
    return list.filter(item => 
      removeAccents(item.nome ?? '').includes(normalizedQuery)
    );
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isModalOpen || isBatchModalOpen) {
        searchMaterials(materialSearch);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [materialSearch, isModalOpen, isBatchModalOpen]);

  async function searchMaterials(search: string) {
    let query = supabase
      .from('Material')
      .select('*, unit:UnitOfMeasure(sigla)')
      .order('nome');
    
    if (search) {
      query = query.or(`nome.ilike.%${search}%,referencia.ilike.%${search}%`);
    }

    const { data } = await query;
    if (data) setMaterials(data);
  }

  async function fetchMovements() {
    setLoading(true);
    // Usando a View v_movimentacoes_detalhes para carregar a lista
    const { data, error } = await supabase
      .from('v_movimentacoes_detalhes')
      .select('*')
      .order('id', { ascending: false });
    
    if (data) setMovements(data as any[]);
    setLoading(false);
  }

  async function fetchLookups() {
    // Helper para buscar todos os registros de uma tabela, contornando o limite de 1000 do Supabase
    const fetchAllFromTable = async (tableName: string) => {
      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('nome')
          .range(from, from + limit - 1);

        if (error) {
          console.error(`Erro ao carregar do banco (${tableName}):`, error);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < limit) {
            keepFetching = false;
          } else {
            from += limit;
          }
        } else {
          keepFetching = false;
        }
      }
      return allData;
    };

    // Helper para buscar todos os materiais (incluindo o join de UnitOfMeasure)
    const fetchAllMaterials = async () => {
      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabase
          .from('Material')
          .select('*, unit:UnitOfMeasure(sigla)')
          .order('nome')
          .range(from, from + limit - 1);

        if (error) {
          console.error('Erro ao carregar Materiais:', error);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < limit) {
            keepFetching = false;
          } else {
            from += limit;
          }
        } else {
          keepFetching = false;
        }
      }
      return allData;
    };

    const [materialsList, patientsList, coursesList, suppliersList] = await Promise.all([
      fetchAllMaterials(),
      fetchAllFromTable('Patient'),
      fetchAllFromTable('Course'),
      fetchAllFromTable('Supplier')
    ]);

    setMaterials(materialsList);
    setPatients(patientsList);
    setCourses(coursesList);
    setSuppliers(suppliersList);
  }

  const handleScan = (code: string) => {
    setIsScannerOpen(false);
    // Find material by reference
    const material = materials.find(m => m.referencia === code);
    if (material) {
      setFormData({ 
        ...formData, 
        material_id: material.id,
        valor_unitario: material.valor_unitario || 0,
        valor_total: (material.preco_venda || 0) * (formData.quantidade || 1)
      });
      setMaterialSearch('');
    } else {
      alert(`Material com código "${code}" não encontrado.`);
    }
  };

  const handleOpenModal = (type: 'ENTRADA' | 'SAIDA', movement?: Movimentacao) => {
    setModalType(type);
    setSelectedMovement(movement || null);
    
    if (movement) {
      setOriginType(movement.tipo_entrada === 'Devolução' ? 'PACIENTE' : 
                    movement.tipo === 'SAIDA' && movement.tipo_entrada === 'Curso' ? 'CURSO' :
                    movement.tipo === 'SAIDA' && movement.tipo_entrada === 'Troca' ? 'FORNECEDOR' : 'FORNECEDOR');
      setFormData({
        material_id: movement.material_id,
        quantidade: movement.quantidade,
        valor_unitario: movement.valor_unitario,
        valor_total: movement.valor_total,
        tipo: movement.tipo,
        tipo_entrada: movement.tipo_entrada,
        paciente_ou_curso: movement.paciente_ou_curso,
        profissional_responsavel: movement.profissional_responsavel,
        observacoes: movement.observacoes,
        data: movement.data
      });
    } else {
      setOriginType(type === 'ENTRADA' ? 'FORNECEDOR' : 'PACIENTE');
      setFormData({
        material_id: materials[0]?.id,
        quantidade: 1,
        valor_unitario: materials[0]?.valor_unitario || 0,
        valor_total: materials[0]?.preco_venda || 0,
        tipo: type,
        tipo_entrada: type === 'ENTRADA' ? 'Compra' : 'Paciente',
        paciente_ou_curso: '',
        profissional_responsavel: '',
        observacoes: '',
        data: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
    setMaterialSearch('');
    setTargetSearch('');
    setFormError(null);
    setSuccessMsg(null);
  };

  const handleOpenBatchModal = () => {
    const firstMat = materials[0];
    setBatchItems([{ material_id: firstMat?.id || 0, quantidade: 1, valor_unitario: firstMat?.valor_unitario || 0 }]);
    if (firstMat) {
      setBatchMaterials({ [firstMat.id]: firstMat });
    }
    setBatchFormData({
      data: new Date().toISOString().split('T')[0],
      tipo_entrada: 'Paciente',
      paciente_ou_curso: '',
      profissional_responsavel: '',
      observacoes: ''
    });
    setOriginType('PACIENTE');
    setIsBatchModalOpen(true);
    setMaterialSearch('');
    setTargetSearch('');
    setFormError(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const material = materials.find(m => m.id === formData.material_id);
      if (!material) throw new Error('Material não encontrado');

      // 1. Calculate stock adjustment
      let stockAdjustment = 0;
      const currentQty = formData.quantidade || 0;

      if (selectedMovement) {
        // Reverse old movement
        const oldQty = selectedMovement.quantidade;
        const oldType = selectedMovement.tipo;
        
        // If material changed, we need to adjust two materials (complex, let's assume material doesn't change for now or handle it)
        if (selectedMovement.material_id !== formData.material_id) {
          // Revert old material stock
          const oldMaterial = materials.find(m => m.id === selectedMovement.material_id);
          if (oldMaterial) {
            const revertQty = oldType === 'ENTRADA' ? -oldQty : oldQty;
            await supabase.from('Material').update({ estoque_atual: oldMaterial.estoque_atual + revertQty }).eq('id', oldMaterial.id);
          }
          // New material starts from current stock
          stockAdjustment = modalType === 'ENTRADA' ? currentQty : -currentQty;
        } else {
          // Same material, calculate diff
          const oldEffect = oldType === 'ENTRADA' ? oldQty : -oldQty;
          const newEffect = modalType === 'ENTRADA' ? currentQty : -currentQty;
          stockAdjustment = newEffect - oldEffect;
        }
      } else {
        // New movement
        stockAdjustment = modalType === 'ENTRADA' ? currentQty : -currentQty;
      }

      // Validate stock for exits (including adjustments)
      if (material.estoque_atual + stockAdjustment < 0) {
        setFormError('Estoque Insuficiente');
        setIsSaving(false);
        return;
      }

      setFormError(null);

      const valor_unitario = formData.valor_unitario || 0;
      const valor_total = (material.preco_venda || 0) * (formData.quantidade || 0);

      // 2. Save movement
      if (selectedMovement) {
        const { error: movError } = await supabase
          .from('Movimentacao')
          .update({
            ...formData,
            valor_unitario,
            valor_total
          })
          .eq('id', selectedMovement.id);
        if (movError) throw movError;
      } else {
        const { error: movError } = await supabase
          .from('Movimentacao')
          .insert([{
            ...formData,
            valor_unitario,
            valor_total
          }]);
        if (movError) throw movError;
      }
      
      // 3. Update material stock
      const { error: matError } = await supabase
        .from('Material')
        .update({ estoque_atual: material.estoque_atual + stockAdjustment })
        .eq('id', material.id);
      
      if (matError) throw matError;

      setSuccessMsg('Salvo com sucesso!');
      setIsSaving(false);

      // Fetch updates non-blockingly
      fetchMovements().catch(err => console.error("Error fetching movements:", err));
      fetchLookups().catch(err => console.error("Error fetching lookups:", err));

      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg(null);
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao salvar movimentação:', error);
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    try {
      // 1. Validate all items
      for (const item of batchItems) {
        if (!item.material_id) throw new Error('Selecione um material para todos os itens.');
        const material = materials.find(m => m.id === item.material_id);
        if (!material) throw new Error('Material não encontrado.');
        if (material.estoque_atual - item.quantidade < 0) {
          throw new Error(`Estoque insuficiente para o material: ${material.nome}`);
        }
      }

      if (!batchFormData.paciente_ou_curso) throw new Error('Selecione um destino (Paciente/Curso/Fornecedor).');

      // 2. Process each item
      for (const item of batchItems) {
        const material = materials.find(m => m.id === item.material_id)!;
        const valor_total = (material.preco_venda || 0) * item.quantidade;

        // Save movement
        const { error: movError } = await supabase
          .from('Movimentacao')
          .insert([{
            ...batchFormData,
            material_id: item.material_id,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total,
            tipo: 'SAIDA'
          }]);
        if (movError) throw movError;

        // Update stock
        const { error: matError } = await supabase
          .from('Material')
          .update({ estoque_atual: material.estoque_atual - item.quantidade })
          .eq('id', material.id);
        if (matError) throw matError;
      }

      setSuccessMsg('Saída em Lote salva com sucesso!');
      setIsSaving(false);

      // Fetch updates in the background
      fetchMovements().catch(err => console.error("Error fetching movements:", err));
      fetchLookups().catch(err => console.error("Error fetching lookups:", err));

      setTimeout(() => {
        setIsBatchModalOpen(false);
        setSuccessMsg(null);
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao salvar saída em lote:', error);
      setFormError(error.message || 'Erro desconhecido ao salvar lote');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMovement) return;
    setIsSaving(true);

    try {
      const material = materials.find(m => m.id === selectedMovement.material_id);
      if (material) {
        // Reverse stock
        const revertQty = selectedMovement.tipo === 'ENTRADA' ? -selectedMovement.quantidade : selectedMovement.quantidade;
        
        if (material.estoque_atual + revertQty < 0) {
          alert('Não é possível excluir esta movimentação pois o estoque ficaria negativo.');
          setIsSaving(false);
          return;
        }

        await supabase.from('Material').update({ estoque_atual: material.estoque_atual + revertQty }).eq('id', material.id);
      }

      const { error } = await supabase.from('Movimentacao').delete().eq('id', selectedMovement.id);
      if (error) throw error;

      await fetchMovements();
      await fetchLookups();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir movimentação:', error);
      alert('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMovements = movements.filter(mov => {
    const dateMatch = (!startDate || mov.data >= startDate) && (!endDate || mov.data <= endDate);
    const typeMatch = filterType === 'TODOS' || mov.tipo === filterType;
    const materialMatch = filterMaterialId === 'TODOS' || mov.material_id === filterMaterialId;
    return dateMatch && typeMatch && materialMatch;
  });

  // Permissions
  const permissions = user?.perfil?.permissions?.movimentacoes;
  const canCreate = user?.role === 'ADMINISTRADOR' || permissions?.criar;
  const canEdit = user?.role === 'ADMINISTRADOR' || permissions?.editar;
  const canDelete = user?.role === 'ADMINISTRADOR' || permissions?.excluir;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Movimentações</h1>
          <p className="text-slate-500">Histórico de entradas e saídas do estoque.</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <button 
                onClick={() => handleOpenModal('ENTRADA')}
                translate="no"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all"
              >
                <Plus className="w-5 h-5" />
                Registrar Entrada
              </button>
              <button 
                onClick={() => handleOpenModal('SAIDA')}
                translate="no"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-red-200 transition-all"
              >
                <Plus className="w-5 h-5" />
                Registrar Saída
              </button>
              <button 
                onClick={handleOpenBatchModal}
                translate="no"
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-slate-200 transition-all"
              >
                <Layers className="w-5 h-5" />
                Saída em Lote
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
          <Search className="w-5 h-5 text-blue-600" />
          <h2>Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Material</label>
            <select
              value={filterMaterialId}
              onChange={(e) => setFilterMaterialId(e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="TODOS">Todos os Materiais</option>
              {materials.map(mat => (
                <option key={mat.id} value={mat.id}>{mat.nome}</option>
              ))}
            </select>
          </div>
        </div>
        {(startDate || endDate || filterType !== 'TODOS' || filterMaterialId !== 'TODOS') && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setFilterType('TODOS');
                setFilterMaterialId('TODOS');
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Qtd</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino/Origem</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Carregando histórico...</td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Nenhuma movimentação encontrada com os filtros aplicados.</td>
                </tr>
              ) : filteredMovements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{formatDate(mov.data)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      translate="no"
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        mov.tipo === 'ENTRADA' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {mov.tipo === 'ENTRADA' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {mov.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{(mov as any).material_nome}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-bold text-slate-900">{mov.quantidade} {(mov as any).unidade_sigla}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {mov.tipo === 'SAIDA' ? <UserIcon className="w-4 h-4 text-slate-400" /> : <BookOpen className="w-4 h-4 text-slate-400" />}
                      <span className="text-sm text-slate-600">{(mov as any).destino_origem || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900">{formatCurrency(mov.valor_total)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenModal(mov.tipo as any, mov)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            setSelectedMovement(mov);
                            setIsConfirmOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry/Exit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedMovement ? (modalType === 'ENTRADA' ? 'Editar Entrada' : 'Editar Saída') : (modalType === 'ENTRADA' ? 'Registrar Entrada' : 'Registrar Saída')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold">{successMsg}</p>
            </div>
          )}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{formError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
              <input
                required
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Material */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Material *</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou bipar código..."
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // If search matches exactly one reference, select it
                          const matching = materials.filter(m => m.referencia === materialSearch || m.nome.toLowerCase().includes(materialSearch.toLowerCase()));
                          if (matching.length === 1) {
                            const mat = matching[0];
                            setFormData({ 
                              ...formData, 
                              material_id: mat.id,
                              valor_unitario: mat.valor_unitario || 0,
                              valor_total: (mat.preco_venda || 0) * (formData.quantidade || 1)
                            });
                            setMaterialSearch('');
                          }
                        }
                      }}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-200"
                    title="Escanear Código"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
                <select
                  required
                  value={formData.material_id ?? ''}
                  onChange={(e) => {
                    const matId = Number(e.target.value);
                    const mat = materials.find(m => m.id === matId);
                    setFormData({ 
                      ...formData, 
                      material_id: matId,
                      valor_unitario: mat?.valor_unitario || 0,
                      valor_total: (mat?.preco_venda || 0) * (formData.quantidade || 1)
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione um material...</option>
                  {materials
                    .map(mat => (
                      <option key={mat.id} value={mat.id}>
                        {mat.nome} {mat.referencia ? `(${mat.referencia})` : ''} - Estoque: {mat.estoque_atual} {mat.unit?.sigla}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade *</label>
              <input
                required
                type="number"
                min="1"
                value={formData.quantidade}
                onChange={(e) => {
                  const qty = Number(e.target.value);
                  const mat = materials.find(m => m.id === formData.material_id);
                  setFormData({ 
                    ...formData, 
                    quantidade: qty,
                    valor_total: (mat?.preco_venda || 0) * qty
                  });
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Valor Unitário */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_unitario}
                onChange={(e) => {
                  const price = Number(e.target.value);
                  const mat = materials.find(m => m.id === formData.material_id);
                  setFormData({ 
                    ...formData, 
                    valor_unitario: price,
                    valor_total: (mat?.preco_venda || 0) * (formData.quantidade || 1)
                  });
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Tipo de Entrada/Saída */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {modalType === 'ENTRADA' ? 'Tipo de Entrada *' : 'Tipo de Saída *'}
              </label>
              <select
                required
                value={formData.tipo_entrada ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, tipo_entrada: val, paciente_ou_curso: '' });
                  if (modalType === 'ENTRADA') {
                    if (val === 'Devolução') {
                      setOriginType('PACIENTE');
                    } else {
                      setOriginType('FORNECEDOR');
                    }
                  } else {
                    // SAIDA
                    if (val === 'Paciente') {
                      setOriginType('PACIENTE');
                    } else if (val === 'Curso') {
                      setOriginType('CURSO');
                    } else if (val === 'Troca') {
                      setOriginType('FORNECEDOR');
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {modalType === 'ENTRADA' ? (
                  <>
                    <option value="Compra">Compra</option>
                    <option value="Reposição por Troca">Reposição por Troca</option>
                    <option value="Devolução">Devolução</option>
                  </>
                ) : (
                  <>
                    <option value="Paciente">Paciente</option>
                    <option value="Curso">Curso</option>
                    <option value="Troca">Troca</option>
                  </>
                )}
              </select>
            </div>

            {/* Origin Selection for Devolução (ENTRADA) */}
            {modalType === 'ENTRADA' && formData.tipo_entrada === 'Devolução' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Origem da Devolução *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="originType" 
                      checked={originType === 'PACIENTE'} 
                      onChange={() => {
                        setOriginType('PACIENTE');
                        setFormData({ ...formData, paciente_ou_curso: '' });
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">Paciente</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="originType" 
                      checked={originType === 'CURSO'} 
                      onChange={() => {
                        setOriginType('CURSO');
                        setFormData({ ...formData, paciente_ou_curso: '' });
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">Curso/Turma</span>
                  </label>
                </div>
              </div>
            )}

            {/* Destino/Origem */}
            <div className="md:col-span-2" id="single-target-container">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {modalType === 'SAIDA' 
                  ? formData.tipo_entrada === 'Paciente' ? 'Paciente (Destino) *' : 
                    formData.tipo_entrada === 'Curso' ? 'Curso/Turma (Destino) *' : 'Fornecedor (Troca) *'
                  : formData.tipo_entrada === 'Devolução'
                    ? originType === 'PACIENTE' ? 'Paciente (Devolução) *' : 'Curso/Turma (Devolução) *'
                    : 'Fornecedor (Troca/Compra) *'}
              </label>
              
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-400 w-4 h-4" />
                <input
                  required
                  type="text"
                  placeholder={`Buscar ${originType.toLowerCase()}...`}
                  value={formData.paciente_ou_curso ?? ''}
                  onFocus={() => setShowSingleDropdown(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, paciente_ou_curso: val });
                    setTargetSearch(val);
                    setShowSingleDropdown(true);
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {formData.paciente_ou_curso && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, paciente_ou_curso: '' });
                      setTargetSearch('');
                    }}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {showSingleDropdown && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {getFilteredTargets(formData.paciente_ou_curso ?? '').length === 0 ? (
                      <div className="px-4 py-2 text-xs text-slate-500 italic">
                        Nenhum resultado encontrado
                      </div>
                    ) : (
                      getFilteredTargets(formData.paciente_ou_curso ?? '')
                        .slice(0, 1000)
                        .map((item) => (
                          <button
                            key={`single-opt-${item.id}`}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 focus:bg-slate-50 outline-none transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setFormData({ ...formData, paciente_ou_curso: item.nome });
                              setShowSingleDropdown(false);
                            }}
                          >
                            {item.nome}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Profissional Responsável */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Profissional Responsável</label>
              <input
                type="text"
                value={formData.profissional_responsavel}
                onChange={(e) => setFormData({ ...formData, profissional_responsavel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
              />
            </div>

            {/* Valor Total (Read-only display) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total</label>
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold">
                {formatCurrency(formData.valor_total || 0)}
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold">{successMsg}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                "px-4 py-2 text-white rounded-lg flex items-center gap-2 shadow-lg transition-all disabled:opacity-50",
                modalType === 'ENTRADA' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"
              )}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {selectedMovement ? 'Salvar Alterações' : `Confirmar ${modalType === 'ENTRADA' ? 'Entrada' : 'Saída'}`}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Movimentação"
        message="Tem certeza que deseja excluir esta movimentação? O estoque do material será ajustado automaticamente."
        confirmText="Excluir"
        variant="danger"
        loading={isSaving}
      />

      {isScannerOpen && (
        <QRScanner 
          onScan={handleScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Batch Output Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="Saída em Lote"
        size="xl"
      >
        <form onSubmit={handleSaveBatch} className="space-y-6">
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold">{successMsg}</p>
            </div>
          )}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{formError}</p>
            </div>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
              <input
                required
                type="date"
                value={batchFormData.data}
                onChange={(e) => setBatchFormData({ ...batchFormData, data: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Saída *</label>
              <select
                required
                value={batchFormData.tipo_entrada}
                onChange={(e) => {
                  const val = e.target.value;
                  setBatchFormData({ ...batchFormData, tipo_entrada: val, paciente_ou_curso: '' });
                  if (val === 'Paciente') setOriginType('PACIENTE');
                  else if (val === 'Curso') setOriginType('CURSO');
                  else if (val === 'Troca') setOriginType('FORNECEDOR');
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="Paciente">Paciente</option>
                <option value="Curso">Curso</option>
                <option value="Troca">Troca</option>
              </select>
            </div>
            <div id="batch-target-container" className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Destino *</label>
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-400 w-4 h-4" />
                <input
                  required
                  type="text"
                  placeholder={`Buscar ${originType.toLowerCase()}...`}
                  value={batchFormData.paciente_ou_curso}
                  onFocus={() => setShowBatchDropdown(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBatchFormData({ ...batchFormData, paciente_ou_curso: val });
                    setTargetSearch(val);
                    setShowBatchDropdown(true);
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {batchFormData.paciente_ou_curso && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchFormData({ ...batchFormData, paciente_ou_curso: '' });
                      setTargetSearch('');
                    }}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {showBatchDropdown && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {getFilteredTargets(batchFormData.paciente_ou_curso).length === 0 ? (
                      <div className="px-4 py-2 text-xs text-slate-500 italic">
                        Nenhum resultado encontrado
                      </div>
                    ) : (
                      getFilteredTargets(batchFormData.paciente_ou_curso)
                        .slice(0, 1000)
                        .map((item) => (
                          <button
                            key={`batch-opt-${item.id}`}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 focus:bg-slate-50 outline-none transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setBatchFormData({ ...batchFormData, paciente_ou_curso: item.nome });
                              setShowBatchDropdown(false);
                            }}
                          >
                            {item.nome}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Profissional Responsável</label>
              <input
                type="text"
                value={batchFormData.profissional_responsavel}
                onChange={(e) => setBatchFormData({ ...batchFormData, profissional_responsavel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Itens da Saída</h3>
              <button
                type="button"
                onClick={() => {
                  const firstMat = materials[0];
                  if (firstMat) {
                    setBatchMaterials(prev => ({ ...prev, [firstMat.id]: firstMat }));
                  }
                  setBatchItems([...batchItems, { material_id: firstMat?.id || 0, quantidade: 1, valor_unitario: firstMat?.valor_unitario || 0 }]);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {batchItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <div className="md:col-span-6">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Material</label>
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                        <input
                          type="text"
                          placeholder="Filtrar material..."
                          className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-blue-500 outline-none"
                          onChange={(e) => setMaterialSearch(e.target.value)}
                        />
                      </div>
                      <select
                        required
                        value={item.material_id}
                        onChange={(e) => {
                          const newItems = [...batchItems];
                          const matId = Number(e.target.value);
                          const mat = materials.find(m => m.id === matId);
                          if (mat) {
                            setBatchMaterials(prev => ({ ...prev, [matId]: mat }));
                          }
                          newItems[index] = { 
                            ...item, 
                            material_id: matId,
                            valor_unitario: mat?.valor_unitario || 0
                          };
                          setBatchItems(newItems);
                        }}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        {(() => {
                          // Combine current search results with the selected material for this row
                          const options = [...materials];
                          if (item.material_id && !options.find(m => m.id === item.material_id)) {
                            const cached = batchMaterials[item.material_id];
                            if (cached) options.push(cached);
                          }
                          return options.sort((a, b) => a.nome.localeCompare(b.nome)).map(mat => (
                            <option key={`batch-mat-${index}-${mat.id}`} value={mat.id}>
                              {mat.nome} {mat.referencia ? `(${mat.referencia})` : ''} - Est: {mat.estoque_atual}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qtd</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) => {
                        const newItems = [...batchItems];
                        newItems[index].quantidade = Number(e.target.value);
                        setBatchItems(newItems);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">V. Unit</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={item.valor_unitario}
                      onChange={(e) => {
                        const newItems = [...batchItems];
                        newItems[index].valor_unitario = Number(e.target.value);
                        setBatchItems(newItems);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      disabled={batchItems.length === 1}
                      onClick={() => setBatchItems(batchItems.filter((_, i) => i !== index))}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações Gerais</label>
            <textarea
              value={batchFormData.observacoes}
              onChange={(e) => setBatchFormData({ ...batchFormData, observacoes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
            />
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold">{successMsg}</p>
            </div>
          )}

          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-slate-600">
              Total de Itens: <span className="font-bold text-slate-900">{batchItems.length}</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-slate-900 hover:bg-black text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-slate-200 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar Saída em Lote
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
