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
  Tags,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Category } from '@/types';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ nome: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Category')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      if (data) setCategories(data);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setSelectedCategory(category);
      setFormData({ nome: category.nome });
    } else {
      setSelectedCategory(null);
      setFormData({ nome: '' });
    }
    setIsModalOpen(true);
  };

  const handleExportExcel = () => {
    const dataToExport = categories.map(cat => ({
      'ID': cat.id,
      'Nome': cat.nome
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
    XLSX.writeFile(wb, 'categorias_materiais.xlsx');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Verificar se já existe uma categoria com este nome (case-insensitive)
      const { data: existingCat, error: checkError } = await supabase
        .from('Category')
        .select('id, nome')
        .ilike('nome', formData.nome.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingCat && (!selectedCategory || existingCat.id !== selectedCategory.id)) {
        alert('Já existe uma categoria cadastrada com este nome.');
        setSubmitting(false);
        return;
      }

      if (selectedCategory) {
        const { error } = await supabase
          .from('Category')
          .update({ nome: formData.nome.trim() })
          .eq('id', selectedCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('Category')
          .insert([{ nome: formData.nome.trim() }]);
        if (error) throw error;
      }
      
      await fetchCategories();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error);
      alert('Erro ao salvar categoria: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    setSubmitting(true);
    try {
      // Check if there are materials using this category
      const { count, error: countError } = await supabase
        .from('Material')
        .select('*', { count: 'exact', head: true })
        .eq('categoriaId', selectedCategory.id);

      if (countError) throw countError;

      if (count && count > 0) {
        alert(`Não é possível excluir esta categoria porque existem ${count} material(is) vinculados a ela. Mova os materiais para outra categoria antes de excluir.`);
        setIsConfirmOpen(false);
        return;
      }

      const { error } = await supabase
        .from('Category')
        .delete()
        .eq('id', selectedCategory.id);
      
      if (error) throw error;
      
      await fetchCategories();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir categoria:', error);
      let message = error.message || 'Erro desconhecido';
      
      // Handle Postgres foreign key error if the check above somehow missed it
      if (message.includes('foreign key constraint')) {
        message = 'Esta categoria não pode ser excluída pois está sendo utilizada por outros registros.';
      }
      
      alert('Erro ao excluir categoria: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
          <p className="text-slate-500">Organize seus materiais por grupos lógicos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportExcel}
            className="bg-slate-50 hover:bg-slate-100 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium"
            title="Exportar Categorias"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
          {canCreate && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              Nova Categoria
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
            placeholder="Buscar categoria..."
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
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome da Categoria</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span>Carregando categorias...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>Nenhuma categoria encontrada.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Tags className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-slate-900">{cat.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(cat)} 
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => { setSelectedCategory(cat); setIsConfirmOpen(true); }} 
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
        title={selectedCategory ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Categoria *</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ nome: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex: Descartáveis, Medicamentos, etc."
            />
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
        title="Excluir Categoria"
        message={`Tem certeza que deseja excluir a categoria "${selectedCategory?.nome}"? Esta ação não pode ser desfeita.`}
        variant="danger"
      />
    </div>
  );
}
