# Política de Privacidade do Comradia

> **RASCUNHO para revisão por advogado. Não é aconselhamento jurídico.**

**Status:** RASCUNHO (DRAFT)
**Data de vigência:** 13 de novembro de 2026
**Texto de consentimento:** versão 2026-11-13

Esta política explica quais dados coletamos, por que coletamos, com quem compartilhamos e quais são os seus direitos. Ela segue a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).

## 1. Quem é o controlador

O controlador dos seus dados é:

- **Nome:** [NOME DO CONTROLADOR]
- **CNPJ/CPF:** [CNPJ/CPF]
- **Contato:** [E-MAIL DE CONTATO]

O controlador decide como e por que os dados são usados.

## 2. Encarregado (DPO) e pedidos

Para pedidos sobre os seus dados, fale com o nosso encarregado:

- **Encarregado:** [ENCARREGADO]
- **E-mail:** [E-MAIL DE CONTATO]

## 3. Quais dados coletamos

| Dado | Quando e de onde vem |
| --- | --- |
| Telefone ou e-mail | Quando você entra com telefone, Google ou Apple. Ficam guardados no serviço de login do Firebase, não no seu perfil público. |
| Nome de exibição | Você informa no cadastro. |
| Data de nascimento | Você informa no cadastro. Fica privada: outras pessoas não a veem. |
| Idade | Calculada a partir da data de nascimento. Aparece no seu perfil. |
| Valores e causas políticas | Você escolhe no cadastro. |
| Vibe e "quem você procura" | Você escolhe no cadastro. |
| Filiação sindical (opcional) | Você pode informar no cadastro. Só aparece se você ativar. |
| Resposta a uma pergunta | Você escreve no cadastro. |
| Uma foto de perfil (opcional) | Você escolhe na galeria do celular. |
| Preferência de peso de valores em comum | Você define no cadastro. Fica privada. |
| Curtidas, passes e matches | Criados quando você usa o app. |
| Mensagens no chat | Enviadas por você ou pela outra pessoa, dentro de um match. |
| Bloqueios e denúncias | Criados quando você bloqueia ou denuncia alguém. |
| Token de notificação, plataforma e idioma | Criados quando você ativa as notificações. |
| Dados técnicos e de falhas | Gerados pelo app e pelos servidores quando algo dá errado. Podem incluir modelo do aparelho e versão do sistema. |

Hoje **não coletamos a sua localização** e **não lemos seus contatos**.

## 4. Para que usamos os dados e qual a base legal

| Finalidade | Dados | Base legal (LGPD) |
| --- | --- | --- |
| Criar e manter sua conta e entrar com você | Telefone, e-mail, nome | Execução de contrato (art. 7º, V) |
| Mostrar seu perfil para outras pessoas | Nome, idade, vibe, resposta, foto | Execução de contrato (art. 7º, V) |
| Confirmar que você tem 18 anos ou mais | Data de nascimento | Execução de contrato (art. 7º, V) |
| Mostrar pessoas para você e registrar curtidas e matches | Perfil, curtidas, passes, matches | Execução de contrato (art. 7º, V) |
| Permitir conversas dentro de um match | Mensagens | Execução de contrato (art. 7º, V) |
| Enviar alertas de match e de mensagem | Token, plataforma, idioma | Execução de contrato (art. 7º, V), com o seu pedido de ativar as notificações |
| Valores, causas, quem você procura, filiação sindical | Dados sensíveis (ver seção 5) | Seu consentimento específico e em destaque (art. 11, I) |
| Manter o serviço seguro: bloqueios, denúncias e análise de abusos | Bloqueios, denúncias, mensagens denunciadas | Legítimo interesse em manter um ambiente seguro (art. 7º, IX) e exercício regular de direitos (art. 7º, VI) |
| Corrigir erros do app | Dados técnicos e de falhas | Legítimo interesse em manter o app funcionando (art. 7º, IX) |

## 5. Dados sensíveis e seu consentimento

A LGPD trata como **dados sensíveis** informações sobre opinião política, filiação a sindicato e vida sexual ou orientação. No Comradia, isso inclui:

- seus valores e causas políticas;
- a filiação sindical, se você informar;
- "quem você procura", porque pode revelar sua orientação.

Usamos esses dados **só com o seu consentimento específico e em destaque** (art. 11, I da LGPD). Você dá esse consentimento no cadastro, ao aceitar o texto de consentimento versão 2026-11-13.

Pontos importantes:

- Sem esses dados, o app não consegue montar o seu perfil e mostrar pessoas para você. Por isso, para usar o Comradia, você precisa consentir.
- Você pode retirar o consentimento a qualquer momento. Para isso, **exclua sua conta no app** (seção 10). A exclusão encerra o uso do serviço.
- Se mudarmos a finalidade desses dados, pediremos um novo consentimento antes.

## 6. Quem trata os seus dados

Usamos serviços do Google para operar o Comradia. O Google Cloud e o Firebase tratam os dados em nome do controlador, como **operadores**:

