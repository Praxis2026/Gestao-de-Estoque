import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save,
  Filter,
  AlertCircle,
  Scale
} from 'lucide-react';
import { UnitOfMeasure } from '@/types';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function Units() {
  const { user } = useAuth();
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasure | null>(null);
  const [formData, setFormData] = useState({ nome: '', sigla: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUnits();
  }, []);

  async function fetchUnits() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('UnitOfMeasure')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      if (data) setUnits(data);
    } catch (error) {
      console.error('Erro ao buscar unidades:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (unit?: UnitOfMeasure) => {
    if (unit) {
      setSelectedUnit(unit);
      setFormData({ nome: unit.nome, sigla: unit.sigla });
    } else {
      setSelectedUnit(null);
      setFormData({ nome: '', sigla: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selectedUnit) {
        const { error } = await supabase
          .from('UnitOfMeasure')
          .update(formData)
          .eq('id', selectedUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('UnitOfMeasure')
          .insert([formData]);
        if (error) throw error;
      }
      
      await fetchUnits();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar unidade:', error);
      alert('Erro ao salvar unidade: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('UnitOfMeasure')
        .delete()
        .eq('id', selectedUnit.id);
      
      if (error) throw error;
      
      await fetchUnits();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir unidade:', error);
      alert('Erro ao excluir unidade: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUnits = units.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.sigla.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-slate-900">Unidades de Medida</h1>
          <p className="text-slate-500">Gerencie as unidades usadas para quantificar seus materiais.</p>
        </div>
        {canCreate && (
          <button 
            onClick={() => handleOpenModal()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
          >
            <Plus className="w-5 h-5" /> 
            Nova Unidade
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar unidade ou sigla..."
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome da Unidade</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sigla</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span>Carregando unidades...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>Nenhuma unidade encontrada.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Scale className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-slate-900">{unit.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-slate-200">
                      {unit.sigla}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(unit)} 
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => { setSelectedUnit(unit); setIsConfirmOpen(true); }} 
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
        title={selectedUnit ? 'Editar Unidade' : 'Nova Unidade'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Unidade *</label>
              <input 
                type="text" 
                required 
                value={formData.nome} 
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: Quilograma, Litro, Unidade" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sigla *</label>
              <input 
                type="text" 
                required 
                value={formData.sigla} 
                onChange={(e) => setFormData({ ...formData, sigla: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: KG, L, UN" 
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
        title="Excluir Unidade" 
        message={`Tem certeza que deseja excluir a unidade "${selectedUnit?.nome}"? Esta ação não pode ser desfeita.`} 
        variant="danger"
      />
    </div>
  );
}
