import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Save, 
  Loader2, 
  User as UserIcon,
  Mail,
  Lock,
  Shield,
  UserCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { User, Perfil, UserRole } from '@/types';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'OPERADOR', label: 'Operador' },
  { value: 'VISUALIZADOR', label: 'Visualizador' },
  { value: 'ADMINISTRADOR', label: 'Administrador' },
];

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'OPERADOR' as UserRole,
    perfil_id: undefined as number | undefined,
    isTestMode: false
  });

  useEffect(() => {
    fetchUsers();
    fetchProfiles();

    // Set up real-time listener for both users tables
    const channel = supabase.channel('users_changes');
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'User' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      // 1. Fetch profiles first to map them later
      const { data: profilesData } = await supabase
        .from('Perfil')
        .select('id, nome');
      
      const profileMap = new Map(profilesData?.map(p => [p.id, p.nome]) || []);

      // 2. Fetch from 'users' table (without join to avoid schema cache errors)
      const { data: usersPlural, error: errorPlural } = await supabase
        .from('users')
        .select('*')
        .order('name');
      
      // 3. Fetch from 'User' table (fallback)
      const { data: usersSingular, error: errorSingular } = await supabase
        .from('User')
        .select('*')
        .order('name');

      if (errorPlural && errorSingular) {
        throw new Error(errorPlural.message || errorSingular.message);
      }

      // Merge and remove duplicates by ID
      const allUsersRaw = [...(usersPlural || []), ...(usersSingular || [])];
      const uniqueUsersRaw = Array.from(new Map(allUsersRaw.map(u => [u.id, u])).values());
      
      // 4. Map profile names manually
      const uniqueUsers = uniqueUsersRaw.map(u => ({
        ...u,
        perfil: u.perfil_id ? { nome: profileMap.get(u.perfil_id) || 'Perfil não encontrado' } : null
      }));
      
      setUsers(uniqueUsers as any[]);
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      setMessage({ type: 'error', text: `Erro ao buscar usuários: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('Perfil')
      .select('*')
      .eq('status', 'Ativo')
      .order('nome');
    
    if (data) setProfiles(data as Perfil[]);
  }

  const handleOpenModal = (user?: User) => {
    setMessage(null);
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '', // Don't show password on edit
        role: user.role,
        perfil_id: user.perfil_id,
        isTestMode: false
      });
    } else {
      setSelectedUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'OPERADOR',
        perfil_id: profiles[0]?.id,
        isTestMode: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const trimmedEmail = formData.email.trim().toLowerCase();

    try {
      // Check if email already exists in both users tables
      const [resPlural, resSingular] = await Promise.all([
        supabase.from('users').select('id, name').eq('email', trimmedEmail).maybeSingle(),
        supabase.from('User').select('id, name').eq('email', trimmedEmail).maybeSingle()
      ]);

      const existingUser = resPlural.data || resSingular.data;

      // If email exists and it's not the user we are currently editing
      if (existingUser && (!selectedUser || existingUser.id !== selectedUser.id)) {
        throw new Error(`Usuário já cadastrado`);
      }

      if (selectedUser) {
        // Try updating in both tables
        const [resPlural, resSingular] = await Promise.all([
          supabase
            .from('users')
            .update({
              name: formData.name,
              email: trimmedEmail,
              role: formData.role,
              perfil_id: formData.perfil_id
            })
            .eq('id', selectedUser.id),
          supabase
            .from('User')
            .update({
              name: formData.name,
              email: trimmedEmail,
              role: formData.role,
              perfil_id: formData.perfil_id
            })
            .eq('id', selectedUser.id)
        ]);
        
        if (resPlural.error && resSingular.error) {
          throw new Error(resPlural.error.message || resSingular.error.message);
        }

        // Update password if provided
        if (formData.password && formData.password.length >= 6) {
          // Note: In Supabase, you can't easily update another user's password from the client
          // without using the Admin Auth API (service_role key).
          // For this applet, we'll inform the user if they try to update another user's password.
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser.user?.id === selectedUser.id) {
            const { error: pwdError } = await supabase.auth.updateUser({
              password: formData.password
            });
            if (pwdError) throw pwdError;
          } else {
            console.warn('Password update skipped: Client-side password updates are only allowed for the currently logged-in user in Supabase.');
            // We don't throw here to allow other profile changes to persist
          }
        }
      } else if (formData.isTestMode) {
        // Create a "Mock" user in the users table without Auth
        const mockId = crypto.randomUUID();
        const testUserObj = {
          id: mockId,
          name: formData.name,
          email: trimmedEmail,
          role: formData.role,
          perfil_id: formData.perfil_id,
          perfil: formData.perfil_id && profiles.find(p => p.id === formData.perfil_id) ? {
            id: formData.perfil_id,
            nome: profiles.find(p => p.id === formData.perfil_id)?.nome || 'Perfil de Teste'
          } : undefined
        };

        // Also save to local storage as fallback for anon users who can't read 'users' table
        try {
          const storedLocalUsers = JSON.parse(localStorage.getItem('clinstockpro_local_test_users') || '[]');
          storedLocalUsers.push(testUserObj);
          localStorage.setItem('clinstockpro_local_test_users', JSON.stringify(storedLocalUsers));
        } catch (e) {
          console.error('Erro ao salvar usuário de teste localmente:', e);
        }

        const { error: dbError } = await supabase
          .from('users')
          .insert([{
            id: mockId,
            name: formData.name,
            email: trimmedEmail,
            role: formData.role,
            perfil_id: formData.perfil_id
          }]);
        
        if (dbError) {
          if (dbError.message.includes('foreign key')) {
            throw new Error(`Erro de chave estrangeira. Por favor, execute o script "remove_auth_constraint.sql" no seu painel do Supabase para permitir usuários de teste.`);
          }
          throw dbError;
        }
      } else {
        // In a real Supabase app, creating a user with a password from the client
        // usually requires supabase.auth.signUp, which logs the current user out.
        // For this applet, we will create the record in the 'users' table.
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              full_name: formData.name, // Added for compatibility with some triggers
              role: formData.role,
              perfil_id: formData.perfil_id // Also pass this in metadata
            }
          }
        });

        if (authError) {
          // Se o erro for de e-mail inválido, pode ser que o domínio esteja sendo bloqueado
          // ou haja algum caractere invisível. Tentamos tratar de forma amigável.
          if (authError.message.includes('invalid') && authError.message.includes('Email')) {
            throw new Error(`O e-mail "${trimmedEmail}" foi rejeitado pelo sistema de autenticação. Verifique se há espaços ou caracteres especiais.`);
          }
          
          // Tratamento para limite de taxa (rate limit)
          if (authError.message.includes('rate limit exceeded')) {
            throw new Error(`Limite de taxa do Supabase atingido. Para criar usuários rapidamente, use o "Modo de Teste" abaixo ou aumente o limite em: Authentication > Settings > Rate Limits no seu painel do Supabase.`);
          }
          
          throw authError;
        }

        if (authData.user) {
          // Use upsert instead of insert to handle cases where a database trigger 
          // might have already created the profile record.
          const { error: dbError } = await supabase
            .from('users')
            .upsert([{
              id: authData.user.id,
              name: formData.name,
              email: trimmedEmail,
              role: formData.role,
              perfil_id: formData.perfil_id
            }], { onConflict: 'id' });
          
          if (dbError) {
            console.error('Detailed DB Error:', dbError);
            throw dbError;
          }
        }
      }

      await fetchUsers();
      setMessage({ type: 'success', text: 'Usuário salvo com sucesso!' });
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (error: any) {
      console.error('Erro detalhado ao salvar usuário:', error);
      let errorMessage = error.message || 'Erro ao salvar usuário';
      
      // Handle specific Supabase error objects
      if (error.details) {
        console.error('Error Details:', error.details);
        errorMessage = `${errorMessage} (${error.details})`;
      }
      if (error.hint) {
        console.error('Error Hint:', error.hint);
      }
      
      if (errorMessage.includes('users_role_check')) {
        errorMessage = 'Erro de permissão: O cargo selecionado não é aceito pelo banco de dados. Por favor, execute o script "fix_role_constraint.sql" no seu painel do Supabase.';
      } else if (errorMessage.includes('foreign key')) {
        errorMessage = 'Erro de integridade: O perfil selecionado não foi encontrado ou há um problema de vínculo no banco de dados.';
      } else if (errorMessage === 'Database error saving new user') {
        errorMessage = 'Erro interno do Supabase (Database error saving new user). Isso geralmente indica que um "Trigger" (Gatilho) no seu banco de dados falhou. Por favor, execute o script "fix_auth_trigger.sql" no seu SQL Editor do Supabase para corrigir isso.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setIsSaving(true);

    try {
      // Try deleting from both tables
      const [resPlural, resSingular] = await Promise.all([
        supabase.from('users').delete().eq('id', selectedUser.id),
        supabase.from('User').delete().eq('id', selectedUser.id)
      ]);
      
      if (resPlural.error && resSingular.error) {
        throw new Error(resPlural.error.message || resSingular.error.message);
      }
      
      await fetchUsers();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      alert('Erro ao excluir usuário: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Permission check
  const permissions = currentUser?.perfil?.permissions?.usuarios;
  const canView = currentUser?.role === 'ADMINISTRADOR' || permissions?.visualizar;
  const canCreate = currentUser?.role === 'ADMINISTRADOR' || permissions?.criar;
  const canEdit = currentUser?.role === 'ADMINISTRADOR' || permissions?.editar;
  const canDelete = currentUser?.role === 'ADMINISTRADOR' || permissions?.excluir;

  if (!canView && !loading) {
    return <Navigate to="/" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-slate-500">Gerencie os usuários do sistema e seus acessos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchUsers()}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Atualizar lista"
          >
            <Loader2 className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
          {canCreate && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              Novo Usuário
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
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
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Perfil de Acesso</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">Carregando usuários...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{user.name}</span>
                        <span className="text-xs text-slate-500">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                      {(user as any).perfil?.nome || 'Sem Perfil'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(user)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
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
        title={selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={cn(
                "p-3 rounded-lg text-sm font-medium",
                message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
              )}
            >
              {message.text}
            </motion.div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nome do usuário"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">e-mail *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {selectedUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                required={!selectedUser}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={selectedUser ? "Digite para alterar" : "Mínimo 6 caracteres"}
                minLength={6}
              />
            </div>
            {!selectedUser && (
              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Nota: Criar um novo usuário irá desconectar sua sessão atual.
              </p>
            )}
            {selectedUser && (
              <p className="text-[10px] text-slate-500 mt-1">
                Nota: Por segurança, você só pode alterar sua própria senha.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso *</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <select
                required
                value={formData.perfil_id ?? ''}
                onChange={(e) => setFormData({ ...formData, perfil_id: Number(e.target.value) })}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
              >
                <option value="">Selecione um perfil...</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedUser && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <input
                type="checkbox"
                id="isTestMode"
                checked={formData.isTestMode}
                onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isTestMode" className="text-xs text-blue-700 cursor-pointer">
                <strong>Modo de Teste (Pular Autenticação)</strong>
                <p className="mt-1">Cria o registro apenas no banco de dados, ignorando os limites de taxa do Supabase Auth. Útil para demonstrações.</p>
              </label>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {selectedUser ? 'Atualizar Usuário' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Usuário"
        message={`Tem certeza que deseja excluir o usuário "${selectedUser?.name}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        loading={isSaving}
      />
    </div>
  );
}
