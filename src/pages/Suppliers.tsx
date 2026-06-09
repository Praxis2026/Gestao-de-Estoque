import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save, 
  Truck,
  Filter,
  X,
  AlertCircle
} from 'lucide-react';
import { Supplier } from '@/types';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [nextCode, setNextCode] = useState<number | null>(null);
  const [formData, setFormData] = useState({ nome: '', cnpj: '', contato: '' });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateDocument = (doc: string) => {
    const cleanDoc = doc.replace(/[^\d]/g, '');
    
    if (cleanDoc.length === 0) return null; // No error if empty (handled by required)
    
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      return 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.';
    }

    if (cleanDoc.length === 11) {
      if (!validateCPF(cleanDoc)) return 'CPF inválido.';
    } else {
      if (!validateCNPJ(cleanDoc)) return 'CNPJ inválido.';
    }

    // Check for duplicates
    const duplicate = suppliers.find(s => 
      s.cnpj.replace(/[^\d]/g, '') === cleanDoc && s.id !== selectedSupplier?.id
    );

    if (duplicate) {
      return `Este CPF/CNPJ já está cadastrado para o fornecedor "${duplicate.nome}".`;
    }

    return null;
  };

  useEffect(() => {
    const error = validateDocument(formData.cnpj);
    setValidationError(error);
  }, [formData.cnpj, suppliers, selectedSupplier]);

  function validateCPF(cpf: string) {
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    let r = (s * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    if (r !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    r = (s * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    if (r !== parseInt(cpf[10])) return false;
    return true;
  }

  function validateCNPJ(cnpj: string) {
    if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    let digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
  }

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Supplier')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      if (data) {
        setSuppliers(data);
        // Estimate next code based on current max
        const maxCode = data.reduce((max, s) => Math.max(max, s.codigo || 0), 0);
        setNextCode(maxCode + 1);
      }
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setSelectedSupplier(supplier);
      setFormData({ nome: supplier.nome, cnpj: supplier.cnpj, contato: supplier.contato || '' });
    } else {
      setSelectedSupplier(null);
      setFormData({ nome: '', cnpj: '', contato: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateDocument(formData.cnpj);
    if (error) {
      setValidationError(error);
      return;
    }

    setSubmitting(true);
    try {
      if (selectedSupplier) {
        const { error } = await supabase
          .from('Supplier')
          .update(formData)
          .eq('id', selectedSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('Supplier')
          .insert([formData]);
        if (error) throw error;
      }
      
      await fetchSuppliers();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar fornecedor:', error);
      alert('Erro ao salvar fornecedor: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('Supplier')
        .delete()
        .eq('id', selectedSupplier.id);
      
      if (error) throw error;
      
      await fetchSuppliers();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir fornecedor:', error);
      alert('Erro ao excluir fornecedor: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.cnpj.includes(searchTerm) ||
    s.codigo?.toString().includes(searchTerm)
  );

  // Permissions
  const permissions = user?.perfil?.permissions?.estoque;
  const canCreate = user?.role === 'ADMINISTRADOR' || permissions?.criar;
  const canEdit = user?.role === 'ADMINISTRADOR' || permissions?.editar;
  const canDelete = user?.role === 'ADMINISTRADOR' || permissions?.excluir;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-slate-500">Gerencie seus parceiros de suprimentos e insumos.</p>
        </div>
        {canCreate && (
          <button 
            onClick={() => handleOpenModal()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
          >
            <Plus className="w-5 h-5" /> 
            Novo Fornecedor
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF/CNPJ..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
          />
        </div>
        <button className="px-4 py-2 border border-slate-200 rounded-lg flex items-center gap-2 hover:bg-slate-50 text-slate-600 transition-all">
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 first:rounded-tl-2xl">Código</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Fornecedor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">CPF / CNPJ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Contato</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right last:rounded-tr-2xl">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span>Carregando fornecedores...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>Nenhum fornecedor encontrado.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-500">#{sup.codigo}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Truck className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-slate-900">{sup.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600 font-mono">{sup.cnpj}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{sup.contato || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(sup)} 
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => { setSelectedSupplier(sup); setIsConfirmOpen(true); }} 
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
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

      {/* Modal Form */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {selectedSupplier ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código do Fornecedor</label>
                <input 
                  type="text" 
                  readOnly
                  value={`#${selectedSupplier.codigo}`} 
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed outline-none font-bold" 
                />
              </div>
            ) : nextCode && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código do Fornecedor (Próximo)</label>
                <input 
                  type="text" 
                  readOnly
                  value={`#${nextCode}`} 
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-blue-600 font-bold cursor-not-allowed outline-none" 
                />
                <p className="text-[10px] text-slate-400 mt-1">Este código será atribuído automaticamente pelo sistema.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social *</label>
              <input 
                type="text" 
                required 
                value={formData.nome} 
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: Dental Sorriso Ltda" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF / CNPJ *</label>
              <input 
                type="text" 
                required 
                value={formData.cnpj} 
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} 
                className={cn(
                  "w-full px-4 py-2 bg-slate-50 border rounded-lg focus:ring-2 outline-none transition-all",
                  validationError ? "border-red-300 focus:ring-red-500 bg-red-50" : "border-slate-200 focus:ring-blue-500"
                )} 
                placeholder="000.000.000-00 ou 00.000.000/0000-00" 
              />
              {validationError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {validationError}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contato</label>
              <input 
                type="text" 
                value={formData.contato} 
                onChange={(e) => setFormData({ ...formData, contato: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: (11) 99999-9999 ou Nome do Vendedor" 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-200 hover:bg-blue-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Salvar</>}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={handleDelete} 
        loading={submitting} 
        title="Excluir Fornecedor" 
        message={`Tem certeza que deseja excluir o fornecedor "${selectedSupplier?.nome}"? Esta ação não pode ser desfeita.`} 
        variant="danger"
      />
    </div>
  );
}
