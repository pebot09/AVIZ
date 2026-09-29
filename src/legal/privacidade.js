// Política de Privacidade do AVIZ — RASCUNHO, pendente de revisão jurídica.
//
// Mesmo formato dos Termos (seções → parágrafos e listas). Descreve o que o
// código de fato guarda hoje; se o app passar a guardar algo novo, este texto
// precisa mudar junto (ver docs/juridico.md).

import { OPERADOR as O } from './operador.js';

export const PRIVACIDADE = {
  titulo: 'Política de Privacidade',
  secoes: [
    {
      titulo: '1. Resumo',
      blocos: [
        'O AVIZ guarda o mínimo possível. De alunos, só o nome, a turma e o histórico de faltas e reposições. Da escola, só o e-mail de quem é dono. Não pedimos CPF, telefone, endereço nem data de nascimento de ninguém, não vendemos dados e não usamos cookies de rastreamento ou publicidade.',
      ],
    },
    {
      titulo: '2. Quem é responsável pelos dados',
      blocos: [
        `O AVIZ é oferecido por ${O.razaoSocial}, CNPJ ${O.cnpj}, ${O.endereco}.`,
        'Para os dados que a escola cadastra (alunos, equipe, turmas e histórico), a escola é a controladora: é ela quem decide cadastrar e por quê. O AVIZ é o operador, que guarda e processa esses dados apenas para prestar o serviço à escola.',
        'Para o e-mail do dono da escola e os dados de cobrança, o AVIZ é o controlador.',
      ],
    },
    {
      titulo: '3. Quais dados tratamos',
      blocos: [
        {
          lista: [
            'Dono da escola: e-mail, o nome ou apelido pelo qual quer ser chamado e o artigo de tratamento (o/a). O e-mail serve para o acesso por link e para comunicações sobre a assinatura.',
            'Professores: nome (como aparece no histórico de ações) e o PIN da escola.',
            'Alunos: nome, turma(s), faltas, reposições, férias, créditos, o código do link pessoal e, se o aluno ativar, as turmas em que quer ser avisado de vagas.',
            'Registros de uso: o histórico de ações dentro da escola (quem lançou qual falta, quando), usado para a escola conferir o que aconteceu, e registros técnicos de acesso mantidos pelos nossos fornecedores de infraestrutura por motivo de segurança.',
            'Cobrança: situação do plano e dos pagamentos. Os dados de pagamento (cartão, conta, Pix) ficam com o parceiro de pagamentos, nunca com o AVIZ.',
          ],
        },
        'O navegador guarda localmente, no aparelho de quem usa, algumas informações para o app funcionar: a última escola acessada, o e-mail durante o login e quais notas já foram lidas. Nada disso é usado para rastrear ninguém.',
      ],
    },
    {
      titulo: '4. Para que usamos e com qual base legal',
      blocos: [
        {
          lista: [
            'Prestar o serviço contratado pela escola (controlar faltas, vagas e reposições, e mostrar a cada aluno o que é dele): execução de contrato (art. 7º, V, da LGPD) e, para os dados de alunos, a base legal definida pela escola controladora.',
            'Dar acesso ao dono, cobrar a assinatura e avisar sobre ela: execução de contrato (art. 7º, V).',
            'Manter o serviço seguro, prevenir fraudes e registrar acessos do suporte: legítimo interesse (art. 7º, IX) e cumprimento de obrigação legal (art. 7º, II).',
            'Guardar registros fiscais da cobrança: cumprimento de obrigação legal (art. 7º, II).',
          ],
        },
        'Não usamos os dados para publicidade, não traçamos perfil de ninguém e não tomamos decisões automatizadas sobre pessoas além de aplicar as regras de reposição que a própria escola configurou.',
      ],
    },
    {
      titulo: '5. Com quem compartilhamos',
      blocos: [
        'Só com os fornecedores necessários para o AVIZ funcionar, que tratam os dados em nosso nome e sob contrato:',
        {
          lista: [
            'Google (Firebase): banco de dados e envio dos e-mails de acesso.',
            'Cloudflare: hospedagem do app e do servidor que entrega a cada aluno só os dados dele.',
            `${O.gateway}: processamento dos pagamentos da assinatura.`,
          ],
        },
        'Também podemos fornecer dados quando uma autoridade exigir, nos termos da lei.',
        'Alguns desses fornecedores guardam dados fora do Brasil (em especial nos Estados Unidos). Essa transferência internacional é feita com as garantias previstas no art. 33 da LGPD.',
      ],
    },
    {
      titulo: '6. Por quanto tempo guardamos',
      blocos: [
        {
          lista: [
            'Enquanto a escola estiver ativa, os dados ficam guardados para o serviço funcionar. A escola pode tirar alunos das turmas e apagar turmas e registros a qualquer momento.',
            'Cópias de segurança automáticas: guardamos as 10 mais recentes de cada escola; as mais antigas são apagadas automaticamente.',
            'Se a assinatura for suspensa por falta de pagamento, os dados ficam guardados por 90 dias para permitir a reativação e depois são excluídos.',
            'Se o dono excluir a escola pelo app, os dados e as cópias de segurança são apagados na hora.',
            'Registros fiscais e de cobrança são mantidos pelo prazo exigido por lei.',
          ],
        },
      ],
    },
    {
      titulo: '7. Seus direitos',
      blocos: [
        'A LGPD (art. 18) garante a qualquer pessoa o direito de confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a portabilidade, a anonimização ou a exclusão, saber com quem foram compartilhados e revogar consentimentos.',
        'Alunos e professores: como a escola é a controladora dos seus dados, faça o pedido diretamente a ela. O AVIZ dá à escola ferramentas para atender (corrigir nomes, tirar o aluno da turma, exportar e excluir os dados) e ajuda no que for preciso.',
        'Donos de escola: o próprio app permite baixar todos os dados da escola em formato aberto e excluí-los (Configurações → Dados e privacidade). Para os demais pedidos, fale com o nosso encarregado.',
      ],
    },
    {
      titulo: '8. Segurança',
      blocos: [
        'Os dados de cada escola ficam isolados: só membros daquela escola conseguem lê-los. O painel do aluno nunca baixa os dados da escola; um servidor confere o link e devolve apenas o que é daquele aluno. As chaves de acesso ao banco ficam só no servidor, nunca no navegador.',
        'O acesso da equipe do AVIZ para suporte é restrito e registrado numa trilha de auditoria.',
        'Nenhum sistema é totalmente imune a falhas. Se acontecer um incidente de segurança que possa trazer risco aos titulares, avisaremos as escolas afetadas e a Autoridade Nacional de Proteção de Dados (ANPD), como a lei determina.',
        'Lembre-se: o link pessoal do aluno funciona como uma senha. Quem tiver o link consegue agir por aquele aluno. Se um link vazar, a escola pode desativá-lo e gerar outro.',
      ],
    },
    {
      titulo: '9. Crianças e adolescentes',
      blocos: [
        'O AVIZ não pede idade nem data de nascimento. Quando a escola cadastra alunos menores de idade, cabe a ela, como controladora, garantir o melhor interesse deles e obter a autorização dos pais ou responsáveis quando a lei exigir (art. 14 da LGPD). Por isso recomendamos que a escola cadastre só o necessário para identificar o aluno na turma.',
      ],
    },
    {
      titulo: '10. Encarregado de dados e contato',
      blocos: [
        `Encarregado pelo tratamento de dados pessoais: ${O.encarregado}, pelo e-mail ${O.emailEncarregado}.`,
        'Se não ficar satisfeito com a nossa resposta, você também pode procurar a ANPD.',
      ],
    },
    {
      titulo: '11. Mudanças nesta Política',
      blocos: [
        'Se mudarmos esta Política de forma relevante, avisaremos o dono de cada escola por e-mail ou no próprio app antes de a mudança valer. A data da versão vigente aparece no topo desta página.',
      ],
    },
  ],
};
