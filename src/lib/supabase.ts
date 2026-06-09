import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Price Tables External Database
const priceTablesUrl = import.meta.env.VITE_PRICE_TABLES_SUPABASE_URL;
const priceTablesKey = import.meta.env.VITE_PRICE_TABLES_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please check your environment variables.');
}

export const realSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export const realPriceTablesSupabase = priceTablesUrl && priceTablesKey 
  ? createClient(priceTablesUrl, priceTablesKey)
  : null;

// Função para verificar se a sessão de Demonstração está ativa
export const isDemoModeActive = (): boolean => {
  return localStorage.getItem('clinstockpro_mock_user') !== null;
};

// Verifica se deve direcionar as queries diretamente para as tabelas do Supabase real
export const isRealDbModeActive = (): boolean => {
  return localStorage.getItem('clinstockpro_use_real_db') === 'true';
};

// --- EMULADOR COMPLETO DB LOCAL POR LOCALSTORAGE PARA MODO DE DEMONSTRAÇÃO ---

export function getDemoDataForTable(tableName: string): any[] {
  const table = tableName.toLowerCase();
  
  if (table === 'perfil') {
    return [
      {
        id: 9999,
        nome: 'Administrador Geral',
        descricao: 'Perfil de demonstração com acesso total ao sistema',
        status: 'Ativo',
        permissions: {
          dashboard: { visualizar: true, criar: true, editar: true, excluir: true },
          movimentacoes: { visualizar: true, criar: true, editar: true, excluir: true },
          estoque: { visualizar: true, criar: true, editar: true, excluir: true },
          equivalencias: { visualizar: true, criar: true, editar: true, excluir: true },
          pacientes: { visualizar: true, criar: true, editar: true, excluir: true },
          proteses: { visualizar: true, criar: true, editar: true, excluir: true },
          cursos: { visualizar: true, criar: true, editar: true, excluir: true },
          relatorios: { visualizar: true, criar: true, editar: true, excluir: true },
          ageing: { visualizar: true, criar: true, editar: true, excluir: true },
          usuarios: { visualizar: true, criar: true, editar: true, excluir: true },
          configuracoes: { visualizar: true, criar: true, editar: true, excluir: true }
        }
      }
    ];
  }
  
  if (table === 'users' || table === 'user') {
    return [
      {
        id: 'demo-admin-id-123456',
        name: 'Administrador de Demonstração',
        email: 'demo@clinstockpro.com.br',
        role: 'ADMINISTRADOR',
        perfil_id: 9999
      }
    ];
  }
  
  if (table === 'category') {
    return [
      { id: 'cat-1', nome: 'Consumo Geral', descricao: 'Materiais diversos de consumo clínico diário' },
      { id: 'cat-2', nome: 'Ortodontia', descricao: 'Bráquetes, fios, elásticos e acessórios' },
      { id: 'cat-3', nome: 'Implantodontia', descricao: 'Implantes, componentes protéticos e instrumentais' },
      { id: 'cat-4', nome: 'Descartáveis', descricao: 'Máscaras, luvas, toucas e babadores' },
      { id: 'cat-5', nome: 'Prótese Laboratorial', descricao: 'Trabalhos de laboratório e modelos de gesso' }
    ];
  }
  
  if (table === 'unitofmeasure') {
    return [
      { id: 'u-1', sigla: 'UN', nome: 'Unidade' },
      { id: 'u-2', sigla: 'CX', nome: 'Caixa' },
      { id: 'u-3', sigla: 'FR', nome: 'Frasco' },
      { id: 'u-4', sigla: 'PCT', nome: 'Pacote' }
    ];
  }
  
  if (table === 'supplier') {
    return [
      { id: 'sup-1', nome: 'Dental Cremer Ltda', cnpj: '14.123.456/0001-89', email: 'contato@cremer.com.br', telefone: '(11) 4003-2222', codigo: 'SUP-001', contato: 'Claudio' },
      { id: 'sup-2', nome: 'Speed Dental Distribuidora', cnpj: '23.987.654/0001-10', email: 'vendas@speeddental.com.br', telefone: '(11) 3214-9876', codigo: 'SUP-002', contato: 'Paula' },
      { id: 'sup-3', nome: 'Surya Dental', cnpj: '08.456.123/0001-44', email: 'surya@suryadental.com.br', telefone: '(44) 3025-9000', codigo: 'SUP-003', contato: 'Eduardo' }
    ];
  }
  
  if (table === 'suppliers') {
    return [
      { id: 'lab-1', nome: 'Laboratório ProEstética', contato: 'Marcos Oliveira', telefone: '(11) 99887-7665', email: 'marcos@proestetica.com' },
      { id: 'lab-2', nome: 'Laboratório ArtDental', contato: 'Silvia Costa', telefone: '(11) 98777-6655', email: 'vendas@artdental.com' }
    ];
  }
  
  if (table === 'price_tables' || table === 'services') {
    return [
      { id: 'srv-1', supplier_id: 'lab-1', name: 'Coroa Metalocerâmica', price: 350.00, value: 350.00 },
      { id: 'srv-2', supplier_id: 'lab-1', name: 'Placa Miorrelaxante', price: 180.00, value: 180.00 },
      { id: 'srv-3', supplier_id: 'lab-2', name: 'Protése Total Monobloco', price: 850.00, value: 850.00 },
      { id: 'srv-4', supplier_id: 'lab-2', name: 'Inlay/Onlay de Porcelana', price: 280.00, value: 280.00 }
    ];
  }
  
  if (table === 'patient') {
    return [
      { id: 'pat-1', nome: 'Carlos Eduardo de Souza Ferreira', email: 'carlosedu@gmail.com', telefone: '(11) 98765-4321', cpf: '123.456.789-00' },
      { id: 'pat-2', nome: 'Mariana Souza Santos', email: 'mari.souza@yahoo.com.br', telefone: '(11) 97654-3210', cpf: '234.567.890-11' },
      { id: 'pat-3', nome: 'Ana Beatris Oliveira', email: 'ana.beatris@outlook.com', telefone: '(21) 98888-7777', cpf: '345.678.901-22' }
    ];
  }
  
  if (table === 'course') {
    return [
      { id: 'cour-1', nome: 'Especialização em Implantodontia - Turma VII', descricao: 'Curso teórico-prático de implantes e prótese sobre implantes' },
      { id: 'cour-2', nome: 'Avançado em Ortodontia com Alinhadores', descricao: 'Uso prático de alinhadores invisíveis e fluxo digital' },
      { id: 'cour-3', nome: 'Imersão em Prótese Dentária Intensiva', descricao: 'Preparos, moldagens e fluxo laboratorial em prótese' }
    ];
  }
  
  if (table === 'material') {
    return [
      { id: 'mat-1', nome: 'Resina Composta Filtek Z350 XT A2', codigo_barras: '7891234567890', estoque_atual: 15, estoque_minimo: 5, valor_unitario: 120.00, categoria_id: 'cat-1', unidade_id: 'u-1', fornecedor_id: 'sup-1', material_vl_sem_desconto: 140.00 },
      { id: 'mat-2', nome: 'Luva de Procedimento Látex Branca P', codigo_barras: '7891234567891', estoque_atual: 8, estoque_minimo: 10, valor_unitario: 35.50, categoria_id: 'cat-4', unidade_id: 'u-2', fornecedor_id: 'sup-2', material_vl_sem_desconto: 42.00 },
      { id: 'mat-3', nome: 'Adesivo Dental Ambar APS 6ml FGM', codigo_barras: '7891234567892', estoque_atual: 4, estoque_minimo: 2, valor_unitario: 98.70, categoria_id: 'cat-1', unidade_id: 'u-3', fornecedor_id: 'sup-1', material_vl_sem_desconto: 110.00 },
      { id: 'mat-4', nome: 'Implante Hexágono Externo Slim 3.5x10mm', codigo_barras: '7891234567893', estoque_atual: 12, estoque_minimo: 3, valor_unitario: 210.00, categoria_id: 'cat-3', unidade_id: 'u-1', fornecedor_id: 'sup-3', material_vl_sem_desconto: 230.00 },
      { id: 'mat-5', nome: 'Babador Descartável Impermeável', codigo_barras: '7891234567894', estoque_atual: 2, estoque_minimo: 5, valor_unitario: 25.00, categoria_id: 'cat-4', unidade_id: 'u-4', fornecedor_id: 'sup-2', material_vl_sem_desconto: 28.00 }
    ];
  }
  
  if (table === 'movimentacao') {
    return [
      { id: 'mov-1', tipo: 'ENTRADA', quantidade: 10, data: '2026-05-24T10:00:00Z', motivo: 'Compra de estoque regular', material_id: 'mat-1', usuario_id: 'demo-admin-id-123456' },
      { id: 'mov-2', tipo: 'ENTRADA', quantidade: 5, data: '2026-05-24T11:30:00Z', motivo: 'Compra de estoque emergencial', material_id: 'mat-3', usuario_id: 'demo-admin-id-123456' },
      { id: 'mov-3', tipo: 'SAIDA', quantidade: 2, data: '2026-05-25T14:15:00Z', motivo: 'Atendimento clínico Dr. Carlos', material_id: 'mat-1', usuario_id: 'demo-admin-id-123456' },
      { id: 'mov-4', tipo: 'SAIDA', quantidade: 4, data: '2026-05-25T15:00:00Z', motivo: 'Pacote utilizado no Curso de Implantodontia', material_id: 'mat-2', usuario_id: 'demo-admin-id-123456' },
      { id: 'mov-5', tipo: 'SAIDA', quantidade: 1, data: '2026-05-26T09:00:00Z', motivo: 'Adesivo vencido descartado', material_id: 'mat-3', usuario_id: 'demo-admin-id-123456' }
    ];
  }
  
  if (table === 'setting') {
    return [
      { id: 'set-1', key: 'logo_url', value: '' },
      { id: 'set-2', key: 'notificacao_estoque_minimo', value: 'true' },
      { id: 'set-3', key: 'moeda', value: 'BRL' },
      { id: 'set-4', key: 'limite_alerta_azul', value: '5' }
    ];
  }
  
  if (table === 'prosthetic_services') {
    return [
      { id: 'ps-1', paciente_id: 'pat-1', fornecedor_id: 'sup-1', material_id: 'mat-5', servico_nome: 'Coroa Metalocerâmica - Elemento 21', status: 'Em laboratório', data_envio: '2026-05-20T08:00:00Z', data_prevista: '2026-05-28T18:00:00Z', valor: 350.00, observacoes: 'Aguardando fundição.' },
      { id: 'ps-2', paciente_id: 'pat-2', fornecedor_id: 'sup-3', material_id: 'mat-5', servico_nome: 'Placa Miorrelaxante de Acrílico', status: 'A iniciar', data_envio: '2026-05-26T10:00:00Z', data_prevista: '2026-06-02T18:00:00Z', valor: 180.00, observacoes: 'Enviar modelo superior e inferior com arco facial.' },
      { id: 'ps-3', paciente_id: 'pat-3', fornecedor_id: 'sup-2', material_id: 'mat-5', servico_nome: 'Prótese Total Superior e Inferior', status: 'Concluído', data_envio: '2026-05-15T09:00:00Z', data_prevista: '2026-05-25T18:00:00Z', valor: 950.00, observacoes: 'Trabalho entregue e aprovado pelo paciente.' }
    ];
  }
  
  return [];
}

