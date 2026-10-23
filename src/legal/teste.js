// Termos e Política do período de teste gratuito.
//
// Valem enquanto o AVIZ não cobra nada (MODO_TESTE em operador.js). São
// curtos, sem campos em aberto e só prometem o que o código já faz hoje. Os
// textos completos (termos.js e privacidade.js) continuam guardados para
// quando houver assinatura e revisão jurídica.

export const TERMOS_TESTE = {
  titulo: 'Termos de Uso — teste gratuito',
  secoes: [
    {
      titulo: '1. O que é este teste',
      blocos: [
        'O AVIZ é um serviço on-line de controle de faltas e reposições para escolas, ateliês, estúdios e outros negócios que funcionam em turmas recorrentes. Neste momento ele está em período de teste gratuito, oferecido a convite da equipe do AVIZ.',
        'Ao criar um espaço e marcar a caixa de aceite, quem faz o cadastro aceita estes Termos e a Política de Privacidade em nome da escola.',
      ],
    },
    {
      titulo: '2. Sem cobrança',
      blocos: [
        'O teste é gratuito e não gera nenhuma cobrança. Não pedimos cartão nem dados de pagamento.',
        'Se um dia o AVIZ passar a ser pago, a escola será avisada antes e só passará a pagar se concordar com os novos termos. Sem esse aceite, nada é cobrado.',
      ],
    },
    {
      titulo: '3. Como funciona',
      blocos: [
        'A escola cadastra turmas e alunos, registra faltas, férias e reposições, e pode dar a cada aluno um link pessoal onde ele vê o que é dele e avisa faltas conforme as regras que a escola escolheu.',
        'As regras (prazos, validade das faltas, vagas, férias, feriados) são da escola. O AVIZ só as aplica.',
        'Quem tem o link de um aluno consegue agir em nome dele. A escola deve entregar cada link só ao próprio aluno e pode desativar um link a qualquer momento.',
      ],
    },
    {
      titulo: '4. Dados',
      blocos: [
        'Os dados que a escola cadastra são da escola. Ela é a controladora desses dados e o AVIZ é o operador, que os usa só para fazer o serviço funcionar (Lei nº 13.709/2018, LGPD).',
        'Cadastre só o necessário: nome do aluno e turma. Não coloque no AVIZ documentos, telefones, endereços nem dados sensíveis, como informações de saúde.',
        'O dono pode baixar uma cópia de todos os dados a qualquer momento, em Configurações → Baixar os dados. Para excluir a escola e todos os dados dela, basta pedir à equipe do AVIZ.',
      ],
    },
    {
      titulo: '5. Por ser um teste',
      blocos: [
        'O AVIZ ainda está sendo construído. Telas e regras podem mudar, e podem acontecer falhas ou interrupções. Fazemos cópias de segurança automáticas, mas recomendamos baixar os dados de vez em quando.',
        'O serviço é oferecido como está, sem garantia de funcionamento contínuo. Usar o AVIZ para fins ilícitos ou tentar acessar dados de outra escola é proibido.',
      ],
    },
    {
      titulo: '6. Fim do teste e contato',
      blocos: [
        'A escola pode parar de usar o AVIZ quando quiser e pedir a exclusão dos dados. Se o teste acabar, avisaremos antes, com tempo para a escola baixar os dados.',
        'Dúvidas, sugestões e pedidos: fale com a equipe do AVIZ pelo mesmo canal em que recebeu o convite para o teste.',
      ],
    },
  ],
};

export const PRIVACIDADE_TESTE = {
  titulo: 'Política de Privacidade — teste gratuito',
  secoes: [
    {
      titulo: '1. Resumo',
      blocos: [
        'O AVIZ guarda o mínimo possível. De alunos, só o nome, a turma e o histórico de faltas e reposições. Da escola, o e-mail de quem é dono. Não pedimos CPF, telefone, endereço nem data de nascimento de ninguém, não vendemos dados e não usamos cookies de rastreamento ou publicidade.',
      ],
    },
    {
      titulo: '2. Quem decide sobre os dados',
      blocos: [
        'Para os dados que a escola cadastra (alunos, equipe, turmas e histórico), a escola é a controladora e o AVIZ é o operador: guarda e processa esses dados só para prestar o serviço.',
        'Para o e-mail do dono, usado no acesso por link, o AVIZ é o controlador.',
      ],
    },
    {
      titulo: '3. Quais dados tratamos',
      blocos: [
        {
          lista: [
            'Dono: e-mail e o nome pelo qual quer ser chamado.',
            'Professores: nome e o PIN de acesso.',
            'Alunos: nome, turma(s), faltas, reposições, férias, créditos e o código do link pessoal.',
            'Histórico de ações dentro da escola (quem lançou o quê e quando), para a escola conferir o que aconteceu.',
          ],
        },
        'O navegador guarda no próprio aparelho algumas informações para o app funcionar, como a última escola acessada. Nada disso é usado para rastrear ninguém.',
      ],
    },
    {
      titulo: '4. Com quem compartilhamos',
      blocos: [
        'Só com os fornecedores necessários para o AVIZ funcionar: Google (Firebase), para o banco de dados e os e-mails de acesso, e Cloudflare, para a hospedagem. Alguns guardam dados fora do Brasil, como permite o art. 33 da LGPD.',
        'Também podemos fornecer dados quando uma autoridade exigir, nos termos da lei.',
      ],
    },
    {
      titulo: '5. Por quanto tempo guardamos',
      blocos: [
        'Enquanto a escola usar o AVIZ. Guardamos as 10 cópias de segurança automáticas mais recentes de cada escola. Se o dono pedir a exclusão da escola, os dados e as cópias são apagados.',
      ],
    },
    {
      titulo: '6. Seus direitos',
      blocos: [
        'A LGPD (art. 18) garante a qualquer pessoa o direito de acessar, corrigir, levar ou pedir a exclusão dos seus dados.',
        'Alunos e professores: façam o pedido à escola, que é a controladora. O app dá a ela as ferramentas para isso. Donos: o próprio app permite baixar os dados da escola (Configurações → Baixar os dados); para excluí-los, peçam à equipe do AVIZ.',
        'Quando houver alunos crianças ou adolescentes, cabe à escola cuidar do melhor interesse deles e ter a autorização dos responsáveis quando a lei exigir (art. 14 da LGPD).',
      ],
    },
    {
      titulo: '7. Segurança',
      blocos: [
        'Os dados de cada escola ficam isolados: só membros daquela escola conseguem lê-los. O painel do aluno recebe apenas o que é daquele aluno.',
        'O link pessoal do aluno funciona como uma senha. Se um link vazar, a escola pode desativá-lo e gerar outro.',
      ],
    },
    {
      titulo: '8. Contato',
      blocos: [
        'Dúvidas ou pedidos sobre dados: fale com a equipe do AVIZ pelo mesmo canal em que recebeu o convite para o teste. Você também pode procurar a ANPD.',
      ],
    },
  ],
};
