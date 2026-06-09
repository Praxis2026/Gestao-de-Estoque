export type UserRole = 'OPERADOR' | 'VISUALIZADOR' | 'ADMINISTRADOR';

export interface ModulePermissions {
  visualizar: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
}

export interface ProfilePermissions {
  dashboard: ModulePermissions;
  movimentacoes: ModulePermissions;
  estoque: ModulePermissions;
  equivalencias: ModulePermissions;
  pacientes: ModulePermissions;
  proteses: ModulePermissions;
  cursos: ModulePermissions;
  relatorios: ModulePermissions;
  ageing: ModulePermissions;
  usuarios: ModulePermissions;
  configuracoes: ModulePermissions;
}

export interface Perfil {
  id: number;
  nome: string;
  descricao: string;
  status: 'Ativo' | 'Inativo';
  permissions: ProfilePermissions;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  perfil_id?: number;
  perfil?: Perfil;
}

export interface Category {
  id: number;
  nome: string;
}

export interface UnitOfMeasure {
  id: number;
  nome: string;
  sigla: string;
}

export interface Supplier {
  id: number;
  codigo?: number;
  nome: string;
  cnpj: string;
  contato?: string;
}

export interface Material {
  id: number;
  nome: string;
  categoriaId?: number;
  unidadeMedidaId?: number;
  fornecedorId?: number;
  tipo_material: string;
  referencia?: string;
  estoque_inicial: number;
  estoque_minimo: number;
  vl_sem_desconto: number;
  valor_unitario: number;
  localizacao_fisica?: string;
  estoque_atual: number;
  percentual_venda: number;
  preco_venda: number;
  data_entrada?: string;
  equivalence_group_id?: number;
  equivalence_group_name?: string;
  equivalence_refs?: string;
  group_total_stock?: number;
  // Joined fields
  category?: Category;
  unit?: UnitOfMeasure;
  supplier?: Supplier;
}

export interface EquivalenceGroup {
  id: number;
  nome: string;
  created_at: string;
}

export interface Movimentacao {
  id: number;
  data: string;
  material_id: number;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  tipo: 'ENTRADA' | 'SAIDA';
  tipo_entrada?: string;
  paciente_ou_curso?: string;
  patientId?: number;
  courseId?: number;
  profissional_responsavel?: string;
  observacoes?: string;
  // Joined fields
  material?: Material;
}

export interface Patient {
  id: number;
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
}

export interface Course {
  id: number;
  nome: string;
  descricao?: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
}

export type ProstheticStatus = 'ABERTO' | 'RECEBIDO' | 'AJUSTE_REQUISITADO' | 'REPETICAO' | 'FINALIZADO';
export type OnusRepeticao = 'CLINICA' | 'LABORATORIO' | 'PACIENTE';

export interface ProstheticServiceItem {
  id: number;
  service_id: number;
  descricao: string;
  valor: number;
  created_at: string;
}

export interface ProstheticService {
  id: number;
  patient_id: number;
  supplier_id: number;
  referencia_os: string;
  descricao_trabalho: string;
  valor_servico: number;
  status: ProstheticStatus;
  created_at: string;
  data_envio: string;
  data_previsao?: string;
  data_recebimento?: string;
  data_finalizacao?: string;
  is_repeticao: boolean;
  onus_repeticao?: OnusRepeticao;
  id_origem_repeticao?: number;
  observacoes?: string;
  created_by: string;
  // Joined fields
  patient?: Patient;
  supplier?: Supplier;
  items?: ProstheticServiceItem[];
}

export interface ProstheticServiceLog {
  id: number;
  service_id: number;
  status_anterior?: ProstheticStatus;
  status_novo: ProstheticStatus;
  observacao?: string;
  local_atual: 'CLINICA' | 'LABORATORIO';
  created_at: string;
  created_by: string;
}
