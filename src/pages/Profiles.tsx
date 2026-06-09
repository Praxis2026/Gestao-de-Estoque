import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Save, 
  Loader2, 
  Shield,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Perfil, ProfilePermissions, ModulePermissions } from '@/types';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const INITIAL_PERMISSIONS: ProfilePermissions = {
  dashboard: { visualizar: true, criar: false, editar: false, excluir: false },
  movimentacoes: { visualizar: true, criar: true, editar: true, excluir: true },
  estoque: { visualizar: true, criar: true, editar: true, excluir: true },
  equivalencias: { visualizar: true, criar: true, editar: true, excluir: true },
  pacientes: { visualizar: true, criar: true, editar: true, excluir: true },
  proteses: { visualizar: true, criar: true, editar: true, excluir: true },
  cursos: { visualizar: true, criar: true, editar: true, excluir: true },
  relatorios: { visualizar: true, criar: true, editar: true, excluir: true },
  ageing: { visualizar: true, criar: true, editar: true, excluir: true },
  usuarios: { visualizar: true, criar: true, editar: true, excluir: true },
  configuracoes: { visualizar: true, criar: true, editar: true, excluir: true },
};

const MODULE_LABELS: Record<keyof ProfilePermissions, string> = {
  dashboard: 'Dashboard',
  movimentacoes: 'Movimentações',
  estoque: 'Estoque',
  equivalencias: 'Equivalência de Produtos',
  pacientes: 'Pacientes',
  proteses: 'Serviços Protéticos',
  cursos: 'Cursos',
  relatorios: 'Relatórios de Movimentação/Materiais',
  ageing: 'Relatório de Inatividade (Ageing)',
  usuarios: 'Usuários e Perfis',
  configuracoes: 'Configurações',
};

export default function Profiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Perfil | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Perfil>>({
    nome: '',
    descricao: '',
    status: 'Ativo',
    permissions: INITIAL_PERMISSIONS
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('Perfil')
      .select('*')
      .order('nome');
    
    if (data) setProfiles(data as Perfil[]);
    setLoading(false);
  }

  const handleOpenModal = (profile?: Perfil) => {
    if (profile) {
      setSelectedProfile(profile);
      
      // Normalize permissions to ensure all modules exist
      const normalizedPermissions = { ...INITIAL_PERMISSIONS };
      const profilePermissions = profile.permissions || {};
      
      (Object.keys(normalizedPermissions) as Array<keyof ProfilePermissions>).forEach(key => {
        if (profilePermissions[key]) {
          normalizedPermissions[key] = {
            ...normalizedPermissions[key],
            ...profilePermissions[key]
          };
        }
      });

      setFormData({
        nome: profile.nome,
        descricao: profile.descricao,
        status: profile.status,
        permissions: normalizedPermissions
      });
    } else {
      setSelectedProfile(null);
      setFormData({
        nome: '',
        descricao: '',
        status: 'Ativo',
        permissions: INITIAL_PERMISSIONS
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (selectedProfile) {
        const { error } = await supabase
          .from('Perfil')
          .update(formData)
          .eq('id', selectedProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('Perfil')
          .insert([formData]);
        if (error) throw error;
      }

      await fetchProfiles();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      alert('Erro ao salvar perfil: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProfile) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('Perfil')
        .delete()
        .eq('id', selectedProfile.id);
      
      if (error) throw error;
      await fetchProfiles();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir perfil:', error);
      alert('Erro ao excluir perfil: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (module: keyof ProfilePermissions, action: keyof ModulePermissions) => {
    const currentPermissions = JSON.parse(JSON.stringify(formData.permissions || INITIAL_PERMISSIONS)) as ProfilePermissions;
    if (!currentPermissions[module]) {
      currentPermissions[module] = { ...INITIAL_PERMISSIONS[module] };
    }
    currentPermissions[module][action] = !currentPermissions[module][action];
    setFormData({ ...formData, permissions: currentPermissions });
  };

  const filteredProfiles = profiles.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Permission check
  const permissions = user?.perfil?.permissions?.usuarios;
  const canView = user?.role === 'ADMINISTRADOR' || permissions?.visualizar;
  const canCreate = user?.role === 'ADMINISTRADOR' || permissions?.criar;
  const canEdit = user?.role === 'ADMINISTRADOR' || permissions?.editar;
  const canDelete = user?.role === 'ADMINISTRADOR' || permissions?.excluir;

  if (!canView && !loading) {
    return <Navigate to="/" />;
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Perfis de Acesso</h1>
          <p className="text-slate-500">Gerencie os perfis e permissões dos usuários.</p>
        </div>
        {canCreate && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            Novo Perfil
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Perfil</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">Carregando perfis...</td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">Nenhum perfil encontrado.</td>
                </tr>
              ) : filteredProfiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-900">{profile.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{profile.descricao || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      profile.status === 'Ativo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {profile.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(profile)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => {
                            setSelectedProfile(profile);
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
        title={selectedProfile ? 'Editar Perfil' : 'Novo Perfil'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Perfil *</label>
              <input
                required
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: Administrador, Dentista..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Ativo' | 'Inativo' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                placeholder="Descreva as responsabilidades deste perfil..."
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Controle de Permissões por Módulo
            </h3>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Módulo</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Visualizar</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Criar</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Editar</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Excluir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(Object.keys(MODULE_LABELS) as Array<keyof ProfilePermissions>).map((moduleKey) => (
                    <tr key={moduleKey} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {MODULE_LABELS[moduleKey]}
                      </td>
                      {(['visualizar', 'criar', 'editar', 'excluir'] as Array<keyof ModulePermissions>).map((action) => (
                        <td key={action} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => togglePermission(moduleKey, action)}
                            className={cn(
                              "w-6 h-6 rounded-md transition-all inline-flex items-center justify-center",
                              formData.permissions?.[moduleKey]?.[action]
                                ? "bg-blue-100 text-blue-600"
                                : "bg-slate-100 text-slate-300 hover:text-slate-400"
                            )}
                          >
                            {formData.permissions?.[moduleKey]?.[action] ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
              Salvar Perfil
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Perfil"
        message={`Tem certeza que deseja excluir o perfil "${selectedProfile?.nome}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        loading={isSaving}
      />
    </div>
  );
}
