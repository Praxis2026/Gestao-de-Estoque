import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  Save, 
  User, 
  BookOpen,
  Filter,
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { Patient, Course } from '@/types';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

export default function PatientsCourses() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'patients' | 'courses'>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ nome: '', cpf: '', email: '', telefone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  function removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .toLowerCase();
  }

  async function fetchData() {
    setLoading(true);
    try {
      const table = activeTab === 'patients' ? 'Patient' : 'Course';
      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('nome')
          .range(from, from + limit - 1);

        if (error) throw error;

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
      
      if (activeTab === 'patients') {
        setPatients(allData);
      } else {
        setCourses(allData);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setFormData(activeTab === 'patients' 
        ? { nome: item.nome, cpf: item.cpf, email: item.email, telefone: item.telefone } 
        : { nome: item.nome });
    } else {
      setSelectedItem(null);
      setFormData(activeTab === 'patients' 
        ? { nome: '', cpf: '', email: '', telefone: '' } 
        : { nome: '' });
    }
    setIsModalOpen(true);
  };

  const downloadTemplate = () => {
    const template = activeTab === 'patients' 
      ? [
          {
            'Nome Completo': 'Exemplo de Paciente',
            'CPF': '000.000.000-00',
            'Email': 'paciente@exemplo.com',
            'Telefone': '(00) 00000-0000'
          }
        ]
      : [
          {
            'Nome do Curso': 'Exemplo de Curso',
            'Descrição': 'Descrição opcional do curso'
          }
        ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'patients' ? 'Pacientes' : 'Cursos');
    XLSX.writeFile(wb, `template_importacao_${activeTab === 'patients' ? 'pacientes' : 'cursos'}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          alert('O arquivo está vazio.');
          return;
        }

        setSubmitting(true);
        const table = activeTab === 'patients' ? 'Patient' : 'Course';
        
        const itemsToInsert = json.map((row: any) => {
          if (activeTab === 'patients') {
            return {
              nome: row['Nome Completo'] || row['nome'] || row['Nome'],
              cpf: row['CPF'] || row['cpf'],
              email: row['Email'] || row['email'],
              telefone: row['Telefone'] || row['telefone']
            };
          } else {
            return {
              nome: row['Nome do Curso'] || row['nome'] || row['Nome'],
              descricao: row['Descrição'] || row['descricao']
            };
          }
        }).filter(item => item.nome);

        if (itemsToInsert.length === 0) {
          alert('Nenhum dado válido encontrado. Verifique se a coluna "Nome Completo" ou "Nome do Curso" está preenchida.');
          setSubmitting(false);
          return;
        }

        const { error } = await supabase.from(table).insert(itemsToInsert);
        if (error) throw error;

        alert(`${itemsToInsert.length} registros importados com sucesso!`);
        fetchData();
      } catch (error: any) {
        console.error('Erro na importação:', error);
        alert('Erro ao importar arquivo: ' + (error.message || 'Verifique o formato do arquivo.'));
      } finally {
        setSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const table = activeTab === 'patients' ? 'Patient' : 'Course';
    try {
      if (selectedItem) {
        const { error } = await supabase
          .from(table)
          .update(formData)
          .eq('id', selectedItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(table)
          .insert([formData]);
        if (error) throw error;
      }
      
      await fetchData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    const table = activeTab === 'patients' ? 'Patient' : 'Course';
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', selectedItem.id);
      
      if (error) throw error;
      
      await fetchData();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (activeTab === 'patients' ? patients : courses).filter(item => {
    if (!searchTerm) return true;
    return removeAccents(item.nome ?? '').includes(removeAccents(searchTerm));
  });

  // Permissions
  const patientPermissions = user?.perfil?.permissions?.pacientes;
  const coursePermissions = user?.perfil?.permissions?.cursos;
  
  const canCreate = user?.role === 'ADMINISTRADOR' || (activeTab === 'patients' ? patientPermissions?.criar : coursePermissions?.criar);
  const canEdit = user?.role === 'ADMINISTRADOR' || (activeTab === 'patients' ? patientPermissions?.editar : coursePermissions?.editar);
  const canDelete = user?.role === 'ADMINISTRADOR' || (activeTab === 'patients' ? patientPermissions?.excluir : coursePermissions?.excluir);
  const isAdmin = user?.role === 'ADMINISTRADOR';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pacientes e Cursos</h1>
          <p className="text-slate-500">Gerencie os destinos das saídas de estoque.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              <button 
                onClick={downloadTemplate}
                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-200 transition-all font-medium"
                title="Baixar planilha modelo"
              >
                <Download className="w-5 h-5" />
                Template
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-200 transition-all font-medium disabled:opacity-50"
                title="Importar de planilha Excel"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Importar
              </button>
            </>
          )}
          {canCreate && (
            <button 
              onClick={() => handleOpenModal()} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-medium"
            >
              <Plus className="w-5 h-5" /> 
              Novo {activeTab === 'patients' ? 'Paciente' : 'Curso'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => { setActiveTab('patients'); setSearchTerm(''); }} 
          className={cn(
            "px-6 py-3 font-semibold transition-all border-b-2", 
            activeTab === 'patients' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Pacientes
        </button>
        <button 
          onClick={() => { setActiveTab('courses'); setSearchTerm(''); }} 
          className={cn(
            "px-6 py-3 font-semibold transition-all border-b-2", 
            activeTab === 'courses' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Cursos
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder={`Buscar ${activeTab === 'patients' ? 'paciente' : 'curso'}...`} 
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-350px)]">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome</th>
                {activeTab === 'patients' && (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">CPF</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Telefone</th>
                  </>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'patients' ? 5 : 2} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span>Carregando dados...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'patients' ? 5 : 2} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>Nenhum registro encontrado.</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        {activeTab === 'patients' ? <User className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                      </div>
                      <span className="font-semibold text-slate-900">{item.nome}</span>
                    </div>
                  </td>
                  {activeTab === 'patients' && (
                    <>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 font-mono">{item.cpf || '---'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{item.email || '---'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{item.telefone || '---'}</span>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenModal(item)} 
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => { setSelectedItem(item); setIsConfirmOpen(true); }} 
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
        title={selectedItem ? `Editar ${activeTab === 'patients' ? 'Paciente' : 'Curso'}` : `Novo ${activeTab === 'patients' ? 'Paciente' : 'Curso'}`}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
              <input 
                type="text" 
                required 
                value={formData.nome} 
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder={activeTab === 'patients' ? "Nome do paciente" : "Nome do curso"}
              />
            </div>
            {activeTab === 'patients' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                  <input 
                    type="text" 
                    value={formData.cpf} 
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                    placeholder="000.000.000-00" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                    placeholder="email@exemplo.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                  <input 
                    type="text" 
                    value={formData.telefone} 
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
              </>
            )}
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
        title={`Excluir ${activeTab === 'patients' ? 'Paciente' : 'Curso'}`} 
        message={`Tem certeza que deseja excluir "${selectedItem?.nome}"? Esta ação não pode ser desfeita.`} 
        variant="danger"
      />
    </div>
  );
}