- **Firebase Authentication:** login por telefone (código SMS), Google e Apple.
- **Cloud Firestore:** perfis, curtidas, matches, mensagens, bloqueios e denúncias.
- **Cloud Storage:** a sua foto de perfil.
- **Cloud Functions:** envia os alertas de match e de mensagem.
- **Firebase Cloud Messaging:** entrega os alertas no celular. No iPhone, a entrega passa pelos serviços da Apple (APNs).
- **Firebase Crashlytics (pode ser usado):** relata falhas do app para corrigirmos erros.
- **Firebase App Check (pode ser usado):** ajuda a confirmar que as requisições vêm do nosso app.

Quando você entra com Apple ou Google, esses provedores também tratam os dados de login segundo as políticas deles.

**Não vendemos dados.** **Não temos anúncios.** **Não usamos ferramentas de análise de terceiros** para acompanhar você.

## 7. Transferência internacional

Os dados são guardados assim:

- **Perfis, curtidas, matches, mensagens e denúncias:** no Cloud Firestore, em **São Paulo (Brasil)**.
- **Fotos de perfil:** no Cloud Storage, em **Carolina do Sul (EUA)**, na região `us-east1`.
- **Funções de alerta:** em São Paulo.

Ao guardar as fotos nos EUA, os dados saem do Brasil. Essa transferência internacional segue o art. 33 da LGPD, com base nas cláusulas contratuais do próprio Google. [NOTA PARA O REVISOR: confirmar a base exata da transferência, como cláusulas-padrão ou adequação.]

Alguns serviços do Google, como login e envio de alertas, podem tratar dados fora do Brasil.

## 8. Alertas (notificações)

- Os alertas não mostram nome, texto de mensagem, detalhes de perfil nem valores políticos.
- O alerta na tela de bloqueio diz apenas que há um novo match ou uma nova mensagem.
- Você pede as notificações ao ativá-las no seu perfil. Você pode desligá-las nas configurações do celular.

## 9. Compartilhamento

Não compartilhamos seus dados com empresas para publicidade. Compartilhamos dados apenas:

- com os operadores listados na seção 6, para o app funcionar;
- com outras pessoas do app, somente o que aparece no seu perfil público e nas suas conversas;
- com autoridades, quando a lei exigir ou quando houver risco sério para alguém.

Seu perfil público **não** mostra data de nascimento, telefone nem e-mail.

## 10. Quanto tempo guardamos

- **Enquanto a sua conta existir:** guardamos os dados para o app funcionar.
- **Ao excluir a conta no app:** apagamos seu perfil, sua foto, suas curtidas, seus passes, seus matches, seus bloqueios e os seus tokens de notificação. Também apagamos as mensagens que você enviou. Uma rotina de limpeza pode apagar as mensagens que a outra pessoa enviou dentro de um match que deixou de existir.
- **Denúncias:** mantemos as denúncias pelo tempo necessário para analisar o caso e proteger outras pessoas, mesmo depois da exclusão da conta. [NOTA PARA O REVISOR: definir prazo.]

## 11. Segurança

- As regras de segurança do banco de dados e do armazenamento limitam quem pode ler e escrever cada dado.
- Sua data de nascimento só pode ser lida pela sua própria conta.
- Só você pode trocar ou apagar a sua foto.
- Todo dado trafega criptografado entre o app e os servidores.
- Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco relevante a você, avisaremos você e a ANPD, como exige a LGPD.

## 12. Menores de 18 anos

- O Comradia é **somente para pessoas com 18 anos ou mais**.
- Não coletamos intencionalmente dados de menores de 18 anos.
- Se soubermos ou houver denúncia de que uma pessoa tem menos de 18 anos, **removemos a conta**.

## 13. Seus direitos (art. 18 da LGPD)

Você pode pedir, a qualquer momento:

1. confirmação de que tratamos seus dados;
2. acesso aos seus dados;
3. correção de dados incompletos, inexatos ou desatualizados;
4. anonimização, bloqueio ou eliminação de dados desnecessários ou tratados fora da lei;
5. portabilidade dos seus dados para outro fornecedor;
6. eliminação dos dados tratados com o seu consentimento;
7. informação sobre com quem compartilhamos seus dados;
8. informação sobre a possibilidade de não dar consentimento e as consequências;
9. revogação do consentimento.

**Como pedir:** envie um e-mail para [E-MAIL DE CONTATO] com o assunto "Meus dados". Podemos pedir informações para confirmar que é você. Respondemos no prazo da LGPD.

**Para excluir sua conta:** no app, vá em **Perfil** e toque em **Excluir conta**.

Você também pode reclamar à **Autoridade Nacional de Proteção de Dados (ANPD)**.

## 14. Mudanças nesta política

Podemos atualizar esta política. Quando mudarmos algo importante, avisaremos no app antes de a mudança valer. Se a mudança alterar a finalidade dos dados sensíveis, pediremos um novo consentimento.

## 15. Fale com a gente

Dúvidas sobre esta política: [E-MAIL DE CONTATO].