export function getTableStore(tableName: string): any[] {
  const key = `clinstockpro_db_${tableName.toLowerCase()}`;
  const localVal = localStorage.getItem(key);
  if (!localVal) {
    const demo = getDemoDataForTable(tableName);
    localStorage.setItem(key, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(localVal);
}

export function saveTableStore(tableName: string, data: any[]): void {
  const key = `clinstockpro_db_${tableName.toLowerCase()}`;
  localStorage.setItem(key, JSON.stringify(data));
}

export function resolveSimulatedJoins(tableName: string, data: any[]): any[] {
  const table = tableName.toLowerCase();
  
  if (table === 'material') {
    return data.map(m => {
      const categories = getTableStore('Category');
      const units = getTableStore('UnitOfMeasure');
      const suppliers = getTableStore('Supplier');
      return {
        ...m,
        category: categories.find((c: any) => c.id === m.categoria_id) || categories[0] || null,
        unit: units.find((u: any) => u.id === m.unidade_id) || units[0] || null,
        fornecedor: suppliers.find((s: any) => s.id === m.fornecedor_id) || suppliers[0] || null,
        supplier: suppliers.find((s: any) => s.id === m.fornecedor_id) || suppliers[0] || null
      };
    });
  }
  
  if (table === 'movimentacao') {
    return data.map(mov => {
      const materials = resolveSimulatedJoins('Material', getTableStore('Material'));
      const users = getTableStore('users');
      return {
        ...mov,
        material: materials.find((m: any) => m.id === mov.material_id) || materials[0] || null,
        usuario: users.find((u: any) => u.id === mov.usuario_id) || users[0] || null,
        User: users.find((u: any) => u.id === mov.usuario_id) || users[0] || null
      };
    });
  }
  
  if (table === 'prosthetic_services') {
    return data.map(ps => {
      const patients = getTableStore('Patient');
      const suppliers = getTableStore('Supplier');
      const materials = getTableStore('Material');
      return {
        ...ps,
        patient: patients.find((p: any) => p.id === ps.paciente_id) || patients[0] || null,
        supplier: suppliers.find((s: any) => s.id === ps.fornecedor_id) || suppliers[0] || null,
        material: materials.find((m: any) => m.id === ps.material_id) || materials[0] || null
      };
    });
  }
  
  if (table === 'users' || table === 'user') {
    return data.map(u => {
      const profiles = getTableStore('Perfil');
      return {
        ...u,
        perfil: profiles.find((p: any) => p.id === u.perfil_id) || profiles[0] || null
      };
    });
  }
  
  return data;
}

class SupabaseQueryBuilder {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderField: string | null = null;
  private orderAscending: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*') {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => {
      return item[column] === value;
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((item) => item[column] > value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((item) => item[column] < value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  like(column: string, pattern: string) {
    const rx = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push((item) => rx.test(item[column]));
    return this;
  }

  ilike(column: string, pattern: string) {
    return this.like(column, pattern);
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: any) {
    try {
      let data = getTableStore(this.tableName);

      // Aplicar filtros
      for (const filter of this.filters) {
        data = data.filter(filter);
      }

      // Ordenar se instruído
      if (this.orderField) {
        data.sort((a, b) => {
          const valA = a[this.orderField!];
          const valB = b[this.orderField!];
          if (valA === undefined || valB === undefined) return 0;
          if (valA < valB) return this.orderAscending ? -1 : 1;
          if (valA > valB) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }

      // Limitar itens se instruído
      if (this.limitCount !== null) {
        data = data.slice(0, this.limitCount);
      }

      // Resolver joins agregados na memória
      data = resolveSimulatedJoins(this.tableName, data);

      if (this.isSingle) {
        resolve({ data: data.length > 0 ? data[0] : null, error: null });
      } else {
        resolve({ data, error: null });
      }
    } catch (e: any) {
      resolve({ data: null, error: { message: e.message } });
    }
  }

  async insert(items: any | any[]) {
    try {
      const db = getTableStore(this.tableName);
      const newItems = Array.isArray(items) ? items : [items];
      
      const savedItems = newItems.map(item => ({
        id: item.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...item
      }));

      db.push(...savedItems);
      saveTableStore(this.tableName, db);
      return { data: savedItems, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }

  async update(updateData: any) {
    try {
      const db = getTableStore(this.tableName);
      let updatedItems: any[] = [];
      const updatedDb = db.map(item => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          const newItem = { ...item, ...updateData, updated_at: new Date().toISOString() };
          updatedItems.push(newItem);
          return newItem;
        }
        return item;
      });

      saveTableStore(this.tableName, updatedDb);
      return { data: updatedItems, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }

  async upsert(items: any | any[], options?: any) {
    try {
      const db = getTableStore(this.tableName);
      const rawInps = Array.isArray(items) ? items : [items];
      const updatedDb = [...db];

      const savedItems = rawInps.map(item => {
        const idToMatch = item.id;
        const index = updatedDb.findIndex(existing => existing.id === idToMatch || (item.key && existing.key === item.key));
        const newItem = {
          id: idToMatch || crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...item
        };

        if (index > -1) {
          updatedDb[index] = { ...updatedDb[index], ...newItem };
        } else {
          updatedDb.push(newItem);
        }
        return newItem;
      });

      saveTableStore(this.tableName, updatedDb);
      return { data: savedItems, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }

  async delete() {
    try {
      const db = getTableStore(this.tableName);
      const itemsToKeep = db.filter(item => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            matches = false;
            break;
          }
        }
        return !matches;
      });

      saveTableStore(this.tableName, itemsToKeep);
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
}

const simulatedAuth = {
  signInWithPassword: async ({ email, password }: any) => {
    const lowercaseEmail = email.trim().toLowerCase();
    const mockUserItem = localStorage.getItem('clinstockpro_mock_user');
    let user = mockUserItem ? JSON.parse(mockUserItem) : null;
    
    if (!user || user.email !== lowercaseEmail) {
      user = {
        id: "demo-admin-id-123456",
        name: email.split('@')[0],
        email: lowercaseEmail,
        role: "ADMINISTRADOR",
        perfil_id: 9999
      };
    }
    
    localStorage.setItem('clinstockpro_mock_user', JSON.stringify(user));
    return { data: { user, session: { user, access_token: "mock-token" } }, error: null };
  },
  signOut: async () => {
    localStorage.removeItem('clinstockpro_mock_user');
    return { error: null };
  },
  signUp: async ({ email, password, options }: any) => {
    const user = {
      id: crypto.randomUUID(),
      name: options?.data?.name || "Usuário de Demonstração",
      email: email.trim().toLowerCase(),
      role: options?.data?.role || "AUXILIAR",
      perfil_id: 9999
    };
    
    const db = getTableStore('users');
    db.push(user);
    saveTableStore('users', db);
    
    return { data: { user }, error: null };
  },
  getSession: async () => {
    const mockUserItem = localStorage.getItem('clinstockpro_mock_user');
    if (mockUserItem) {
      const user = JSON.parse(mockUserItem);
      return { data: { session: { user, access_token: "mock-token" } }, error: null };
    }
    return { data: { session: null }, error: null };
  },
  onAuthStateChange: (callback: any) => {
    setTimeout(() => {
      const mockUserItem = localStorage.getItem('clinstockpro_mock_user');
      if (mockUserItem) {
        const user = JSON.parse(mockUserItem);
        callback('SIGNED_IN', { user, access_token: "mock-token" });
      }
    }, 10);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
  getUser: async () => {
    const mockUserItem = localStorage.getItem('clinstockpro_mock_user');
    if (mockUserItem) {
      const user = JSON.parse(mockUserItem);
      return { data: { user }, error: null };
    }
    return { data: { user: null }, error: null };
  }
};

// Proxies para interceptar chamadas ao Supabase quando em Modo de Demonstração

export const supabase = new Proxy(realSupabase, {
  get(target: any, prop: string, receiver: any) {
    if (isDemoModeActive()) {
      if (prop === 'from') {
        // Se o modo de acesso direto ao banco real estiver ativo, não intercepta consultas a tabelas
        if (isRealDbModeActive()) {
          return Reflect.get(target, prop, receiver);
        }
        return (table: string) => new SupabaseQueryBuilder(table);
      }
      if (prop === 'auth') {
        return simulatedAuth;
      }
    }
    return Reflect.get(target, prop, receiver);
  }
}) as any;

export const priceTablesSupabase = new Proxy(realPriceTablesSupabase || {}, {
  get(target: any, prop: string, receiver: any) {
    if (isDemoModeActive()) {
      if (prop === 'from') {
        // Se o modo de acesso direto ao banco real estiver ativo, não intercepta consultas a tabelas
        if (isRealDbModeActive() && realPriceTablesSupabase) {
          return Reflect.get(target, prop, receiver);
        }
        return (table: string) => new SupabaseQueryBuilder(table);
      }
    }
    return realPriceTablesSupabase ? Reflect.get(target, prop, receiver) : null;
  }
}) as any;

export async function testSupabaseConnection() {
  if (isDemoModeActive() && !isRealDbModeActive()) {
    console.log('✅ Conexão emulada com o Supabase ativa (Modo de Demonstração)');
    return true;
  }
  
  try {
    const { data, error } = await realSupabase.from('Setting').select('key').limit(1);
    
    if (error) {
      if (error.message.includes('fetch')) {
        console.error('❌ Erro de conexão com o Supabase: Verifique se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão corretas nos Secrets.');
      } else if (error.code === '42501' || error.message.toLowerCase().includes('permission denied')) {
        console.log('✅ Conexão com o Supabase estabelecida com sucesso! (Tabela Setting está protegida por RLS)');
        return true;
      } else {
        console.warn('⚠️ Supabase conectado, mas houve um erro ao ler a tabela Setting:', error.message);
      }
      return false;
    }
    
    console.log('✅ Conexão com o Supabase estabelecida com sucesso!');
    return true;
  } catch (err) {
    console.error('❌ Erro inesperado ao testar conexão com o Supabase:', err);
    return false;
  }
}
