// Textos que o app mostra como RESPOSTA a uma ação: avisos rápidos (toast), perguntas de confirmação
// e mensagens de validação. Ficam num lugar só para manter o tom e a escrita consistentes e para abrir
// caminho a outro idioma. O texto corrido das telas (títulos, explicações) fica junto do layout.

export const TEXTOS = {
  aviso: {
    treinoSalvo: 'Treino salvo no seu histórico',
    checkinSalvo: 'Check-in salvo',
    planoAtivado: (nome: string) => `Plano ${nome} ativado`,
    perfilSalvo: (nome: string) => `Perfil salvo. Plano ${nome} ativado`,
    planoEncerrado: 'Plano encerrado',
    pesoRegistrado: 'Peso registrado',
    categoriaSalva: 'Categoria salva',
    categoriaRemovida: 'Categoria removida',
    categoriaInvalida: 'Categoria inválida',
    lesaoRegistrada: 'Lesão registrada',
    lesaoResolvida: 'Marcada como resolvida',
    backupBaixado: 'Backup baixado',
    backupImportado: 'Backup importado',
    backupGrande: 'Arquivo grande demais para ser um backup do Corner',
    backupFalhou: 'Não foi possível importar',
    permitirNotificacoes: 'Permita as notificações no navegador para receber o lembrete',
  },
  confirmar: {
    encerrarPlano: (nome: string) => `Encerrar o plano ${nome}? Seus treinos registrados continuam salvos.`,
    trocarPlano: (nome: string) => `Trocar para o plano ${nome}? O plano atual será substituído e a semana 1 começa agora.`,
    encerrarTreino: 'Encerrar o treino agora? Os rounds já completos podem ser registrados.',
    importarBackup: 'Importar substitui os dados atuais deste aparelho pelos do backup. Continuar?',
  },
  erro: {
    pesoForaDaFaixa: 'Digite um peso entre 30 e 250 kg.',
  },
} as const
