import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertCircle,
  X,
  Save,
  Loader2,
  Download,
  FileUp,
  QrCode,
  Layers,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Material, Category, UnitOfMeasure, Supplier } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import QRScanner from '@/components/QRScanner';
import { useAuth } from '@/contexts/AuthContext';

export default function Materials() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [defaultSalesPercent, setDefaultSalesPercent] = useState<number>(0);
  
  // Equivalence states
  const [equivalenceGroup, setEquivalenceGroup] = useState<{ id: number; nome: string; members: any[] } | null>(null);
  const [loadingEquivalence, setLoadingEquivalence] = useState(false);
  
  // Form state
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState<Partial<Material>>({
    nome: '',
    referencia: '',
    categoriaId: undefined,
    unidadeMedidaId: undefined,
    fornecedorId: undefined,
    estoque_minimo: 0,
    vl_sem_desconto: 0,
    estoque_atual: 0,
    valor_unitario: 0,
    preco_venda: 0,
    tipo_material: 'Próprio',
    estoque_inicial: 0,
    percentual_venda: 0,
    data_entrada: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchLookups();
    fetchDefaultSettings();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchMaterials();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategoryId, selectedType]);

  async function fetchDefaultSettings() {
    const { data } = await supabase
      .from('Setting')
      .select('*')
      .eq('key', 'default_sales_percent')
      .single();
    
    if (data) setDefaultSalesPercent(Number(data.value));
  }

  async function fetchMaterials() {
    setLoading(true);
    try {
      // Usando a View v_materiais_detalhes que já contém joins resolvidos
      let query = supabase
        .from('v_materiais_detalhes')
        .select('*')
        .order('nome');

      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,referencia.ilike.%${searchTerm}%`);
      }

      if (selectedCategoryId !== 'all') {
        query = query.eq('categoriaId', selectedCategoryId);
      }

      if (selectedType !== 'all') {
        query = query.eq('tipo_material', selectedType);
      }

      // No initial state limit to show full list of materials

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setMaterials(data as any[]);
    } catch (error) {
      console.error('Erro ao buscar materiais:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLookups() {
    const [catRes, unitRes, supRes] = await Promise.all([
      supabase.from('Category').select('*').order('nome'),
      supabase.from('UnitOfMeasure').select('*').order('nome'),
      supabase.from('Supplier').select('*').order('nome')
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (unitRes.data) setUnits(unitRes.data);
    if (supRes.data) setSuppliers(supRes.data);
  }

  const handleOpenModal = (material?: Material) => {
    if (material) {
      setSelectedMaterial(material);
      setFormData({
        nome: material.nome,
        referencia: material.referencia,
        categoriaId: material.categoriaId,
        unidadeMedidaId: material.unidadeMedidaId,
        fornecedorId: material.fornecedorId,
        estoque_minimo: material.estoque_minimo,
        vl_sem_desconto: material.vl_sem_desconto || 0,
        estoque_atual: material.estoque_atual,
        valor_unitario: material.valor_unitario,
        preco_venda: material.preco_venda,
        tipo_material: material.tipo_material,
        estoque_inicial: material.estoque_inicial,
        percentual_venda: material.percentual_venda,
        localizacao_fisica: material.localizacao_fisica,
        data_entrada: material.data_entrada || new Date().toISOString().split('T')[0]
      });
    } else {
      setSelectedMaterial(null);
      setFormData({
        nome: '',
        referencia: '',
        categoriaId: categories[0]?.id,
        unidadeMedidaId: units[0]?.id,
        fornecedorId: suppliers[0]?.id,
        estoque_minimo: 0,
        vl_sem_desconto: 0,
        estoque_atual: 0,
        valor_unitario: 0,
        preco_venda: 0,
        tipo_material: 'Próprio',
        estoque_inicial: 0,
        percentual_venda: defaultSalesPercent,
        data_entrada: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const dataToSave = { ...formData };
      
      // Validação de referência única por fornecedor
      if (dataToSave.referencia && dataToSave.fornecedorId) {
        let checkQuery = supabase
          .from('Material')
          .select('id')
          .eq('referencia', dataToSave.referencia)
          .eq('fornecedorId', dataToSave.fornecedorId);
        
        if (selectedMaterial) {
          checkQuery = checkQuery.neq('id', selectedMaterial.id);
        }

        const { data: existingRef } = await checkQuery.maybeSingle();
        
        if (existingRef) {
          alert('Este código de referência já está cadastrado para este fornecedor.');
          setIsSaving(false);
          return;
        }
      }

      if (selectedMaterial) {
        const { error } = await supabase
          .from('Material')
          .update(dataToSave)
          .eq('id', selectedMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('Material')
          .insert([dataToSave]);
        if (error) throw error;
      }
      
      alert('Salvo com sucesso!');
      await fetchMaterials();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar material:', error);
      const errorMsg = error.message || error.details || 'Erro desconhecido';
      alert('Erro ao salvar material: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMaterial) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('Material')
        .delete()
        .eq('id', selectedMaterial.id);
      
      if (error) throw error;
      await fetchMaterials();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir material:', error);
      alert('Erro ao excluir material: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'Nome': 'Luva de Procedimento M',
        'Referência': '7891234567890',
        'Categoria': 'Consumíveis',
        'Unidade': 'Caixa',
        'Sigla Unidade': 'CX',
        'Fornecedor': 'Distribuidora XYZ',
        'Estoque Inicial': 50,
        'Estoque Mínimo': 10,
        'Valor sem Desconto': 50.00,
        'Valor Unitário': 45.90,
        'Percentual Venda': 60,
        'Preço Venda': 73.44,
        'Tipo': 'Próprio',
        'Data Entrada': new Date().toISOString().split('T')[0],
        'Localização': 'Armário 02 - Prateleira B'
      },
      {
        'Nome': 'Clorexidina 2%',
        'Referência': '123456789',
        'Categoria': 'Soluções',
        'Unidade': 'Frasco',
        'Sigla Unidade': 'FR',
        'Fornecedor': 'Farma Med',
        'Estoque Inicial': 20,
        'Estoque Mínimo': 5,
        'Valor sem Desconto': 20.00,
        'Valor Unitário': 15.00,
        'Percentual Venda': 80,
        'Preço Venda': 27.00,
        'Tipo': 'Consignado',
        'Data Entrada': new Date().toISOString().split('T')[0],
        'Localização': 'Setor de Esterilização'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    
    // Set column widths
    const wscols = [
      {wch: 30}, {wch: 15}, {wch: 20}, {wch: 10}, {wch: 10}, 
      {wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, 
      {wch: 15}, {wch: 15}, {wch: 15}, {wch: 30}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Importação');
    XLSX.writeFile(wb, 'template_importacao_materiais.xlsx');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert('O arquivo está vazio.');
          setIsImporting(false);
          return;
        }

        // Fetch fresh lookups and existing materials to verify increments
        const [catRes, unitRes, supRes, matRes] = await Promise.all([
          supabase.from('Category').select('*'),
          supabase.from('UnitOfMeasure').select('*'),
          supabase.from('Supplier').select('*'),
          supabase.from('Material').select('*')
        ]);

        let currentCategories = catRes.data || [];
        let currentUnits = unitRes.data || [];
        let currentSuppliers = supRes.data || [];
        const existingMaterials = matRes.data || [];

        const finalMaterialsMap = new Map();
        let createdCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          const nome = row['Nome'] || row['nome'];
          if (!nome) continue;

          const ref = String(row['Referência'] || row['referencia'] || '').trim();
          const cleanNome = String(nome).trim();
          const key = `${cleanNome.toLowerCase()}|${ref.toLowerCase()}`;

          // Find or create Category
          const rowCategory = row['Categoria'] || row['categoria'];
          let catId = currentCategories.find(c => c.nome.toLowerCase() === (rowCategory || '').toLowerCase())?.id;
          
          if (!catId && rowCategory) {
            const { data: newCat, error: catErr } = await supabase
              .from('Category')
              .insert({ nome: rowCategory })
              .select()
              .single();
            
            if (!catErr && newCat) {
              catId = newCat.id;
              currentCategories.push(newCat);
            }
          }

          // Find or create Unit
          const rowUnit = row['Unidade'] || row['unidade'];
          let unitId = currentUnits.find(u => u.nome.toLowerCase() === (rowUnit || '').toLowerCase())?.id;
          
          if (!unitId && rowUnit) {
            const { data: newUnit, error: unitErr } = await supabase
              .from('UnitOfMeasure')
              .insert({ 
                nome: rowUnit, 
                sigla: row['Sigla Unidade'] || row['sigla'] || 'UN' 
              })
              .select()
              .single();
            
            if (!unitErr && newUnit) {
              unitId = newUnit.id;
              currentUnits.push(newUnit);
            }
          }

          // Find or create Supplier
          const rowSupplier = row['Fornecedor'] || row['fornecedor'];
          let supId = currentSuppliers.find(s => s.nome.toLowerCase() === (rowSupplier || '').toLowerCase())?.id;
          
          if (!supId && rowSupplier) {
            const { data: newSup, error: supErr } = await supabase
              .from('Supplier')
              .insert({ 
                nome: rowSupplier,
                cnpj: '00.000.000/0000-00'
              })
              .select()
              .single();
            
            if (!supErr && newSup) {
              supId = newSup.id;
              currentSuppliers.push(newSup);
            }
          }

          const vSemDesc = Number(row['Valor sem Desconto'] || row['vl_sem_desconto'] || 0);
          const vUnit = Number(row['Valor Unitário'] || row['valor_unitario'] || row['Preço Custo'] || 0);
          const pVenda = Number(row['Percentual Venda'] || row['percentual_venda'] || 0);
          const precoVenda = row['Preço Venda'] || row['preco_venda'] 
            ? Number(row['Preço Venda'] || row['preco_venda']) 
            : vUnit * (pVenda / 100 + 1);
          const addedStock = Number(row['Estoque Inicial'] || row['estoque_inicial'] || 0);

          if (!finalMaterialsMap.has(key)) {
            const existing = existingMaterials.find(m => 
              m.nome.toLowerCase().trim() === cleanNome.toLowerCase() && 
              (m.referencia || '').toLowerCase().trim() === ref.toLowerCase()
            );

            if (existing) {
              finalMaterialsMap.set(key, {
                id: existing.id,
                nome: existing.nome,
                referencia: existing.referencia,
                categoriaId: catId || existing.categoriaId,
                unidadeMedidaId: unitId || existing.unidadeMedidaId,
                fornecedorId: supId || existing.fornecedorId,
                estoque_atual: Number(existing.estoque_atual || 0),
                estoque_inicial: Number(existing.estoque_inicial || 0),
                estoque_minimo: Number(existing.estoque_minimo || 0),
                vl_sem_desconto: Number(existing.vl_sem_desconto || 0),
                valor_unitario: Number(existing.valor_unitario || 0),
                percentual_venda: Number(existing.percentual_venda || 0),
                preco_venda: Number(existing.preco_venda || 0),
                tipo_material: existing.tipo_material,
                data_entrada: existing.data_entrada,
                localizacao_fisica: existing.localizacao_fisica,
                isNew: false
              });
              updatedCount++;
            } else {
              finalMaterialsMap.set(key, {
                nome: cleanNome,
                referencia: ref,
                categoriaId: catId || currentCategories[0]?.id,
                unidadeMedidaId: unitId || currentUnits[0]?.id,
                fornecedorId: supId || currentSuppliers[0]?.id,
                estoque_atual: 0,
                estoque_inicial: 0,
                estoque_minimo: Number(row['Estoque Mínimo'] || row['estoque_minimo'] || 0),
                vl_sem_desconto: vSemDesc,
                valor_unitario: vUnit,
                percentual_venda: pVenda,
                preco_venda: precoVenda,
                tipo_material: row['Tipo'] || row['tipo'] || 'Próprio',
                data_entrada: row['Data Entrada'] || row['data_entrada'] || new Date().toISOString().split('T')[0],
                localizacao_fisica: row['Localização'] || row['localizacao'] || '',
                isNew: true
              });
              createdCount++;
            }
          }

          const item = finalMaterialsMap.get(key);
          item.estoque_atual += addedStock;
          item.estoque_inicial += addedStock;
          // Update other fields if provided and valid
          if (vSemDesc > 0) item.vl_sem_desconto = vSemDesc;
          if (vUnit > 0) item.valor_unitario = vUnit;
          if (pVenda > 0) item.percentual_venda = pVenda;
          if (precoVenda > 0) item.preco_venda = precoVenda;
        }

        const toUpsert = Array.from(finalMaterialsMap.values()).map(({ isNew, ...rest }) => rest);

        if (toUpsert.length > 0) {
          const { error } = await supabase.from('Material').upsert(toUpsert);
          if (error) throw error;
          
          // Update lookups state globally
          setCategories(currentCategories);
          setUnits(currentUnits);
          setSuppliers(currentSuppliers);
          
          alert(`Sucesso! Processamento concluído: ${createdCount} novos materiais inseridos e ${updatedCount} materiais existentes atualizados com acréscimo de estoque.`);
          await fetchMaterials();
        } else {
          alert('Nenhum material válido foi encontrado no arquivo para importação.');
        }

      } catch (error: any) {
        console.error('Erro na importação:', error);
        alert('Erro ao importar arquivo: ' + (error.message || 'Verifique o formato dos dados.'));
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleShowEquivalence = async (groupId: number, groupName: string) => {
    setLoadingEquivalence(true);
    setEquivalenceGroup({ id: groupId, nome: groupName, members: [] });
    try {
      const { data, error } = await supabase
        .from('v_materiais_detalhes')
        .select('*')
        .eq('equivalence_group_id', groupId)
        .order('nome');
      
      if (error) throw error;
      setEquivalenceGroup({ id: groupId, nome: groupName, members: data || [] });
    } catch (error) {
      console.error('Erro ao buscar equivalências:', error);
    } finally {
      setLoadingEquivalence(false);
    }
  };

  const filteredMaterials = materials;

  // Permissions
  const permissions = user?.perfil?.permissions?.estoque;
  const isAdmin = user?.role === 'ADMINISTRADOR' || user?.perfil?.nome?.toLowerCase().includes('admin');
  const canCreate = isAdmin || permissions?.criar;
  const canEdit = isAdmin || permissions?.editar;
  const canDelete = isAdmin || permissions?.excluir;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Materiais</h1>
          <p className="text-slate-500">Gerencie o catálogo de produtos e insumos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button 
                onClick={handleDownloadTemplate}
                className="bg-slate-50 hover:bg-slate-100 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium"
                title="Baixar modelo de planilha para importação"
              >
                <Download className="w-5 h-5" />
                Template Importação
              </button>
              <label className="bg-slate-50 hover:bg-slate-100 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium cursor-pointer" title="Fazer upload da planilha preenchida">
                {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
                Upload de Materiais
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleImportExcel}
                  disabled={isImporting}
                />
              </label>
            </>
          )}
          {canCreate && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              Novo Material
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome ou referência..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-2">
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[150px]"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[150px]"
          >
            <option value="all">Todos os Tipos</option>
            <option value="Próprio">Próprio</option>
            <option value="Consignado">Consignado</option>
            <option value="Doação">Doação</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Referência</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Estoque Atual</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor c/Desc.</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Preço Venda</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">Carregando materiais...</td>
                </tr>
              ) : filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">Nenhum material encontrado.</td>
                </tr>
              ) : filteredMaterials.map((material) => (
                <tr key={material.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{material.nome}</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {(material as any).fornecedor_nome || 'S/F'}
                      </span>
                    </div>
                  </td>
                      <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-900 font-mono font-bold">{material.referencia || '-'}</span>
                      {material.equivalence_refs && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {material.equivalence_refs.split(', ').map((ref, idx) => (
                            <span key={idx} className="text-[10px] text-red-600 font-black whitespace-nowrap bg-red-50 px-1 py-0.5 rounded border border-red-100">
                              (Equiv: {ref})
                            </span>
                          ))}
                        </div>
                      )}
                      {(material as any).equivalence_group_id && (
                        <div className="mt-2 flex flex-col gap-1">
                           <button 
                             onClick={() => handleShowEquivalence((material as any).equivalence_group_id, (material as any).equivalence_group_name || `Grupo ${(material as any).equivalence_group_id}`)}
                             className="text-[9px] text-blue-700 font-black uppercase flex items-center gap-1 bg-blue-50 w-fit px-1.5 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors cursor-help"
                             title="Clique para ver equivalências"
                           >
                             <Layers className="w-2.5 h-2.5" /> 
                             GRP-{String((material as any).equivalence_group_id).padStart(2, '0')}
                           </button>
                           <span className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-1 bg-slate-100 w-fit px-1.5 py-0.5 rounded">
                             <TrendingUp className="w-2.5 h-2.5 text-green-600" />
                             Consolidado: <span className="text-green-700">{(material as any).group_total_stock || 0} UN</span>
                           </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                      {(material as any).categoria_nome || 'Geral'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-full",
                      material.tipo_material === 'Próprio' ? "bg-blue-50 text-blue-700" :
                      material.tipo_material === 'Consignado' ? "bg-amber-50 text-amber-700" :
                      "bg-purple-50 text-purple-700"
                    )}>
                      {material.tipo_material}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "font-bold",
                        material.estoque_atual <= material.estoque_minimo ? "text-red-600" : "text-slate-900"
                      )}>
                        {material.estoque_atual} {(material as any).unidade_sigla || 'UN'}
                      </span>
                      {material.estoque_atual <= material.estoque_minimo && (
                        <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Crítico
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{formatCurrency(material.valor_unitario)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{formatCurrency(material.preco_venda)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(material)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => {
                            setSelectedMaterial(material);
                            setIsConfirmOpen(true);
                          }}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
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

      {/* Modal Form */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={selectedMaterial ? 'Editar Material' : 'Novo Material'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Material *</label>
              <input
                required
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Referência</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.referencia}
                  onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Código de barras..."
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-200"
                  title="Escanear Código"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria *</label>
              <select
                required
                value={formData.categoriaId ?? ''}
                onChange={(e) => setFormData({ ...formData, categoriaId: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidade *</label>
              <select
                required
                value={formData.unidadeMedidaId ?? ''}
                onChange={(e) => setFormData({ ...formData, unidadeMedidaId: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.nome} ({unit.sigla})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
              <select
                required
                value={formData.fornecedorId ?? ''}
                onChange={(e) => setFormData({ ...formData, fornecedorId: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                required
                value={formData.tipo_material ?? ''}
                onChange={(e) => setFormData({ ...formData, tipo_material: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Próprio">Próprio</option>
                <option value="Consignado">Consignado</option>
                <option value="Doação">Doação</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrada *</label>
              <input
                required
                type="date"
                value={formData.data_entrada}
                onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Atual</label>
              <input
                type="number"
                value={formData.estoque_atual}
                onChange={(e) => setFormData({ ...formData, estoque_atual: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo</label>
              <input
                type="number"
                value={formData.estoque_minimo}
                onChange={(e) => setFormData({ ...formData, estoque_minimo: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor sem Desconto (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vl_sem_desconto}
                  onChange={(e) => setFormData({ ...formData, vl_sem_desconto: Number(e.target.value) })}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor c/Desconto (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const perc = formData.percentual_venda || 0;
                    setFormData({ 
                      ...formData, 
                      valor_unitario: val,
                      preco_venda: val * (perc / 100 + 1)
                    });
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Percentual de Venda (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={formData.percentual_venda}
                  onChange={(e) => {
                    const perc = Number(e.target.value);
                    const val = formData.valor_unitario || 0;
                    setFormData({ 
                      ...formData, 
                      percentual_venda: perc,
                      preco_venda: val * (perc / 100 + 1)
                    });
                  }}
                  className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preço Venda (R$)</label>
              <input
                type="text"
                readOnly
                value={formatCurrency(formData.preco_venda || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-bold outline-none cursor-not-allowed"
                title="Calculado automaticamente: Valor Unitário * (Percentual / 100 + 1)"
              />
            </div>
          </div>

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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Material
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Material"
        message={`Tem certeza que deseja excluir o material "${selectedMaterial?.nome}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        loading={isSaving}
      />

      {isScannerOpen && (
        <QRScanner 
          onScan={(code) => {
            setFormData({ ...formData, referencia: code });
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Equivalence Details Modal */}
      <Modal
        isOpen={!!equivalenceGroup}
        onClose={() => setEquivalenceGroup(null)}
        title={`Equivalências - ${equivalenceGroup?.nome}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Materiais associados a este grupo de equivalência:</p>
          
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {loadingEquivalence ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : equivalenceGroup?.members.map(member => (
              <div key={member.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-slate-900">{member.nome}</h4>
                    <p className="text-xs text-slate-500 uppercase font-medium">{member.fornecedor_nome}</p>
                  </div>
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                    member.estoque_atual <= member.estoque_minimo ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {member.estoque_atual} {member.unidade_sigla}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Referência</span>
                    <span className="font-mono">{member.referencia || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Preço Venda</span>
                    <span className="font-bold text-slate-900">{formatCurrency(member.preco_venda)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => setEquivalenceGroup(null)}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all mt-4"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </div>
  );
}
