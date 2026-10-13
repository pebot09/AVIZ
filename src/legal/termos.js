// Termos de Uso do AVIZ — RASCUNHO, pendente de revisão jurídica.
//
// Texto como dado (seções → parágrafos e listas), para a página renderizar e
// os testes conferirem que os pontos obrigatórios da PLANTA (seção 7 e 8)
// estão presentes. Os pontos que pedem decisão jurídica estão em
// docs/juridico.md.

import { OPERADOR as O } from './operador.js';

export const TERMOS = {
  titulo: 'Termos de Uso',
  secoes: [
    {
      titulo: '1. Quem somos e o que são estes Termos',
      blocos: [
        `O AVIZ é um serviço on-line de controle de faltas e reposições para negócios que funcionam em turmas recorrentes (escolas, estúdios, academias, clínicas e similares). Ele é oferecido por ${O.razaoSocial}, inscrita no CNPJ ${O.cnpj}, com sede em ${O.endereco} ("AVIZ", "nós").`,
        'Estes Termos regem o uso do AVIZ pela escola que o contrata ("Escola", "você") e por todas as pessoas que a Escola autoriza a usá-lo: a equipe (dono e professores) e os alunos (ou o termo que a Escola escolher: praticante, atleta, paciente etc.).',
        'Ao criar um espaço no AVIZ e marcar a caixa de aceite, a pessoa que faz o cadastro declara ter poderes para contratar em nome da Escola e aceita estes Termos e a Política de Privacidade.',
      ],
    },
    {
      titulo: '2. O serviço',
      blocos: [
        'O AVIZ permite que a Escola cadastre turmas e alunos, registre faltas, férias e reposições, e ofereça a cada aluno um painel próprio, acessado por um link pessoal, onde ele mesmo avisa faltas e marca reposições conforme as regras que a Escola definiu.',
        'As regras de negócio (prazos de aviso, validade das faltas, vagas extras, créditos de férias, feriados, recessos e o que o aluno pode fazer sozinho) são escolhidas pela Escola. O AVIZ aplica essas regras de forma automática, mas não decide quem tem direito a quê: essa decisão é da Escola.',
        'Por decisão de produto, o AVIZ considera uma reposição como realizada quando a data dela passa, sem registrar presença. Cabe à Escola comunicar essa regra aos seus alunos.',
      ],
    },
    {
      titulo: '3. Acessos e credenciais',
      blocos: [
        'Cada pessoa entra de um jeito:',
        {
          lista: [
            'Dono: por um link de acesso enviado ao e-mail cadastrado, sem senha. Só o dono altera regras, gerencia a equipe, exporta ou exclui os dados da Escola.',
            'Professores: pelo PIN da Escola, escolhendo o próprio nome, para que o histórico registre quem fez cada ação.',
            'Alunos: por um link pessoal, que funciona como credencial. Quem tem o link consegue agir em nome daquele aluno, dentro do que a Escola permitiu.',
          ],
        },
        'A Escola é responsável por guardar o e-mail do dono e o PIN, por entregar cada link apenas ao próprio aluno e por revogar links e PINs quando alguém deixar a Escola. O AVIZ oferece as ferramentas para isso, mas não controla a quem a Escola os entrega.',
      ],
    },
    {
      titulo: '4. Papéis na proteção de dados (LGPD)',
      blocos: [
        'Em relação aos dados dos alunos e da equipe cadastrados pela Escola, a Escola é a controladora e o AVIZ é o operador, nos termos da Lei nº 13.709/2018 (LGPD). Isso significa que o AVIZ trata esses dados apenas para prestar o serviço, segundo as instruções da Escola, e nunca para finalidades próprias.',
        'A Escola declara que tem base legal para cadastrar os nomes que insere no AVIZ e, quando houver alunos crianças ou adolescentes, que o faz no melhor interesse deles e com a autorização exigida por lei dos pais ou responsáveis.',
        'Em relação ao e-mail do dono e aos dados de cobrança, o AVIZ é controlador, conforme a Política de Privacidade.',
        'Os detalhes sobre quais dados são tratados, por quanto tempo e com quem são compartilhados estão na Política de Privacidade, que faz parte destes Termos.',
      ],
    },
    {
      titulo: '5. O que a Escola pode e não pode cadastrar',
      blocos: [
        'O AVIZ foi desenhado para guardar o mínimo: nome do aluno, a turma e o histórico de faltas e reposições. A Escola se compromete a não inserir no AVIZ, em nomes, notas ou qualquer outro campo:',
        {
          lista: [
            'documentos (CPF, RG), endereços, telefones ou e-mails de alunos;',
            'dados pessoais sensíveis, como informações de saúde, diagnósticos, religião, origem racial ou étnica, ou vida sexual;',
            'qualquer dado que não seja necessário para controlar faltas e reposições.',
          ],
        },
        'Também é proibido usar o AVIZ para fins ilícitos, tentar acessar dados de outra escola, contornar as travas de segurança do serviço ou sobrecarregá-lo de propósito.',
      ],
    },
    {
      titulo: '6. Acesso do AVIZ para suporte',
      blocos: [
        'Para dar suporte e corrigir problemas, a equipe do AVIZ pode acessar os dados da Escola. Esse acesso é restrito a quem precisa dele, usado só para prestar o serviço e registrado numa trilha de auditoria, que pode ser consultada pela Escola mediante pedido.',
      ],
    },
    {
      titulo: '7. Planos, pagamento e inadimplência',
      blocos: [
        'O AVIZ é cobrado por assinatura, nos valores e condições apresentados no momento da contratação. O pagamento é processado por um parceiro de pagamentos; o AVIZ não armazena dados de cartão ou de conta bancária.',
        'Se um pagamento não for confirmado, a Escola recebe um aviso. Se a pendência continuar por 30 dias, o acesso ao serviço é suspenso. Os dados da Escola ficam guardados por mais 90 dias depois da suspensão, para permitir a reativação; passado esse prazo, são excluídos de forma definitiva.',
      ],
    },
    {
      titulo: '8. Seus dados são seus: exportação e exclusão',
      blocos: [
        'O dono pode, a qualquer momento e sem custo, baixar uma cópia completa dos dados da Escola em formato aberto (JSON), pelo menu Configurações → Dados e privacidade.',
        'O dono também pode excluir a Escola e todos os seus dados pelo mesmo menu. A exclusão é imediata e definitiva: apaga as turmas, os alunos, o histórico, as fotos da lista e as cópias de segurança automáticas, e desativa todos os links de alunos. Recomendamos exportar os dados antes.',
        'Registros que a lei nos obriga a manter (como os fiscais, ligados à cobrança) são guardados pelo prazo legal, separados dos dados da Escola.',
      ],
    },
    {
      titulo: '9. Disponibilidade e responsabilidade',
      blocos: [
        'Trabalhamos para manter o AVIZ disponível e para guardar cópias de segurança automáticas dos dados, mas o serviço é oferecido "no estado em que se encontra", e podem ocorrer interrupções para manutenção ou por falhas de fornecedores de infraestrutura.',
        'O AVIZ não responde por decisões tomadas pela Escola com base nas regras que ela mesma configurou, nem pelo uso indevido de credenciais (e-mail, PIN ou links) entregues pela Escola.',
        'Na máxima extensão permitida pela lei, a responsabilidade total do AVIZ fica limitada ao valor pago pela Escola nos 12 meses anteriores ao evento que a originou.',
      ],
    },
    {
      titulo: '10. Propriedade intelectual',
      blocos: [
        'O software, a marca e o desenho do AVIZ pertencem ao AVIZ. A Escola recebe uma licença de uso, pessoal e intransferível, enquanto durar a assinatura. Os dados cadastrados pela Escola continuam sendo dela.',
      ],
    },
    {
      titulo: '11. Encerramento',
      blocos: [
        'A Escola pode encerrar o uso a qualquer momento, excluindo os dados pelo próprio app ou pedindo o cancelamento pelo e-mail de contato. O AVIZ pode encerrar a conta em caso de violação destes Termos, avisando antes sempre que possível.',
      ],
    },
    {
      titulo: '12. Mudanças nestes Termos',
      blocos: [
        'Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos o dono por e-mail ou no próprio app com antecedência razoável. Continuar usando o AVIZ depois da data de vigência significa aceitar a nova versão.',
      ],
    },
    {
      titulo: '13. Lei aplicável e foro',
      blocos: [
        `Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de ${O.foro} para resolver qualquer questão sobre eles.`,
        `Contato: ${O.emailContato}.`,
      ],
    },
  ],
};
