import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, UserRole, ProfilePermissions } from '@/types';

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

function normalizeUser(user: any): User | null {
  if (!user) return null;
  
  // If no perfil, return as is (role check should handle it)
  if (!user.perfil) return user as User;

  const permissions = user.perfil.permissions || {};
  const normalizedPermissions = { ...INITIAL_PERMISSIONS };
  
  Object.keys(normalizedPermissions).forEach(key => {
    const moduleKey = key as keyof ProfilePermissions;
    if (permissions[moduleKey]) {
      normalizedPermissions[moduleKey] = {
        ...normalizedPermissions[moduleKey],
        ...permissions[moduleKey]
      };
    }
  });

  return {
    ...user,
    perfil: {
      ...user.perfil,
      permissions: normalizedPermissions
    }
  } as User;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there is a mock session in local storage first
    const mockUserItem = localStorage.getItem('clinstockpro_mock_user');
    if (mockUserItem) {
      try {
        const mockUser = JSON.parse(mockUserItem);
        setUser(normalizeUser(mockUser));
        setLoading(false);
      } catch (e) {
        localStorage.removeItem('clinstockpro_mock_user');
      }
    }

    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        // Only set loading to false if we don't have a mock user running
        if (!localStorage.getItem('clinstockpro_mock_user')) {
          setLoading(false);
        }
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        // Only reset user if we are NOT using a mock user session
        if (!localStorage.getItem('clinstockpro_mock_user')) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string) {
    console.log('🔍 Buscando perfil para o usuário:', userId);
    try {
      // Usamos .select() sem .single() para evitar o erro 406 de cabeçalho Accept
      // Buscamos em 'users' (minúsculo) que é o padrão correto
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*, perfil:Perfil(*)')
        .eq('id', userId);

      if (!usersError && usersData && usersData.length > 0) {
        console.log('✅ Perfil encontrado na tabela "users"');
        setUser(normalizeUser(usersData[0]));
        return;
      }

      if (usersError) console.warn('⚠️ Erro ao buscar na tabela "users":', usersError.message);

      // Se falhou ou não encontrou, tentamos 'User' (Maiúsculo)
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('*, perfil:Perfil(*)')
        .eq('id', userId);

      if (!userError && userData && userData.length > 0) {
        console.log('✅ Perfil encontrado na tabela "User"');
        setUser(normalizeUser(userData[0]));
        return;
      }

      if (userError) console.warn('⚠️ Erro ao buscar na tabela "User":', userError.message);

      // Se o usuário existe no Auth mas não tem registro na tabela 'users', criamos um perfil padrão
      console.log('ℹ️ Usuário autenticado mas sem perfil no banco. Tentando criar perfil padrão...');
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser.user) {
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .upsert([{
            id: authUser.user.id,
            name: authUser.user.user_metadata.name || authUser.user.email?.split('@')[0] || 'Novo Usuário',
            email: authUser.user.email,
            role: 'ADMINISTRADOR' // Primeiro usuário costuma ser admin
          }], { onConflict: 'id' })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Erro ao criar perfil inicial:', insertError.message);
          if (insertError.message.includes('users_role_check')) {
            console.error('Dica: O banco de dados não aceita o cargo "ADMINISTRADOR". Verifique as restrições da tabela.');
          }
        }

        if (!insertError && newUser) {
          console.log('✅ Perfil inicial criado com sucesso');
          fetchUserProfile(newUser.id);
          return;
        }
      }

      // Se chegou aqui, o usuário existe no Auth mas não tem registro em nenhuma tabela
      if (usersError || userError) {
        console.error('❌ Erro ao buscar perfil:', usersError || userError);
        console.info('Dica: Verifique se você executou o comando "NOTIFY pgrst, \'reload schema\';" no SQL Editor do Supabase.');
      } else {
        console.warn('⚠️ Usuário logado, mas nenhum registro encontrado nas tabelas "users" ou "User" para o ID:', userId);
      }
      
    } catch (error) {
      console.error('Erro inesperado no AuthContext:', error);
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    localStorage.removeItem('clinstockpro_mock_user');
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
