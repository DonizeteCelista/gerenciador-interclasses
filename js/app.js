import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDem1Wtpl4EmWoDZH6fVcFbhqWjdc5EyRo",
  authDomain: "gerenciador-de-interclasse.firebaseapp.com",
  projectId: "gerenciador-de-interclasse",
  storageBucket: "gerenciador-de-interclasse.firebasestorage.app",
  messagingSenderId: "269225192105",
  appId: "1:269225192105:web:5a1cd37856d53887e4d7b8",
  measurementId: "G-Q9E575TP8M"
};

const firebaseApp=initializeApp(firebaseConfig);
const db=getFirestore(firebaseApp);
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const $=id=>document.getElementById(id);
const screens=[...document.querySelectorAll(".screen")];
const state={screen:"telaBusca",school:null,admin:false,current:null,currentGame:null,wizard:newWizard(),unsubAdmin:null,unsubStudent:null,setDraft:[],editReturn:false,allChampionships:[]};

function newWizard(){return{id:null,turno:"",esporte:"",modalidade:"",participantes:[],tipoPlacar:"pontos",formatoSets:"unico",pontosSetNormal:25,pontosTieBreak:15,formato:"",quantidadeGrupos:1,regraClassificacao:"",grupos:[],jogos:[],eliminatorias:[],publicado:true,status:"aberto",podio:null};}
function show(id){screens.forEach(s=>s.classList.toggle("active",s.id===id));state.screen=id;$("btnVoltar").classList.toggle("hidden",id==="telaBusca");scrollTo({top:0,behavior:"smooth"});}
function toast(m){const e=$("toast");e.textContent=m;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),2600);}
function load(on){$("loading").classList.toggle("hidden",!on);}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function esc(s=""){const d=document.createElement("div");d.textContent=s;return d.innerHTML;}
async function hashPassword(s){const b=new TextEncoder().encode(s),h=await crypto.subtle.digest("SHA-256",b);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function schoolUrl(id=state.school?.id){const u=new URL(location.href);u.searchParams.set("escola",id);return u.toString();}
function campsRef(){return collection(db,"escolas",state.school.id,"campeonatos");}
function sportIcon(s){if(s.includes("Futsal"))return"⚽";if(s.includes("Vôlei"))return"🏐";if(s.includes("Basquete"))return"🏀";if(s.includes("Tênis"))return"🏓";if(s.includes("Queimada"))return"🔥";return"🏆";}
function isIndividual(){return state.wizard.esporte==="Tênis de mesa";}
function recommendedScore(s){
  return ["Vôlei","Vôlei em duplas"].includes(s) ? "sets" : "pontos";
}
function isCustomSport(){
  return !["Futsal","Vôlei","Vôlei em duplas","Basquete 3x3","Queimada","Tênis de mesa"].includes(state.wizard.esporte);
}

async function createSchool(){
  const nome=$("nomeEscola").value.trim(),email=$("emailProfessor").value.trim().toLowerCase(),senha=$("senhaEscola").value,conf=$("confirmarSenha").value;
  if(!nome||!email||!senha||!conf)return toast("Preencha todos os campos.");if(senha.length<6)return toast("A senha precisa ter pelo menos 6 caracteres.");if(senha!==conf)return toast("As senhas não são iguais.");
  load(true);try{
    const senhaHash=await hashPassword(senha),expiraEm=new Date(Date.now()+60*86400000);
    const ref=await addDoc(collection(db,"escolas"),{nome,nomeBusca:norm(nome),emailResponsavel:email,senhaHash,criadoEm:serverTimestamp(),expiraEm,ativo:true});
    state.school={id:ref.id,nome,emailResponsavel:email,senhaHash,expiraEm,ativo:true};openSchool(state.school);toast("Escola criada com sucesso.");
  }catch(e){console.error(e);toast("Não foi possível criar a escola.");}finally{load(false);}
}
async function searchSchools(){
  const termo=norm($("campoBusca").value);if(termo.length<2)return toast("Digite pelo menos 2 letras.");
  load(true);$("resultadosBusca").innerHTML="";
  try{
    const q=query(collection(db,"escolas"),orderBy("nomeBusca"),where("nomeBusca",">=",termo),where("nomeBusca","<=",termo+"\uf8ff"),limit(20)),snap=await getDocs(q),now=Date.now();
    const arr=snap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.ativo!==false&&(!s.expiraEm?.toDate||s.expiraEm.toDate().getTime()>now));
    if(!arr.length){$("resultadosBusca").innerHTML='<div class="card muted">Nenhuma escola encontrada.</div>';return;}
    arr.forEach(s=>{const b=document.createElement("button");b.className="school-item";b.innerHTML=`<span>🏫</span><div><strong>${esc(s.nome)}</strong><small>Toque para abrir</small></div>`;b.onclick=()=>openSchool(s);$("resultadosBusca").appendChild(b);});
  }catch(e){console.error(e);toast("Erro ao pesquisar.");}finally{load(false);}
}
async function openSchoolById(id){load(true);try{const s=await getDoc(doc(db,"escolas",id));if(!s.exists())return toast("Escola não encontrada.");openSchool({id:s.id,...s.data()});}finally{load(false);}}
function openSchool(s){state.school=s;localStorage.setItem("ultimaEscola",JSON.stringify(s));$("nomeEscolaAtual").textContent=s.nome;$("topSubtitle").textContent=s.nome;listenStudent();renderQR();show("telaEscola");}
function renderQR(){const box=$("qrcode");box.innerHTML="";if(window.QRCode)new QRCode(box,{text:schoolUrl(),width:190,height:190,colorDark:"#173b7a",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});}
function listenStudent(){
  if(state.unsubStudent)state.unsubStudent();
  state.unsubStudent=onSnapshot(campsRef(),snap=>{
    const all=snap.docs.map(d=>({id:d.id,...d.data()}));state.allChampionships=all;renderStudentFavorites();const camps=all.filter(c=>c.publicado!==false),turns=[["Matutino","🌅"],["Vespertino","☀️"],["Noturno","🌙"],["Outro","⭐"]],box=$("turnosAluno");box.innerHTML="";
    const active=turns.filter(([t])=>camps.some(c=>c.turno===t));if(!active.length){box.innerHTML='<div class="card muted" style="grid-column:1/-1">Ainda não há campeonatos publicados.</div>';return;}
    active.forEach(([t,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${t}</strong><small>Ver competições</small>`;b.onclick=()=>openStudentList(t,camps.filter(c=>c.turno===t));box.appendChild(b);});
  });
}
async function teacherLogin(){
  if(!state.school)return toast("Escolha uma escola.");const senha=$("senhaLogin").value;if(!senha)return toast("Digite a senha.");
  load(true);try{
    const snap=await getDoc(doc(db,"escolas",state.school.id));if(!snap.exists())return toast("Escola não encontrada.");state.school={id:snap.id,...snap.data()};
    const hash=await hashPassword(senha);if(hash!==state.school.senhaHash)return toast("Senha incorreta.");
    state.admin=true;$("senhaLogin").value="";$("escolaPainel").textContent=state.school.nome;listenAdmin();show("telaProfessor");
  }finally{load(false);}
}
function listenAdmin(){if(state.unsubAdmin)state.unsubAdmin();state.unsubAdmin=onSnapshot(campsRef(),snap=>renderAdmin(snap.docs.map(d=>({id:d.id,...d.data()}))));}
function renderAdmin(arr){
  const box=$("listaCampeonatosAdmin");box.innerHTML="";if(!arr.length){box.innerHTML='<div class="card muted">Nenhum campeonato criado. Clique em “Criar campeonato” para começar.</div>';return;}
  arr.sort((a,b)=>(a.turno+a.esporte).localeCompare(b.turno+b.esporte));arr.forEach(c=>{const el=document.createElement("div");el.className="admin-item";el.innerHTML=`<div><strong>${esc(c.esporte)} — ${esc(c.modalidade)}</strong><small>${esc(c.turno)} · ${c.participantes?.length||0} participantes · ${c.status==="encerrado"?"Encerrado":c.publicado===false?"Oculto":"Publicado"}</small></div><div class="admin-actions"><button class="mini" data-open>Jogos</button><button class="mini secondary" data-edit>Editar</button><button class="mini ghost" data-pub>${c.publicado===false?"Publicar":"Ocultar"}</button><button class="mini danger" data-del>Excluir</button></div>`;el.querySelector("[data-open]").onclick=()=>openCompetition(c,true);el.querySelector("[data-edit]").onclick=()=>editChamp(c);el.querySelector("[data-pub]").onclick=()=>updateDoc(doc(db,"escolas",state.school.id,"campeonatos",c.id),{publicado:c.publicado===false,atualizadoEm:serverTimestamp()});el.querySelector("[data-del]").onclick=()=>deleteChamp(c);box.appendChild(el);});
}
function startWizard(){state.wizard=newWizard();renderTurns();show("telaTurno");}
function renderTurns(){const opts=[["Matutino","🌅"],["Vespertino","☀️"],["Noturno","🌙"],["Outro","⭐"]],box=$("opcoesTurno");box.innerHTML="";opts.forEach(([n,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${n}</strong>`;b.onclick=()=>{state.wizard.turno=n;renderSports();show("telaEsporte");};box.appendChild(b);});}
function renderSports(){const opts=[["Futsal","⚽"],["Vôlei","🏐"],["Vôlei em duplas","🏐"],["Basquete 3x3","🏀"],["Queimada","🔥"],["Tênis de mesa","🏓"],["Adicionar esporte","➕"]],box=$("opcoesEsporte");box.innerHTML="";$("boxEsporteCustom").classList.add("hidden");opts.forEach(([n,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${n}</strong>`;b.onclick=()=>{if(n==="Adicionar esporte"){$("boxEsporteCustom").classList.remove("hidden");$("nomeEsporteCustom").focus();}else{state.wizard.esporte=n;renderModalities();}};box.appendChild(b);});}
function customSport(){const n=$("nomeEsporteCustom").value.trim();if(!n)return toast("Digite o nome do esporte.");state.wizard.esporte=n;renderModalities();}
function renderModalities(){if(state.wizard.esporte==="Tênis de mesa"){state.wizard.modalidade="Misto";prepareParticipants();show("telaParticipantes");return;}const opts=[["Misto","⚥"],["Masculino","♂"],["Feminino","♀"]],box=$("opcoesModalidade");box.innerHTML="";opts.forEach(([n,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${n}</strong>`;b.onclick=()=>{state.wizard.modalidade=n;prepareParticipants();show("telaParticipantes");};box.appendChild(b);});show("telaModalidade");}
function prepareParticipants(){$("tituloParticipantes").textContent=isIndividual()?"Adicionar jogadores":"Adicionar times";$("textoParticipantes").textContent="Cadastre todos os participantes antes de avançar.";$("labelParticipante").textContent=isIndividual()?"Nome do jogador":"Nome do time";$("nomeParticipante").placeholder=isIndividual()?"Ex.: João da Silva":"Ex.: 3º Ano A";renderParticipants();}
function addParticipant(){const n=$("nomeParticipante").value.trim();if(!n)return toast("Digite um nome.");if(state.wizard.participantes.some(p=>norm(p.nome)===norm(n)))return toast("Esse nome já foi adicionado.");state.wizard.participantes.push({id:crypto.randomUUID(),nome:n,jogadores:[]});$("nomeParticipante").value="";renderParticipants();}
function renderParticipants(){const box=$("listaParticipantes");box.innerHTML="";if(!state.wizard.participantes.length){box.innerHTML='<div class="card muted">Nenhum participante adicionado.</div>';return;}state.wizard.participantes.forEach(p=>{const el=document.createElement("div");el.className="participant-item";el.innerHTML=`<div><strong>${esc(p.nome)}</strong><small>${p.jogadores.length?`${p.jogadores.length} jogadores`:""}</small></div><div class="participant-actions">${state.wizard.esporte==="Futsal"?'<button class="mini secondary" data-players>Jogadores</button>':""}<button class="mini ghost" data-edit>Editar</button><button class="mini danger" data-del>Excluir</button></div>`;el.querySelector("[data-edit]").onclick=()=>{const n=prompt("Novo nome:",p.nome)?.trim();if(n){p.nome=n;renderParticipants();}};el.querySelector("[data-del]").onclick=()=>{state.wizard.participantes=state.wizard.participantes.filter(x=>x.id!==p.id);renderParticipants();};const bp=el.querySelector("[data-players]");if(bp)bp.onclick=()=>openPlayers(p.id);box.appendChild(el);});}
function openPlayers(id){state.wizard.playerTeamId=id;const p=state.wizard.participantes.find(x=>x.id===id);$("tituloTimeJogadores").textContent=p.nome;renderPlayers();show("telaJogadores");}
function addPlayer(){const n=$("nomeJogador").value.trim();if(!n)return toast("Digite o nome.");const p=state.wizard.participantes.find(x=>x.id===state.wizard.playerTeamId);p.jogadores.push({id:crypto.randomUUID(),nome:n,gols:0});$("nomeJogador").value="";renderPlayers();}
function renderPlayers(){const p=state.wizard.participantes.find(x=>x.id===state.wizard.playerTeamId),box=$("listaJogadores");box.innerHTML="";if(!p.jogadores.length){box.innerHTML='<div class="card muted">Nenhum jogador adicionado.</div>';return;}p.jogadores.forEach(j=>{const e=document.createElement("div");e.className="participant-item";e.innerHTML=`<strong>${esc(j.nome)}</strong><button class="mini danger">Excluir</button>`;e.querySelector("button").onclick=()=>{p.jogadores=p.jogadores.filter(x=>x.id!==j.id);renderPlayers();};box.appendChild(e);});}
function openRules(){
  if(state.wizard.participantes.length<2)return toast("Adicione pelo menos 2 participantes.");

  const custom = isCustomSport();
  state.wizard.tipoPlacar = recommendedScore(state.wizard.esporte);

  $("boxTipoPlacarCustom").classList.toggle("hidden", !custom);
  $("tipoPlacar").value = state.wizard.tipoPlacar;

  if(custom){
    $("regraAutomaticaResumo").textContent = "Como este é um esporte personalizado, escolha se o resultado será registrado por pontos/gols ou por sets.";
  }else if(state.wizard.tipoPlacar === "sets"){
    $("regraAutomaticaResumo").textContent = `${state.wizard.esporte}: resultado por sets. Escolha o formato e a pontuação dos sets.`;
  }else{
    $("regraAutomaticaResumo").textContent = `${state.wizard.esporte}: resultado por pontos ou gols.`;
  }

  syncSetOptions();
  show("telaRegras");
}
function syncSetOptions(){
  const tipo = isCustomSport() ? $("tipoPlacar").value : recommendedScore(state.wizard.esporte);
  $("tipoPlacar").value = tipo;
  $("boxSets").classList.toggle("hidden", tipo !== "sets");
  $("boxTieBreak").classList.toggle("hidden", $("formatoSets").value === "unico");
  $("pontosSetCustom").classList.toggle("hidden", $("pontosSetNormal").value !== "custom");
  $("pontosTieBreakCustom").classList.toggle("hidden", $("pontosTieBreak").value !== "custom");
}
function openFormat(){state.wizard.tipoPlacar=isCustomSport()?$("tipoPlacar").value:recommendedScore(state.wizard.esporte);state.wizard.formatoSets=$("formatoSets").value;state.wizard.pontosSetNormal=Number($("pontosSetNormal").value==="custom"?$("pontosSetCustom").value:$("pontosSetNormal").value);state.wizard.pontosTieBreak=Number($("pontosTieBreak").value==="custom"?$("pontosTieBreakCustom").value:$("pontosTieBreak").value);if(state.wizard.tipoPlacar==="sets"&&(!state.wizard.pontosSetNormal||state.wizard.pontosSetNormal<1))return toast("Informe os pontos do set.");renderRules();renderCompetitionSuggestion();show("telaFormato");}

function competitionSuggestion(){
  const total=state.wizard.participantes.length;

  if(total<=5){
    return {
      formato:"grupos",
      grupos:1,
      regra:total>=4?"semi4":total>=3?"final2":"campeaoGrupo",
      titulo:"Sugestão: 1 grupo",
      texto:total>=4
        ?`${total} participantes: todos contra todos e os 4 primeiros avançam às semifinais.`
        :total>=3
          ?`${total} participantes: todos contra todos, com final entre 1º e 2º.`
          :`${total} participantes: grupo único, com o líder campeão.`
    };
  }

  if(total<=11){
    return {
      formato:"grupos",
      grupos:2,
      regra:"top2grupo",
      titulo:"Sugestão: 2 grupos",
      texto:`${total} participantes: distribuição equilibrada em 2 grupos e semifinais cruzadas.`
    };
  }

  return {
    formato:"grupos",
    grupos:4,
    regra:total>=16?"top2Quarta":"lideres4Semi",
    titulo:"Sugestão: 4 grupos",
    texto:total>=16
      ?`${total} participantes: 4 grupos, com 1º e 2º avançando às quartas.`
      :`${total} participantes: 4 grupos, com os líderes avançando às semifinais.`
  };
}

function renderCompetitionSuggestion(){
  const suggestion=competitionSuggestion();
  const box=$("sugestaoFormato");
  box.innerHTML=`
    <h3>✨ ${suggestion.titulo}</h3>
    <p>${suggestion.texto}</p>
    <p><strong>Você ainda pode escolher outro formato manualmente.</strong></p>
    <button id="btnUsarSugestao" class="teacher">Usar sugestão</button>`;

  $("btnUsarSugestao").onclick=()=>{
    state.wizard.formato=suggestion.formato;
    state.wizard.quantidadeGrupos=suggestion.grupos;
    $("quantidadeGrupos").value=String(suggestion.grupos);
    updateGroupRules();
    $("regraClassificacao").value=suggestion.regra;
    updateClassificationRuleDetails();

    document.querySelectorAll(".format-card").forEach(b=>b.classList.toggle("selected",b.dataset.formato==="grupos"));
    $("configGrupos").classList.remove("hidden");
    toast("Sugestão aplicada. Confira e avance.");
  };
}

function renderRules(){
  updateGroupRules();
}
function updateGroupRules(){
  const total=state.wizard.participantes.length;
  const grupos=Number($("quantidadeGrupos").value||1);
  const sel=$("regraClassificacao");
  const help=$("explicacaoGrupos");
  sel.innerHTML="";

  let options=[];

  if(grupos===1){
    help.textContent="Um único grupo, com todos jogando entre si.";
    options=[
      {
        value:"campeaoGrupo",
        label:"Líder do grupo é o campeão",
        detail:"Ao terminar todos os jogos, o 1º colocado recebe o ouro, o 2º recebe a prata e o 3º recebe o bronze. Não haverá eliminatórias."
      },
      {
        value:"final2",
        label:"1º e 2º avançam para a final",
        detail:"O 1º e o 2º colocado disputam a final. O 3º colocado recebe o bronze diretamente, sem precisar jogar outra partida."
      },
      {
        value:"semi4",
        label:"Os 4 primeiros avançam para as semifinais",
        detail:"Semifinais: 1º × 4º e 2º × 3º. Os vencedores disputam a final e os perdedores disputam o 3º lugar."
      }
    ];
  }else if(grupos===2){
    help.textContent="Os times são distribuídos da forma mais equilibrada possível. Se a quantidade for ímpar, um grupo terá apenas um time a mais.";
    options=[
      {
        value:"lideresFinal",
        label:"Os líderes se classificam para a final",
        detail:"O líder do Grupo A enfrenta o líder do Grupo B na final. Entre os dois segundos colocados, o melhor deles recebe o bronze diretamente."
      },
      {
        value:"top2grupo",
        label:"Os 2 melhores de cada grupo se classificam",
        detail:"Semifinais cruzadas: 1º A × 2º B e 1º B × 2º A. Os vencedores disputam a final e os perdedores disputam o 3º lugar."
      }
    ];
  }else if(grupos===4){
    help.textContent="Os times são distribuídos igualmente entre os 4 grupos. Quando a divisão não for exata, a diferença será de no máximo um time.";
    options=[
      {
        value:"lideres4Semi",
        label:"Os 1º colocados de cada grupo avançam",
        detail:"Os quatro líderes disputam as semifinais. Os vencedores avançam para a final e os perdedores jogam a disputa do 3º lugar."
      },
      {
        value:"top2Quarta",
        label:"Os 2 melhores de cada grupo avançam",
        detail:"Oito times avançam para as quartas de final. Depois vêm as semifinais, a disputa do 3º lugar e a final."
      }
    ];
  }

  options.forEach(option=>{
    const o=document.createElement("option");
    o.value=option.value;
    o.textContent=option.label;
    o.dataset.detail=option.detail;
    sel.appendChild(o);
  });

  [...sel.options].forEach(o=>{
    if(o.value==="final2"&&total<3)o.disabled=true;
    if(o.value==="semi4"&&total<4)o.disabled=true;
    if(o.value==="lideresFinal"&&total<4)o.disabled=true;
    if(o.value==="top2grupo"&&total<4)o.disabled=true;
    if(o.value==="lideres4Semi"&&total<4)o.disabled=true;
    if(o.value==="top2Quarta"&&total<8)o.disabled=true;
  });

  const firstEnabled=[...sel.options].find(o=>!o.disabled);
  if(firstEnabled)sel.value=firstEnabled.value;
  updateClassificationRuleDetails();
}

function updateClassificationRuleDetails(){
  const selected=$("regraClassificacao").selectedOptions[0];
  $("detalhesRegraClassificacao").textContent=selected?.dataset.detail||"Escolha uma opção para ver como funcionará a classificação.";
}
function chooseFormat(f,b){state.wizard.formato=f;document.querySelectorAll(".format-card").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");$("configGrupos").classList.toggle("hidden",f!=="grupos");if(f==="eliminatoria"){state.wizard.quantidadeGrupos=0;state.wizard.regraClassificacao="";generateStructure();review();}}
function confirmGroups(){state.wizard.quantidadeGrupos=Number($("quantidadeGrupos").value);if(state.wizard.quantidadeGrupos>state.wizard.participantes.length)return toast("Há mais grupos do que participantes.");state.wizard.regraClassificacao=$("regraClassificacao").value;generateStructure();review();}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function emptyGame(fase,round,index){
  return{
    id:crypto.randomUUID(),
    fase,round,index,
    numeroJogo:null,
    casaId:null,foraId:null,
    casa:"A definir",fora:"A definir",
    encerrado:false,
    placarCasa:null,placarFora:null,
    situacao:"normal",
    data:"",hora:"",local:"",
    gols:[],sets:[]
  };
}

function phaseName(size){
  if(size===2)return"Final";
  if(size===4)return"Semifinal";
  if(size===8)return"Quartas de final";
  if(size===16)return"Oitavas de final";
  if(size===32)return"16 avos de final";
  if(size===64)return"32 avos de final";
  if(size===128)return"64 avos de final";
  return`Fase de ${size}`;
}

function highestPowerOfTwoAtMost(n){
  return 2**Math.floor(Math.log2(Math.max(2,n)));
}

function buildMainBracket(slots,startRound){
  const rounds=[];
  let currentSlots=[...slots];
  let round=startRound;

  while(currentSlots.length>=2){
    const phaseSize=currentSlots.length;
    const games=[];

    for(let i=0;i<currentSlots.length;i+=2){
      const g=emptyGame(phaseName(phaseSize),round,i/2);
      const a=currentSlots[i];
      const b=currentSlots[i+1];

      if(a && !a.sourceGameId){
        g.casaId=a.id;
        g.casa=a.nome;
      }
      if(b && !b.sourceGameId){
        g.foraId=b.id;
        g.fora=b.nome;
      }

      games.push(g);
    }

    rounds.push(games);

    if(currentSlots.length===2)break;
    currentSlots=Array.from({length:currentSlots.length/2},()=>null);
    round++;
  }

  for(let r=0;r<rounds.length-1;r++){
    rounds[r].forEach((g,i)=>{
      g.nextMatchId=rounds[r+1][Math.floor(i/2)].id;
      g.nextSlot=i%2===0?"casa":"fora";
    });
  }

  return rounds;
}

function makeBracket(seedNames){
  const participants=[...seedNames];
  const n=participants.length;
  if(n<2)return[];

  const target=highestPowerOfTwoAtMost(n);
  const preliminaryMatches=n-target;
  const flat=[];

  if(preliminaryMatches===0){
    const rounds=buildMainBracket(participants,0);
    rounds.forEach(r=>flat.push(...r));
  }else{
    // Somente os jogadores necessários disputam a fase preliminar.
    // Os demais avançam diretamente para a fase seguinte.
    const preliminaryPlayers=participants.slice(0,preliminaryMatches*2);
    const byePlayers=participants.slice(preliminaryMatches*2);
    const preliminaryGames=[];

    for(let i=0;i<preliminaryMatches;i++){
      const a=preliminaryPlayers[i*2];
      const b=preliminaryPlayers[i*2+1];
      const g=emptyGame(phaseName(target*2),0,i);
      g.casaId=a.id; g.casa=a.nome;
      g.foraId=b.id; g.fora=b.nome;
      preliminaryGames.push(g);
    }

    // Distribui as vagas da preliminar entre os classificados diretos.
    const slots=Array(target).fill(null);
    const placeholderPositions=[];
    for(let i=0;i<preliminaryMatches;i++){
      let position=Math.floor(i*target/preliminaryMatches);
      while(slots[position]!==null)position=(position+1)%target;
      slots[position]={sourceGameId:preliminaryGames[i].id};
      placeholderPositions.push(position);
    }

    let byeIndex=0;
    for(let i=0;i<target;i++){
      if(slots[i]===null)slots[i]=byePlayers[byeIndex++];
    }

    const mainRounds=buildMainBracket(slots,1);
    const firstMainRound=mainRounds[0];

    placeholderPositions.forEach((position,i)=>{
      const next=firstMainRound[Math.floor(position/2)];
      preliminaryGames[i].nextMatchId=next.id;
      preliminaryGames[i].nextSlot=position%2===0?"casa":"fora";
    });

    flat.push(...preliminaryGames);
    mainRounds.forEach(r=>flat.push(...r));
  }

  const semis=flat.filter(g=>g.fase==="Semifinal");
  if(semis.length===2){
    const finalRound=Math.max(...flat.map(g=>g.round));
    const third=emptyGame("Disputa de 3º lugar",finalRound,1);
    third.isThirdPlace=true;
    semis[0].loserNextMatchId=third.id;
    semis[0].loserNextSlot="casa";
    semis[1].loserNextMatchId=third.id;
    semis[1].loserNextSlot="fora";
    flat.push(third);
  }

  return flat;
}

function assignGameNumbers(c){
  let number=1;

  (c.jogos||[]).forEach(g=>{
    g.numeroJogo=number++;
  });

  const ordered=[...(c.eliminatorias||[])].sort((a,b)=>{
    if(a.round!==b.round)return a.round-b.round;
    if(a.fase==="Disputa de 3º lugar"&&b.fase==="Final")return-1;
    if(a.fase==="Final"&&b.fase==="Disputa de 3º lugar")return 1;
    return(a.index||0)-(b.index||0);
  });

  ordered.forEach(g=>{
    g.numeroJogo=number++;
  });
}

function generateStructure(){const parts=shuffle(state.wizard.participantes);state.wizard.grupos=[];state.wizard.jogos=[];state.wizard.eliminatorias=[];if(state.wizard.formato==="grupos"){const q=Math.max(1,state.wizard.quantidadeGrupos);for(let i=0;i<q;i++)state.wizard.grupos.push({nome:String.fromCharCode(65+i),participantes:[]});parts.forEach((p,i)=>state.wizard.grupos[i%q].participantes.push(p));state.wizard.grupos.forEach(g=>{let rodada=1;for(let i=0;i<g.participantes.length;i++)for(let j=i+1;j<g.participantes.length;j++){const a=g.participantes[i],b=g.participantes[j];state.wizard.jogos.push({...emptyGame(`Grupo ${g.nome}`,0,rodada-1),rodada,casaId:a.id,foraId:b.id,casa:a.nome,fora:b.nome});rodada++;}});if(state.wizard.regraClassificacao!=="campeaoGrupo"){
      let count=0;
      if(["final2","lideresFinal"].includes(state.wizard.regraClassificacao)) count=2;
      else if(["semi4","top2grupo","lideres4Semi"].includes(state.wizard.regraClassificacao)) count=4;
      else if(state.wizard.regraClassificacao==="top2Quarta") count=8;
      else count=Math.max(2,state.wizard.grupos.length*2);

      const seeds = createQualificationSeeds(state.wizard, count);
      state.wizard.eliminatorias = makeBracket(seeds);
    }}else state.wizard.eliminatorias=makeBracket(parts);assignGameNumbers(state.wizard);}

function createQualificationSeeds(c, count){
  const groups = c.grupos || [];
  const rule = c.regraClassificacao;

  if(rule === "final2" && groups.length === 1){
    return [
      {id:"vaga-1", nome:"1º colocado do grupo"},
      {id:"vaga-2", nome:"2º colocado do grupo"}
    ];
  }

  if(rule === "semi4" && groups.length === 1){
    return [
      {id:"vaga-1", nome:"1º colocado do grupo"},
      {id:"vaga-4", nome:"4º colocado do grupo"},
      {id:"vaga-2", nome:"2º colocado do grupo"},
      {id:"vaga-3", nome:"3º colocado do grupo"}
    ];
  }

  if(rule === "lideresFinal" && groups.length === 2){
    return [
      {id:"vaga-A1", nome:"1º do Grupo A"},
      {id:"vaga-B1", nome:"1º do Grupo B"}
    ];
  }

  if(rule === "top2grupo" && groups.length === 2){
    return [
      {id:"vaga-A1", nome:"1º do Grupo A"},
      {id:"vaga-B2", nome:"2º do Grupo B"},
      {id:"vaga-B1", nome:"1º do Grupo B"},
      {id:"vaga-A2", nome:"2º do Grupo A"}
    ];
  }

  if(rule==="lideres4Semi"&&groups.length===4){
    return [
      {id:"vaga-A1",nome:"1º do Grupo A"},
      {id:"vaga-D1",nome:"1º do Grupo D"},
      {id:"vaga-B1",nome:"1º do Grupo B"},
      {id:"vaga-C1",nome:"1º do Grupo C"}
    ];
  }

  if(rule==="top2Quarta"&&groups.length===4){
    return [
      {id:"vaga-A1",nome:"1º do Grupo A"},
      {id:"vaga-B2",nome:"2º do Grupo B"},
      {id:"vaga-B1",nome:"1º do Grupo B"},
      {id:"vaga-A2",nome:"2º do Grupo A"},
      {id:"vaga-C1",nome:"1º do Grupo C"},
      {id:"vaga-D2",nome:"2º do Grupo D"},
      {id:"vaga-D1",nome:"1º do Grupo D"},
      {id:"vaga-C2",nome:"2º do Grupo C"}
    ];
  }

  if(rule === "lideresMataMata"){
    return groups.map(g => ({id:`vaga-${g.nome}1`, nome:`1º do Grupo ${g.nome}`}));
  }

  if(rule === "top2grupo"){
    const leaders = groups.map(g => ({id:`vaga-${g.nome}1`, nome:`1º do Grupo ${g.nome}`}));
    const seconds = groups.map(g => ({id:`vaga-${g.nome}2`, nome:`2º do Grupo ${g.nome}`}));
    return [...leaders, ...seconds].slice(0, count);
  }

  if(rule === "melhores4"){
    return Array.from({length:4},(_,i)=>({id:`vaga-geral-${i+1}`,nome:`${i+1}º melhor classificado`}));
  }

  return Array.from({length:count},(_,i)=>({id:`vaga-${i+1}`,nome:`Vaga ${i+1}`}));
}

function groupStageComplete(c){
  return (c.jogos || []).every(j =>
    j.encerrado || j.situacao === "cancelado"
  );
}

function overallGroupRanking(c){
  const all = [];
  (c.grupos || []).forEach(g => {
    standings(c,g).forEach((s,index) => {
      all.push({...s, group:g.nome, position:index+1});
    });
  });
  return all.sort((a,b)=>
    b.pts-a.pts ||
    (b.gp-b.gc)-(a.gp-a.gc) ||
    b.gp-a.gp ||
    a.nome.localeCompare(b.nome)
  );
}

function qualifiedTeams(c){
  if(!groupStageComplete(c)) return [];

  const groups = c.grupos || [];
  const rule = c.regraClassificacao;

  if(rule === "final2" && groups.length === 1){
    return standings(c,groups[0]).slice(0,2);
  }

  if(rule === "semi4" && groups.length === 1){
    const s = standings(c,groups[0]);
    return [s[0],s[3],s[1],s[2]].filter(Boolean);
  }

  if(rule === "lideresFinal" && groups.length === 2){
    return [standings(c,groups[0])[0], standings(c,groups[1])[0]].filter(Boolean);
  }

  if(rule === "top2grupo" && groups.length === 2){
    const a = standings(c,groups[0]);
    const b = standings(c,groups[1]);
    return [a[0],b[1],b[0],a[1]].filter(Boolean);
  }

  if(rule==="lideres4Semi"&&groups.length===4){
    const a=standings(c,groups[0]),b=standings(c,groups[1]),cc=standings(c,groups[2]),d=standings(c,groups[3]);
    return [a[0],d[0],b[0],cc[0]].filter(Boolean);
  }

  if(rule==="top2Quarta"&&groups.length===4){
    const a=standings(c,groups[0]),b=standings(c,groups[1]),cc=standings(c,groups[2]),d=standings(c,groups[3]);
    return [a[0],b[1],b[0],a[1],cc[0],d[1],d[0],cc[1]].filter(Boolean);
  }

  if(rule === "lideresMataMata"){
    return groups.map(g=>standings(c,g)[0]).filter(Boolean);
  }

  if(rule === "top2grupo"){
    const first = groups.map(g=>standings(c,g)[0]).filter(Boolean);
    const second = groups.map(g=>standings(c,g)[1]).filter(Boolean);
    return [...first,...second];
  }

  if(rule === "melhores4"){
    return overallGroupRanking(c).slice(0,4);
  }

  return [];
}

function seedKnockoutWithTeamNames(c){
  if(c.formato !== "grupos" || !(c.eliminatorias || []).length) return false;
  if(!groupStageComplete(c)) return false;

  const qualified = qualifiedTeams(c);
  const firstRound = (c.eliminatorias || [])
    .filter(g=>g.round===0)
    .sort((a,b)=>a.index-b.index);

  if(!qualified.length || !firstRound.length) return false;

  firstRound.forEach((game,i)=>{
    const home = qualified[i*2];
    const away = qualified[i*2+1];

    if(home){
      game.casaId = home.id;
      game.casa = home.nome;
    }
    if(away){
      game.foraId = away.id;
      game.fora = away.nome;
    }
  });

  // Nos formatos com apenas uma final, o bronze é definido diretamente pela classificação.
  autoAdvanceByes(c.eliminatorias);
  return true;
}

function autoAdvanceByes(bracket){
  let changed = true;
  while(changed){
    changed = false;
    bracket.forEach(game=>{
      if(game.encerrado || !game.nextMatchId) return;
      const onlyHome = game.casaId && !game.foraId;
      const onlyAway = !game.casaId && game.foraId;
      if(!onlyHome && !onlyAway) return;

      game.encerrado = true;
      game.situacao = "classificacaoDireta";
      game.placarCasa = null;
      game.placarFora = null;

      const winner = onlyHome
        ? {id:game.casaId,nome:game.casa}
        : {id:game.foraId,nome:game.fora};

      propagateWinner(bracket,game,winner);
      changed = true;
    });
  }
}

function propagateWinner(bracket,game,winner){
  if(!game.nextMatchId || !winner) return;
  const next = bracket.find(g=>g.id===game.nextMatchId);
  if(!next) return;

  if(game.nextSlot === "casa"){
    next.casaId = winner.id;
    next.casa = winner.nome;
  }else{
    next.foraId = winner.id;
    next.fora = winner.nome;
  }
}

function propagateLoser(bracket,game,loser){
  if(!game.loserNextMatchId||!loser)return;
  const next=bracket.find(g=>g.id===game.loserNextMatchId);
  if(!next)return;
  if(game.loserNextSlot==="casa"){next.casaId=loser.id;next.casa=loser.nome;}
  else{next.foraId=loser.id;next.fora=loser.nome;}
}
function gameLoser(game){
  const win=gameWinner(game);
  if(!win)return null;
  return game.casaId===win.id?{id:game.foraId,nome:game.fora}:{id:game.casaId,nome:game.casa};
}
function gameWinner(game){
  if(!game || !game.encerrado) return null;
  if(["woDuplo","cancelado","adiado","classificacaoDireta"].includes(game.situacao)){
    if(game.situacao === "classificacaoDireta"){
      if(game.casaId && !game.foraId) return {id:game.casaId,nome:game.casa};
      if(game.foraId && !game.casaId) return {id:game.foraId,nome:game.fora};
    }
    return null;
  }
  if(game.placarCasa===game.placarFora){
    if(game.vencedorPenaltisId){
      return game.vencedorPenaltisId===game.casaId
        ? {id:game.casaId,nome:game.casa}
        : {id:game.foraId,nome:game.fora};
    }
    return null;
  }
  return game.placarCasa > game.placarFora
    ? {id:game.casaId,nome:game.casa}
    : {id:game.foraId,nome:game.fora};
}

function knockoutComplete(c){
  const final = (c.eliminatorias || []).find(g=>g.fase==="Final");
  return !!gameWinner(final);
}


function directBronzeWinner(c){
  if(c.regraClassificacao==="final2"&&c.grupos.length===1){
    return standings(c,c.grupos[0])[2]||null;
  }

  if(c.regraClassificacao==="lideresFinal"&&c.grupos.length===2){
    const secondA=standings(c,c.grupos[0])[1];
    const secondB=standings(c,c.grupos[1])[1];
    return [secondA,secondB].filter(Boolean).sort((a,b)=>
      b.pts-a.pts ||
      (b.gp-b.gc)-(a.gp-a.gc) ||
      b.gp-a.gp ||
      a.nome.localeCompare(b.nome)
    )[0]||null;
  }

  return null;
}

async function finishChampionship(){
  const c = JSON.parse(JSON.stringify(state.current));
  let podium = null;

  if(c.formato === "grupos" && c.regraClassificacao === "campeaoGrupo"){
    if(!groupStageComplete(c)) return toast("Finalize todos os jogos do grupo.");
    const ranking = standings(c,c.grupos[0]);
    podium = {
      primeiro: ranking[0]?.nome || "",
      segundo: ranking[1]?.nome || "",
      terceiro: ranking[2]?.nome || ""
    };
  }else{
    const final = (c.eliminatorias || []).find(g=>g.fase==="Final");
    const champion = gameWinner(final);
    if(!champion) return toast("Finalize a partida final antes de encerrar.");

    const vice=final.casaId===champion.id?final.fora:final.casa;
    const directBronze=directBronzeWinner(c);

    if(directBronze){
      podium={primeiro:champion.nome,segundo:vice,terceiro:directBronze.nome};
    }else{
      const thirdGame=(c.eliminatorias||[]).find(g=>g.fase==="Disputa de 3º lugar");
      const thirdWinner=gameWinner(thirdGame);
      if(!thirdWinner)return toast("Finalize também a disputa de terceiro lugar.");
      podium={primeiro:champion.nome,segundo:vice,terceiro:thirdWinner.nome};
    }
  }

  c.status = "encerrado";
  c.podio = podium;

  await updateDoc(
    doc(db,"escolas",state.school.id,"campeonatos",c.id),
    {status:"encerrado",podio,atualizadoEm:serverTimestamp()}
  );

  state.current = c;
  openCompetition(c,true);
  toast("Campeonato finalizado.");
}

async function reopenChampionship(){
  const c = {...state.current,status:"aberto"};
  await updateDoc(
    doc(db,"escolas",state.school.id,"campeonatos",c.id),
    {status:"aberto",atualizadoEm:serverTimestamp()}
  );
  state.current = c;
  openCompetition(c,true);
  toast("Campeonato reaberto.");
}

function review(){const w=state.wizard,rule=w.tipoPlacar==="sets"?(w.formatoSets==="unico"?`1 set até ${w.pontosSetNormal}`:`${w.formatoSets==="melhor3"?"Melhor de 3":"Melhor de 5"} · sets até ${w.pontosSetNormal} · tie-break até ${w.pontosTieBreak}`):"Pontos ou gols";$("resumoCampeonato").innerHTML=`<div class="summary-list"><div class="summary-line"><strong>Turno</strong><span>${esc(w.turno)}</span></div><div class="summary-line"><strong>Esporte</strong><span>${esc(w.esporte)}</span></div><div class="summary-line"><strong>Modalidade</strong><span>${esc(w.modalidade)}</span></div><div class="summary-line"><strong>Participantes</strong><span>${w.participantes.length}</span></div><div class="summary-line"><strong>Regra</strong><span>${esc(rule)}</span></div><div class="summary-line"><strong>Formato</strong><span>${w.formato==="grupos"?"Grupos + eliminatórias":"Eliminatórias"}</span></div>${w.formato==="grupos"?`<div class="summary-line"><strong>Classificação</strong><span>${esc($("regraClassificacao").selectedOptions[0]?.textContent||"")}</span></div>`:""}</div>`;renderPreview();show("telaRevisao");}
function renderPreview(){const box=$("previewEstrutura");box.innerHTML="";state.wizard.grupos.forEach(g=>{const e=document.createElement("div");e.className="group-card";e.innerHTML=`<h3>Grupo ${g.nome}</h3>${g.participantes.map(p=>`<div class="group-team">${esc(p.nome)}</div>`).join("")}`;box.appendChild(e);});if(state.wizard.eliminatorias.length){const e=document.createElement("div");e.className="group-card";e.innerHTML=`<h3>Eliminatórias</h3>${state.wizard.eliminatorias.filter(g=>g.round===0).map(j=>`<div class="bracket-game"><strong>${esc(j.casa)} × ${esc(j.fora)}</strong><small>${j.fase} · Os nomes reais aparecerão automaticamente após a definição dos classificados.</small></div>`).join("")}`;box.appendChild(e);}}
async function saveChamp(){load(true);try{const d={...state.wizard};delete d.id;delete d.playerTeamId;d.atualizadoEm=serverTimestamp();if(state.wizard.id)await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",state.wizard.id),d);else{d.criadoEm=serverTimestamp();await addDoc(campsRef(),d);}toast(state.wizard.id?"Campeonato atualizado.":"Campeonato criado.");
    if(state.wizard.id){
      state.current={...state.current,...d,id:state.wizard.id};
    }
    state.wizard=newWizard();state.editReturn=false;show("telaProfessor");}catch(e){console.error(e);toast("Erro ao salvar.");}finally{load(false);}}

function openEditCompetition(){
  if(!state.current||!state.admin)return;
  $("editarTurno").value=state.current.turno||"Matutino";
  $("editarEsporte").value=state.current.esporte||"";
  $("editarModalidade").value=state.current.modalidade||"Misto";
  show("telaEditarCompeticao");
}

async function saveBasicCompetitionData(){
  const turno=$("editarTurno").value;
  const esporte=$("editarEsporte").value.trim();
  const modalidade=$("editarModalidade").value;
  if(!esporte)return toast("Informe o esporte.");

  load(true);
  try{
    await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",state.current.id),{
      turno,esporte,modalidade,atualizadoEm:serverTimestamp()
    });
    state.current={...state.current,turno,esporte,modalidade};
    toast("Dados básicos atualizados.");
    openCompetition(state.current,true);
  }catch(e){console.error(e);toast("Erro ao salvar alterações.");}
  finally{load(false);}
}

function startStructuralEdit(section){
  if(!state.current)return;
  const hasResults=allGames(state.current).some(g=>g.encerrado);
  if(hasResults&&!confirm("Esta competição já possui resultados. Ao salvar alterações estruturais, o sorteio e os resultados poderão ser apagados. Continuar?"))return;

  state.wizard=JSON.parse(JSON.stringify(state.current));
  state.wizard.id=state.current.id;
  state.editReturn=true;

  if(section==="participantes"){
    prepareParticipants();
    show("telaParticipantes");
  }else if(section==="regras"){
    openRules();
  }else if(section==="formato"){
    renderRules();
    $("quantidadeGrupos").value=String(state.wizard.quantidadeGrupos||1);
    updateGroupRules();
    show("telaFormato");
  }
}

function matchupKey(g){
  return [g.casa,g.fora].sort().join("|||");
}

async function regenerateCompetition(){
  if(!state.current||!state.admin)return;
  const preserve=confirm("Deseja manter datas, horários e locais dos confrontos que continuarem iguais?\n\nOK = manter agenda possível\nCancelar = apagar agenda");
  if(!confirm("O sorteio será refeito e todos os resultados serão apagados. Continuar?"))return;

  const oldGames=allGames(state.current);
  const scheduleByMatch=new Map();
  if(preserve){
    oldGames.forEach(g=>scheduleByMatch.set(matchupKey(g),{data:g.data||"",hora:g.hora||"",local:g.local||""}));
  }

  state.wizard=JSON.parse(JSON.stringify(state.current));
  generateStructure();

  if(preserve){
    [...state.wizard.jogos,...state.wizard.eliminatorias].forEach(g=>{
      const schedule=scheduleByMatch.get(matchupKey(g));
      if(schedule)Object.assign(g,schedule);
    });
  }

  const update={
    grupos:state.wizard.grupos,jogos:state.wizard.jogos,eliminatorias:state.wizard.eliminatorias,
    podio:null,status:"aberto",atualizadoEm:serverTimestamp()
  };

  load(true);
  try{
    await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",state.current.id),update);
    state.current={...state.current,...update};
    toast("Competição reorganizada.");
    openCompetition(state.current,true);
  }catch(e){console.error(e);toast("Erro ao reorganizar.");}
  finally{load(false);}
}

function editChamp(c){if((c.jogos||[]).some(j=>j.encerrado)&&!confirm("Editar e salvar poderá refazer a estrutura. Continuar?"))return;state.wizard=JSON.parse(JSON.stringify(c));state.wizard.id=c.id;prepareParticipants();show("telaParticipantes");}
async function deleteChamp(c){
  if(!confirm(`Excluir definitivamente ${c.esporte} — ${c.modalidade}?`))return;
  if(!confirm("Esta ação não pode ser desfeita. Deseja realmente excluir?"))return;await deleteDoc(doc(db,"escolas",state.school.id,"campeonatos",c.id));toast("Campeonato excluído.");}

function favoriteStorageKey(){
  return `interclasses-favoritos-${state.school?.id||"sem-escola"}`;
}
function getFavorites(){
  try{return JSON.parse(localStorage.getItem(favoriteStorageKey())||"[]");}catch{return[];}
}
function saveFavorites(list){
  localStorage.setItem(favoriteStorageKey(),JSON.stringify(list));
}
function toggleCurrentFavorite(){
  if(!state.current)return;
  let list=getFavorites();
  list=list.includes(state.current.id)?list.filter(id=>id!==state.current.id):[...list,state.current.id];
  saveFavorites(list);
  updateFavoriteButton();
  renderStudentFavorites();
}
function updateFavoriteButton(){
  const btn=$("btnFavoritar");
  if(!btn||!state.current)return;
  const active=getFavorites().includes(state.current.id);
  btn.textContent=active?"★ Remover dos favoritos":"☆ Favoritar competição";
  btn.classList.toggle("active",active);
}
function renderStudentFavorites(){
  const box=$("favoritosAluno");
  if(!box)return;
  const ids=getFavorites();
  const camps=(state.allChampionships||[]).filter(c=>ids.includes(c.id)&&c.publicado!==false);
  box.innerHTML="";
  if(!camps.length)return;
  const title=document.createElement("strong");
  title.textContent="Favoritos";
  box.appendChild(title);
  camps.forEach(c=>{
    const row=document.createElement("div");
    row.className="favorite-chip";
    row.innerHTML=`<div><strong>${sportIcon(c.esporte)} ${esc(c.esporte)} — ${esc(c.modalidade)}</strong><small>${esc(c.turno)}</small></div><button class="ghost">Abrir</button>`;
    row.querySelector("button").onclick=()=>openCompetition(c,false);
    box.appendChild(row);
  });
}
function filterStudentCompetitions(){
  const term=norm($("buscaCompeticaoAluno").value);
  const all=(state.allChampionships||[]).filter(c=>c.publicado!==false);
  if(!term){listenStudent();return;}
  const filtered=all.filter(c=>norm(`${c.esporte} ${c.modalidade} ${c.turno}`).includes(term));
  const box=$("turnosAluno");
  box.innerHTML="";
  if(!filtered.length){
    box.innerHTML='<div class="card muted" style="grid-column:1/-1">Nenhuma competição encontrada.</div>';
    return;
  }
  filtered.forEach(c=>{
    const b=document.createElement("button");
    b.className="choice-card";
    b.innerHTML=`<span>${sportIcon(c.esporte)}</span><strong>${esc(c.esporte)}</strong><small>${esc(c.modalidade)} · ${esc(c.turno)}</small>`;
    b.onclick=()=>openCompetition(c,false);
    box.appendChild(b);
  });
}

function openStudentList(turn,camps){$("alunoTurnoLabel").textContent=turn;const box=$("listaCampeonatosAluno");box.innerHTML="";camps.forEach(c=>{const b=document.createElement("button");b.className="school-item";b.innerHTML=`<span>${sportIcon(c.esporte)}</span><div><strong>${esc(c.esporte)} — ${esc(c.modalidade)}</strong><small>${c.participantes?.length||0} participantes · ${c.status==="encerrado"?"Encerrado":"Em andamento"}</small></div>`;b.onclick=()=>openCompetition(c,false);box.appendChild(b);});show("telaListaAluno");}

function renderStudentDashboard(c){
  const box=$("dashboardAluno");
  const finished=allGames(c).filter(g=>g.encerrado).length;
  const total=allGames(c).length;
  const participants=(c.participantes||[]).length;

  let leader="—";
  if(c.formato==="grupos"&&c.grupos?.length){
    leader=overallGroupRanking(c)[0]?.nome||"—";
  }else if(c.status==="encerrado"&&c.podio){
    leader=c.podio.primeiro||"—";
  }

  box.innerHTML=`
    <div class="dash-card"><small>Jogos</small><strong>${finished}/${total}</strong></div>
    <div class="dash-card"><small>Participantes</small><strong>${participants}</strong></div>
    <div class="dash-card"><small>${c.status==="encerrado"?"Campeão":"Líder"}</small><strong>${esc(leader)}</strong></div>`;
}


function hasScorerData(c){
  return c.esporte==="Futsal" &&
    (c.participantes||[]).some(p=>(p.jogadores||[]).length>0);
}

function configureCompetitionTabs(c){
  const upcoming=availableUpcomingGames(c);
  const results=allGames(c).filter(g=>g.encerrado);
  const hasGroups=c.formato==="grupos"&&(c.grupos||[]).length>0;
  const hasKnockout=(c.eliminatorias||[]).length>0;
  const finished=c.status==="encerrado"&&!!c.podio;

  const visibility={
    proximos:upcoming.length>0,
    resultados:results.length>0,
    classificacao:hasGroups,
    eliminatorias:hasKnockout,
    artilheiros:hasScorerData(c),
    estatisticas:true,
    podio:finished,
    resumoFinal:finished
  };

  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("hidden",!visibility[tab.dataset.tab]);
  });

  const preferred=["proximos","resultados","classificacao","eliminatorias","artilheiros","estatisticas","podio","resumoFinal"];
  return preferred.find(name=>visibility[name])||"estatisticas";
}

function openCompetition(c,admin){
  state.current=c;
  state.admin=admin||state.admin;

  $("tituloCompeticaoAluno").textContent=`${c.esporte} — ${c.modalidade}`;
  $("subCompeticaoAluno").textContent=`${c.turno} · ${c.formato==="grupos"?"Grupos + eliminatórias":"Eliminatórias"}`;

  $("acoesAdminCompeticao").classList.toggle("hidden",!admin);
  $("btnFinalizar").classList.toggle("hidden",c.status==="encerrado");
  $("btnReabrir").classList.toggle("hidden",c.status!=="encerrado");

  const status=$("statusCompeticao");
  status.textContent=c.status==="encerrado"?"Campeonato encerrado":"Campeonato em andamento";
  status.classList.toggle("finished",c.status==="encerrado");

  updateFavoriteButton();
  renderCompetitionQR(false);
  renderStudentDashboard(c);

  const initialTab=configureCompetitionTabs(c);
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("active",tab.dataset.tab===initialTab);
  });

  renderTab(initialTab,admin);
  show("telaCompeticaoAluno");
}

function currentEliminationRound(c){
  const pending=(c.eliminatorias||[])
    .filter(g=>!g.encerrado)
    .sort((a,b)=>a.round-b.round||(a.index||0)-(b.index||0));
  return pending.length?pending[0].round:null;
}

function isGameAvailable(c,g){
  const loc=locateGame(c,g.id);
  if(!loc)return false;
  if(loc.list==="jogos")return!g.encerrado;

  if(c.formato==="grupos"&&!groupsAreComplete(c))return false;

  const round=currentEliminationRound(c);
  return!g.encerrado&&g.round===round&&!!g.casaId&&!!g.foraId;
}

function availableUpcomingGames(c){
  const groupPending=(c.jogos||[]).filter(g=>!g.encerrado);
  if(groupPending.length)return groupPending;

  const round=currentEliminationRound(c);
  if(round===null)return[];

  return(c.eliminatorias||[]).filter(g=>
    !g.encerrado&&g.round===round&&g.casaId&&g.foraId
  );
}

function stableGameNumber(c,g){
  if(g.numeroJogo)return g.numeroJogo;
  const all=[...(c.jogos||[]),...(c.eliminatorias||[])];
  return Math.max(1,all.findIndex(x=>x.id===g.id)+1);
}

function allGames(c){return[...(c.jogos||[]),...(c.eliminatorias||[])];}
function formatSchedule(j){const p=[];if(j.data)p.push(new Date(j.data+"T12:00:00").toLocaleDateString("pt-BR"));if(j.hora)p.push(j.hora);if(j.local)p.push(j.local);return p.join(" · ");}
function renderTab(tab,admin=false){const c=state.current,box=$("conteudoAluno");box.innerHTML="";updateClassificationNote(tab,c);if(tab==="proximos"||tab==="resultados"){
    const list=tab==="proximos"?availableUpcomingGames(c):allGames(c).filter(j=>j.encerrado);

    if(!list.length){
      box.innerHTML=`<div class="card muted">${tab==="proximos"?"Nenhum próximo jogo.":"Nenhum resultado registrado."}</div>`;
      return;
    }

    const title=document.createElement("div");
    title.className="games-section-title";
    title.textContent=tab==="proximos"?"PRÓXIMOS JOGOS":"RESULTADOS";
    box.appendChild(title);

    list.forEach((j,index)=>{
      const card=document.createElement("div");
      card.className="simple-match-card";

      const score=j.encerrado
        ? `<div class="simple-score">${j.placarCasa??0} × ${j.placarFora??0}</div>`
        : `<div class="simple-versus">×</div>`;

      card.innerHTML=`
        <div class="simple-match-header">
          <span class="simple-match-number">Jogo ${stableGameNumber(c,j)}</span>
          <span class="simple-phase">${esc(j.fase||"")}</span>
        </div>

        <div class="horizontal-match">
          <div class="horizontal-team">${esc(j.casa)}</div>
          ${score}
          <div class="horizontal-team">${esc(j.fora)}</div>
        </div>

        ${j.vencedorPenaltisNome
          ? `<div class="penalty-result">Pênaltis: ${j.penaltisCasa} × ${j.penaltisFora}<br><strong>${esc(j.vencedorPenaltisNome)} venceu</strong></div>`
          : ""}
      `;

      if(admin){
        const button=document.createElement("button");
        button.className=tab==="proximos"?"launch-result-btn":"edit-result-btn";
        button.textContent=tab==="proximos"?"Lançar resultado":"Editar resultado";
        button.onclick=event=>{
          event.stopPropagation();
          openResult(j);
        };
        card.appendChild(button);

        card.classList.add("clickable");
        card.onclick=()=>openResult(j);
      }

      box.appendChild(card);
    });

    return;
  }
  if(tab==="classificacao")return renderClassification(c,box);if(tab==="eliminatorias")return renderKnockout(c,box);if(tab==="artilheiros")return renderScorers(c,box);if(tab==="estatisticas")return renderStatistics(c,box);if(tab==="podio")return renderPodium(c,box);if(tab==="resumoFinal")return renderFinalSummary(c,box);}
function standings(c,g){const st=g.participantes.map(p=>({id:p.id,nome:p.nome,pts:0,j:0,v:0,e:0,d:0,gp:0,gc:0})),by=Object.fromEntries(st.map(s=>[s.id,s]));(c.jogos||[]).filter(j=>j.fase===`Grupo ${g.nome}`&&j.encerrado&&j.situacao!=="cancelado"&&j.situacao!=="adiado").forEach(j=>{const a=by[j.casaId],b=by[j.foraId];if(!a||!b)return;a.j++;b.j++;const pc=+j.placarCasa||0,pf=+j.placarFora||0;a.gp+=pc;a.gc+=pf;b.gp+=pf;b.gc+=pc;if(pc>pf){a.v++;b.d++;a.pts+=3}else if(pf>pc){b.v++;a.d++;b.pts+=3}else{a.e++;b.e++;a.pts++;b.pts++;}});return st.sort((a,b)=>b.pts-a.pts||(b.gp-b.gc)-(a.gp-a.gc)||b.gp-a.gp);}

function qualifiedCountForGroup(c,groupIndex){
  if(c.quantidadeGrupos===1){
    if(c.regraClassificacao==="campeaoGrupo")return 1;
    if(c.regraClassificacao==="final2")return 2;
    if(c.regraClassificacao==="semi4")return 4;
  }
  if(c.quantidadeGrupos===2){
    if(c.regraClassificacao==="lideresFinal")return 1;
    if(c.regraClassificacao==="top2grupo")return 2;
  }
  if(c.quantidadeGrupos===4){
    if(c.regraClassificacao==="lideres4Semi")return 1;
    if(c.regraClassificacao==="top2Quarta")return 2;
  }
  return 0;
}

function classificationCriteriaText(c){
  const base="Critérios de desempate: pontos, saldo, pontos/gols/sets pró e ordem alfabética.";
  const rules={
    campeaoGrupo:"O 1º recebe ouro, o 2º prata e o 3º bronze.",
    final2:"1º e 2º fazem a final; o 3º recebe bronze direto.",
    semi4:"Os 4 primeiros fazem semifinais; os perdedores disputam o 3º lugar.",
    lideresFinal:"Os líderes fazem a final; o melhor 2º colocado recebe bronze.",
    top2grupo:"Os 2 melhores de cada grupo fazem semifinais e os perdedores disputam o 3º lugar.",
    lideres4Semi:"Os líderes dos 4 grupos fazem semifinais e os perdedores disputam o 3º lugar.",
    top2Quarta:"Os 2 melhores de cada grupo avançam às quartas; há semifinal, 3º lugar e final."
  };
  return `${rules[c.regraClassificacao]||""} ${base}`.trim();
}

function updateClassificationNote(tab,c){
  const note=$("criterioClassificacao");
  const visible=tab==="classificacao";
  note.classList.toggle("hidden",!visible);
  if(visible)note.textContent=classificationCriteriaText(c);
}

function renderClassification(c,box){
  if(c.formato!=="grupos"){
    box.innerHTML='<div class="card muted">Essa competição não possui fase de grupos.</div>';
    return;
  }

  c.grupos.forEach((g,groupIndex)=>{
    const st=standings(c,g);
    const qualified=qualifiedCountForGroup(c,groupIndex);
    const w=document.createElement("div");
    w.className="table-wrap";
    w.innerHTML=`<table>
      <thead><tr><th>Grupo ${g.nome}</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>PRÓ</th><th>CONTRA</th><th>SG</th></tr></thead>
      <tbody>${st.map((s,i)=>`<tr class="${i<qualified?"qualified":""}">
        <td>${i+1}º ${esc(s.nome)}${i<qualified?' <span title="Classificado">✓</span>':""}</td>
        <td>${s.pts}</td><td>${s.j}</td><td>${s.v}</td><td>${s.e}</td><td>${s.d}</td><td>${s.gp}</td><td>${s.gc}</td><td>${s.gp-s.gc}</td>
      </tr>`).join("")}</tbody>
    </table>`;
    box.appendChild(w);
  });
}
function renderKnockout(c,box){
  const games=c.eliminatorias||[];
  if(!games.length){
    box.innerHTML='<div class="card muted">Não há eliminatórias.</div>';
    return;
  }

  const phases=[...new Set(games.map(g=>g.fase))].sort((phaseA,phaseB)=>{
    const gamesA=games.filter(g=>g.fase===phaseA);
    const gamesB=games.filter(g=>g.fase===phaseB);
    const roundA=Math.min(...gamesA.map(g=>g.round));
    const roundB=Math.min(...gamesB.map(g=>g.round));

    if(roundA!==roundB)return roundA-roundB;
    if(phaseA==="Disputa de 3º lugar"&&phaseB==="Final")return-1;
    if(phaseA==="Final"&&phaseB==="Disputa de 3º lugar")return 1;
    return phaseA.localeCompare(phaseB);
  });

  const flow=document.createElement("div");
  flow.className="bracket-flow";
  flow.style.setProperty("--phases",phases.length);

  phases.forEach(phase=>{
    const column=document.createElement("div");
    column.className="bracket-column";
    column.innerHTML=`<h3>${esc(phase)}</h3>`;

    games
      .filter(g=>g.fase===phase)
      .sort((a,b)=>(a.index||0)-(b.index||0))
      .forEach(g=>{
        const winner=gameWinner(g);
        const card=document.createElement("div");
        card.className="bracket-match"+(phase==="Disputa de 3º lugar"?" third-place":"");

        card.innerHTML=`
          <small>Jogo ${stableGameNumber(c,g)}</small>
          <div class="bracket-team ${winner?.id===g.casaId?"winner":g.encerrado&&winner?"loser":""}">
            <span>${esc(g.casa)}</span><strong>${g.encerrado&&g.placarCasa!==null?g.placarCasa:""}</strong>
          </div>
          <div class="bracket-team ${winner?.id===g.foraId?"winner":g.encerrado&&winner?"loser":""}">
            <span>${esc(g.fora)}</span><strong>${g.encerrado&&g.placarFora!==null?g.placarFora:""}</strong>
          </div>
          ${g.vencedorPenaltisNome?`<small>Pênaltis: ${g.penaltisCasa} × ${g.penaltisFora} — ${esc(g.vencedorPenaltisNome)}</small>`:""}
        `;
        column.appendChild(card);
      });

    flow.appendChild(column);
  });

  box.appendChild(flow);
}
function renderScorers(c,box){const a=[];c.participantes.forEach(p=>(p.jogadores||[]).forEach(j=>a.push({...j,time:p.nome})));a.sort((x,y)=>(y.gols||0)-(x.gols||0));if(!a.length){box.innerHTML='<div class="card muted">Nenhum jogador cadastrado.</div>';return;}a.forEach((j,i)=>{const e=document.createElement("div");e.className="admin-item";e.innerHTML=`<div><strong>${i+1}º ${esc(j.nome)}</strong><small>${esc(j.time)}</small></div><strong>${j.gols||0} gols</strong>`;box.appendChild(e);});}
function renderPodium(c,box){if(!c.podio){box.innerHTML='<div class="card muted">O pódio aparecerá quando o campeonato for finalizado.</div>';return;}box.innerHTML=`<div class="podium"><div class="podium-place second"><span>🥈</span><strong>${esc(c.podio.segundo||"—")}</strong><small>2º lugar</small></div><div class="podium-place first"><span>🥇</span><strong>${esc(c.podio.primeiro||"—")}</strong><small>Campeão</small></div><div class="podium-place third"><span>🥉</span><strong>${esc(c.podio.terceiro||"—")}</strong><small>3º lugar</small></div></div>`;}
function locateGame(c,id){let i=(c.jogos||[]).findIndex(j=>j.id===id);if(i>=0)return{list:"jogos",i};i=(c.eliminatorias||[]).findIndex(j=>j.id===id);return i>=0?{list:"eliminatorias",i}:null;}
function openResult(g){
  if(!g.encerrado&&!isGameAvailable(state.current,g)){
    return toast("Finalize todos os jogos da fase anterior primeiro.");
  }

  state.currentGame=g;
  $("tituloJogoResultado").textContent=`Jogo ${stableGameNumber(state.current,g)} — ${g.casa} × ${g.fora}`;
  $("timeCasaNome").textContent=g.casa;
  $("timeForaNome").textContent=g.fora;
  $("dataJogo").value=g.data||"";
  $("horaJogo").value=g.hora||"";
  $("localJogo").value=g.local||"";
  $("situacaoJogo").value=g.situacao||"normal";
  $("placarSimplesBox").classList.toggle("hidden",state.current.tipoPlacar==="sets");
  $("placarSetsBox").classList.toggle("hidden",state.current.tipoPlacar!=="sets");
  $("golsFutsalBox").classList.toggle("hidden",state.current.esporte!=="Futsal");
  $("placarCasa").value=g.placarCasa??0;
  $("placarFora").value=g.placarFora??0;

  state.setDraft=JSON.parse(JSON.stringify(g.sets||[]));
  if(state.current.tipoPlacar==="sets"&&!state.setDraft.length){
    state.setDraft=[{casa:0,fora:0}];
  }

  renderSets();
  renderGoalInputs();
  updateGoalInputs();
  show("telaResultado");
}

function swapCurrentGameSides(){
  const g=state.currentGame;
  if(!g)return;

  [g.casa,g.fora]=[g.fora,g.casa];
  [g.casaId,g.foraId]=[g.foraId,g.casaId];

  const loc=locateGame(state.current,g.id);
  if(loc){
    state.current[loc.list][loc.i]=g;
  }

  const casaScore=$("placarCasa").value;
  $("placarCasa").value=$("placarFora").value;
  $("placarFora").value=casaScore;

  state.setDraft=state.setDraft.map(set=>({casa:set.fora,fora:set.casa}));
  (g.gols||[]).forEach(goal=>{
    goal.lado=goal.lado==="casa"?"fora":"casa";
  });

  const situation=$("situacaoJogo").value;
  if(situation==="woCasa")$("situacaoJogo").value="woFora";
  if(situation==="woFora")$("situacaoJogo").value="woCasa";

  $("timeCasaNome").textContent=g.casa;
  $("timeForaNome").textContent=g.fora;
  $("tituloJogoResultado").textContent=`Jogo ${stableGameNumber(state.current,g)} — ${g.casa} × ${g.fora}`;

  renderSets();
  renderGoalInputs();
  updateGoalInputs();
  toast("Lados invertidos.");
}
function renderSets(){const box=$("listaSets");box.innerHTML="";state.setDraft.forEach((s,i)=>{const row=document.createElement("div");row.className="set-row";row.innerHTML=`<strong>Set ${i+1}</strong><input type="number" min="0" value="${s.casa}" data-casa><input type="number" min="0" value="${s.fora}" data-fora><button class="danger">Excluir</button>`;row.querySelector("[data-casa]").oninput=e=>state.setDraft[i].casa=Math.max(0,+e.target.value||0);row.querySelector("[data-fora]").oninput=e=>state.setDraft[i].fora=Math.max(0,+e.target.value||0);row.querySelector("button").onclick=()=>{state.setDraft.splice(i,1);renderSets();};box.appendChild(row);});}
function renderGoalInputs(){const c=state.current,g=state.currentGame,a=c.participantes.find(p=>p.id===g.casaId),b=c.participantes.find(p=>p.id===g.foraId),box=$("golsFutsal");box.innerHTML=`<label>Gols de ${esc(g.casa)}</label><div id="golsCasaInputs"></div><label>Gols de ${esc(g.fora)}</label><div id="golsForaInputs"></div>`;box.dataset.casa=JSON.stringify(a?.jogadores||[]);box.dataset.fora=JSON.stringify(b?.jogadores||[]);}
function goalSelect(players,side){const s=document.createElement("select");s.dataset.side=side;s.innerHTML=`<option value="">Não informar</option><option value="golContra">Gol contra</option>${players.map(j=>`<option value="${j.id}">${esc(j.nome)}</option>`).join("")}`;return s;}
function updateGoalInputs(){if(state.current?.esporte!=="Futsal")return;const box=$("golsFutsal"),a=JSON.parse(box.dataset.casa||"[]"),b=JSON.parse(box.dataset.fora||"[]"),pc=Math.max(0,+$("placarCasa").value||0),pf=Math.max(0,+$("placarFora").value||0),ca=$("golsCasaInputs"),fo=$("golsForaInputs");ca.innerHTML="";fo.innerHTML="";for(let i=0;i<pc;i++)ca.appendChild(goalSelect(a,"casa"));for(let i=0;i<pf;i++)fo.appendChild(goalSelect(b,"fora"));}
function validateSets(c){if(!state.setDraft.length)return{ok:false,msg:"Adicione pelo menos um set."};const winsCasa=state.setDraft.filter(s=>s.casa>s.fora).length,winsFora=state.setDraft.filter(s=>s.fora>s.casa).length;if(state.setDraft.some(s=>s.casa===s.fora))return{ok:false,msg:"Um set não pode terminar empatado."};if(c.formatoSets==="unico"&&state.setDraft.length!==1)return{ok:false,msg:"Essa partida deve ter apenas 1 set."};const need=c.formatoSets==="melhor3"?2:c.formatoSets==="melhor5"?3:1;if(winsCasa!==need&&winsFora!==need)return{ok:false,msg:`O vencedor precisa ganhar ${need} set(s).`};return{ok:true,winsCasa,winsFora};}
async function saveGame(clear=false){const c=JSON.parse(JSON.stringify(state.current)),loc=locateGame(c,state.currentGame.id);if(!loc)return toast("Jogo não encontrado.");const g=c[loc.list][loc.i];if(clear){Object.assign(g,{encerrado:false,placarCasa:null,placarFora:null,situacao:"normal",gols:[],sets:[]});}else{g.data=$("dataJogo").value;g.hora=$("horaJogo").value;g.local=$("localJogo").value.trim();g.situacao=$("situacaoJogo").value;if(g.situacao==="adiado"||g.situacao==="cancelado"){g.encerrado=g.situacao==="cancelado";g.placarCasa=null;g.placarFora=null;}else if(c.tipoPlacar==="sets"){if(g.situacao==="normal"){const v=validateSets(c);if(!v.ok)return toast(v.msg);g.sets=state.setDraft;g.placarCasa=v.winsCasa;g.placarFora=v.winsFora;}else{g.sets=[];g.placarCasa=g.situacao==="woCasa"?3:0;g.placarFora=g.situacao==="woFora"?3:0;}g.encerrado=true;}else{let pc=Math.max(0,+$("placarCasa").value||0),pf=Math.max(0,+$("placarFora").value||0);if(g.situacao==="woCasa"){pc=3;pf=0}if(g.situacao==="woFora"){pc=0;pf=3}if(g.situacao==="woDuplo"){pc=0;pf=0}if(loc.list==="eliminatorias"&&g.situacao==="normal"&&pc===pf)return toast("Jogo eliminatório não pode terminar empatado.");g.placarCasa=pc;g.placarFora=pf;g.encerrado=true;g.gols=[];if(c.esporte==="Futsal"&&g.situacao==="normal")document.querySelectorAll("#golsFutsal select").forEach(s=>{if(s.value)g.gols.push({jogadorId:s.value,lado:s.dataset.side});});}}
recalcScorers(c);

if(c.formato==="grupos"){
  seedKnockoutWithTeamNames(c);
}

if(loc.list==="eliminatorias"){
  const winner=gameWinner(g);
  if(winner){
    propagateWinner(c.eliminatorias,g,winner);
    propagateLoser(c.eliminatorias,g,gameLoser(g));
  }
  autoAdvanceByes(c.eliminatorias);
}

load(true);try{await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",c.id),{jogos:c.jogos||[],eliminatorias:c.eliminatorias||[],participantes:c.participantes,atualizadoEm:serverTimestamp()});state.current=c;toast(clear?"Resultado apagado.":"Jogo salvo.");renderTab("proximos",true);show("telaCompeticaoAluno");}catch(e){console.error(e);toast("Erro ao salvar.");}finally{load(false);}}
function recalcScorers(c){c.participantes.forEach(p=>(p.jogadores||[]).forEach(j=>j.gols=0));allGames(c).forEach(g=>(g.gols||[]).forEach(x=>{if(x.jogadorId==="golContra")return;const p=c.participantes.find(p=>p.id===(x.lado==="casa"?g.casaId:g.foraId)),j=p?.jogadores?.find(j=>j.id===x.jogadorId);if(j)j.gols++;}));}

function openAgenda(){
  if(!state.current)return;
  const today=new Date().toISOString().slice(0,10);
  $("agendaDataInicial").value=$("agendaDataInicial").value||today;
  $("agendaLocais").value=$("agendaLocais").value||"Quadra principal";
  renderAgendaPreview(state.current);
  show("telaAgenda");
}

function addMinutes(date,minutes){
  return new Date(date.getTime()+minutes*60000);
}
function dateValue(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function timeValue(d){
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function renderAgendaPreview(c){
  const box=$("previewAgenda");
  box.innerHTML="<div class='section-title'><h3>Agenda atual</h3></div>";
  const games=allGames(c).sort((a,b)=>(a.data||"9999").localeCompare(b.data||"9999")||(a.hora||"99").localeCompare(b.hora||"99"));
  games.slice(0,20).forEach(g=>{
    const e=document.createElement("div");
    e.className="match-item";
    e.innerHTML=`<div class="match-time">${g.hora||"--:--"}</div><div><strong>${esc(g.casa)} × ${esc(g.fora)}</strong><small>${g.data?new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR"):"Sem data"} · ${esc(g.local||"Local não definido")}</small></div>`;
    box.appendChild(e);
  });
}

async function generateAgenda(){
  const date=$("agendaDataInicial").value;
  const start=$("agendaHoraInicial").value;
  const finish=$("agendaHoraFinal").value;
  const interval=Math.max(5,Number($("agendaIntervalo").value||30));
  const locations=$("agendaLocais").value.split("\n").map(x=>x.trim()).filter(Boolean);
  const onlyEmpty=$("agendaApenasVazios").checked;

  if(!date||!start||!finish)return toast("Informe data e horários.");
  if(!locations.length)return toast("Informe pelo menos um local.");

  const c=JSON.parse(JSON.stringify(state.current));
  const games=allGames(c).filter(g=>!onlyEmpty||!g.data);
  let cursor=new Date(`${date}T${start}:00`);
  const [finishH,finishM]=finish.split(":").map(Number);
  let courtIndex=0;

  games.forEach(g=>{
    const dayEnd=new Date(cursor);
    dayEnd.setHours(finishH,finishM,0,0);

    if(cursor>dayEnd){
      cursor.setDate(cursor.getDate()+1);
      const [h,m]=start.split(":").map(Number);
      cursor.setHours(h,m,0,0);
      courtIndex=0;
    }

    g.data=dateValue(cursor);
    g.hora=timeValue(cursor);
    g.local=locations[courtIndex%locations.length];

    courtIndex++;
    if(courtIndex%locations.length===0)cursor=addMinutes(cursor,interval);
  });

  load(true);
  try{
    await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",c.id),{
      jogos:c.jogos||[],eliminatorias:c.eliminatorias||[],atualizadoEm:serverTimestamp()
    });
    state.current=c;
    renderAgendaPreview(c);
    toast("Agenda gerada.");
  }catch(e){console.error(e);toast("Erro ao gerar agenda.");}
  finally{load(false);}
}


function renderStatistics(c,box){
  const games=allGames(c);
  const done=games.filter(g=>g.encerrado&&g.situacao!=="cancelado");
  const score=done.reduce((s,g)=>s+(Number(g.placarCasa)||0)+(Number(g.placarFora)||0),0);
  const teams=c.participantes||[];
  const groupStats=c.formato==="grupos"?overallGroupRanking(c):[];
  let bestAttack=groupStats[0],bestDefense=groupStats[0];
  groupStats.forEach(s=>{
    if(!bestAttack||s.gp>bestAttack.gp)bestAttack=s;
    if(!bestDefense||s.gc<bestDefense.gc)bestDefense=s;
  });
  let biggest=null,diff=-1;
  done.forEach(g=>{
    const d=Math.abs((Number(g.placarCasa)||0)-(Number(g.placarFora)||0));
    if(d>diff){diff=d;biggest=g;}
  });
  box.innerHTML=`
    <div class="metric-list">
      <div class="metric"><strong>${games.length}</strong><small>Jogos</small></div>
      <div class="metric"><strong>${done.length}</strong><small>Encerrados</small></div>
      <div class="metric"><strong>${score}</strong><small>${c.tipoPlacar==="sets"?"Sets vencidos":"Pontos/gols"}</small></div>
      <div class="metric"><strong>${teams.length}</strong><small>Participantes</small></div>
    </div>
    <div class="card"><h3>Maior goleada/diferença</h3><p>${biggest?`${esc(biggest.casa)} ${biggest.placarCasa} × ${biggest.placarFora} ${esc(biggest.fora)}`:"Ainda não disponível."}</p></div>
    <div class="card"><h3>Melhor ataque</h3><p>${bestAttack?`${esc(bestAttack.nome)} — ${bestAttack.gp}`:"Disponível após a fase de grupos."}</p></div>
    <div class="card"><h3>Melhor defesa</h3><p>${bestDefense?`${esc(bestDefense.nome)} — ${bestDefense.gc} sofridos`:"Disponível após a fase de grupos."}</p></div>`;
}
function renderFinalSummary(c,box){
  if(c.status!=="encerrado"||!c.podio){
    box.innerHTML='<div class="card muted">O resumo final será liberado após o encerramento do campeonato.</div>';
    return;
  }
  const games=allGames(c);
  const scorers=[];
  (c.participantes||[]).forEach(p=>(p.jogadores||[]).forEach(j=>scorers.push({...j,time:p.nome})));
  scorers.sort((a,b)=>(b.gols||0)-(a.gols||0));
  box.innerHTML=`
    <div class="summary-final">
      <div class="summary-highlight"><span>🏆</span><strong>${esc(c.podio.primeiro)}</strong><small>Campeão</small></div>
      <div class="metric-list">
        <div class="metric"><strong>${esc(c.podio.segundo||"—")}</strong><small>Vice-campeão</small></div>
        <div class="metric"><strong>${esc(c.podio.terceiro||"—")}</strong><small>3º lugar</small></div>
        <div class="metric"><strong>${games.filter(g=>g.encerrado).length}</strong><small>Jogos concluídos</small></div>
        <div class="metric"><strong>${scorers[0]?esc(scorers[0].nome):"—"}</strong><small>${c.esporte==="Futsal"?"Artilheiro":"Destaque"}</small></div>
      </div>
    </div>`;
}
function competitionUrl(){
  const u=new URL(location.href);
  u.searchParams.set("escola",state.school.id);
  u.searchParams.set("campeonato",state.current.id);
  return u.toString();
}
function renderCompetitionQR(showBox=true){
  if(!state.current)return;
  const wrapper=$("qrCompeticaoBox");
  if(showBox)wrapper.classList.toggle("hidden");
  if(wrapper.classList.contains("hidden"))return;
  const box=$("qrcodeCompeticao");
  box.innerHTML="";
  if(window.QRCode)new QRCode(box,{text:competitionUrl(),width:190,height:190,colorDark:"#173b7a",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});
}
async function updateSchoolPassword(){
  const pass=$("novaSenhaEscola").value,confirmPass=$("confirmarNovaSenha").value;
  if(!pass||pass.length<6)return toast("A nova senha precisa ter pelo menos 6 caracteres.");
  if(pass!==confirmPass)return toast("As senhas não são iguais.");
  const senhaHash=await hashPassword(pass);
  await updateDoc(doc(db,"escolas",state.school.id),{senhaHash,atualizadoEm:serverTimestamp()});
  state.school.senhaHash=senhaHash;
  $("novaSenhaEscola").value="";$("confirmarNovaSenha").value="";
  toast("Senha atualizada.");
}
async function renewSchool(){
  const expiraEm=new Date(Date.now()+60*86400000);
  await updateDoc(doc(db,"escolas",state.school.id),{expiraEm,ativo:true,atualizadoEm:serverTimestamp()});
  state.school.expiraEm=expiraEm;
  openSchoolSettings();
  toast("Validade renovada por 60 dias.");
}
async function deactivateSchool(){
  if(!confirm("Desativar esta escola? Ela deixará de aparecer nas buscas."))return;
  await updateDoc(doc(db,"escolas",state.school.id),{ativo:false,atualizadoEm:serverTimestamp()});
  state.school.ativo=false;
  toast("Escola desativada.");
  show("telaBusca");
}
function openSchoolSettings(){
  $("configNomeEscola").textContent=state.school.nome;
  let date="Não definida";
  const raw=state.school.expiraEm;
  if(raw?.toDate)date=raw.toDate().toLocaleDateString("pt-BR");
  else if(raw)date=new Date(raw).toLocaleDateString("pt-BR");
  $("configValidade").textContent=`Validade atual: ${date}`;
  show("telaConfiguracoes");
}
function toggleTheme(){
  document.body.classList.toggle("dark");
  localStorage.setItem("tema-interclasses",document.body.classList.contains("dark")?"dark":"light");
}

function goBack(){const m={telaCadastro:"telaBusca",telaEscola:"telaBusca",telaLogin:"telaEscola",telaProfessor:"telaEscola",telaTurno:"telaProfessor",telaEsporte:"telaTurno",telaModalidade:"telaEsporte",telaParticipantes:"telaModalidade",telaJogadores:"telaParticipantes",telaRegras:"telaParticipantes",telaFormato:"telaRegras",telaRevisao:"telaFormato",telaListaAluno:"telaEscola",telaCompeticaoAluno:state.admin?"telaProfessor":"telaListaAluno",telaResultado:"telaCompeticaoAluno",telaEditarCompeticao:"telaCompeticaoAluno",telaAgenda:"telaCompeticaoAluno",telaConfiguracoes:"telaProfessor"};show(m[state.screen]||"telaBusca");}

$("btnBuscar").onclick=searchSchools;$("campoBusca").onkeydown=e=>{if(e.key==="Enter")searchSchools();};$("btnAbrirCadastro").onclick=()=>show("telaCadastro");$("btnCancelarCadastro").onclick=()=>show("telaBusca");$("btnCriarEscola").onclick=createSchool;$("btnProfessor").onclick=()=>show("telaLogin");$("btnCancelarLogin").onclick=()=>show("telaEscola");$("btnEntrarProfessor").onclick=teacherLogin;$("btnNovoCampeonato").onclick=startWizard;$("btnSairPainel").onclick=()=>{state.admin=false;show("telaEscola");};$("btnTrocarEscola").onclick=()=>{localStorage.removeItem("ultimaEscola");state.school=null;state.admin=false;show("telaBusca");};$("btnVoltar").onclick=goBack;$("btnConfirmarEsporteCustom").onclick=customSport;$("btnAdicionarParticipante").onclick=addParticipant;$("nomeParticipante").onkeydown=e=>{if(e.key==="Enter")addParticipant();};$("btnAvancarRegras").onclick=openRules;$("btnAdicionarJogador").onclick=addPlayer;$("nomeJogador").onkeydown=e=>{if(e.key==="Enter")addPlayer();};$("btnConcluirJogadores").onclick=()=>show("telaParticipantes");$("tipoPlacar").onchange=syncSetOptions;$("formatoSets").onchange=syncSetOptions;$("pontosSetNormal").onchange=syncSetOptions;$("pontosTieBreak").onchange=syncSetOptions;$("btnAvancarFormato").onclick=openFormat;document.querySelectorAll(".format-card").forEach(b=>b.onclick=()=>chooseFormat(b.dataset.formato,b));$("quantidadeGrupos").onchange=updateGroupRules;
$("regraClassificacao").onchange=updateClassificationRuleDetails;$("btnConfirmarFormato").onclick=confirmGroups;$("btnSalvarCampeonato").onclick=saveChamp;$("btnRefazerSorteio").onclick=()=>{generateStructure();renderPreview();toast("Sorteio refeito.");};document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");renderTab(t.dataset.tab,state.admin);});$("placarCasa").oninput=updateGoalInputs;$("placarFora").oninput=updateGoalInputs;$("maisCasa").onclick=()=>{$("placarCasa").value=+$("placarCasa").value+1;updateGoalInputs();};$("menosCasa").onclick=()=>{$("placarCasa").value=Math.max(0,+$("placarCasa").value-1);updateGoalInputs();};$("maisFora").onclick=()=>{$("placarFora").value=+$("placarFora").value+1;updateGoalInputs();};$("menosFora").onclick=()=>{$("placarFora").value=Math.max(0,+$("placarFora").value-1);updateGoalInputs();};$("btnAdicionarSet").onclick=()=>{state.setDraft.push({casa:0,fora:0});renderSets();};$("btnInverterLados").onclick=swapCurrentGameSides;$("btnSalvarResultado").onclick=()=>saveGame(false);$("btnLimparResultado").onclick=()=>{if(confirm("Apagar o resultado?"))saveGame(true);};$("btnFinalizar").onclick=finishChampionship;
$("btnReabrir").onclick=reopenChampionship;
$("btnCopiarLink").onclick=async()=>{try{await navigator.clipboard.writeText(schoolUrl());toast("Link copiado.");}catch{prompt("Copie o link:",schoolUrl());}};$("btnBaixarQR").onclick=()=>{const img=$("qrcode").querySelector("img"),canvas=$("qrcode").querySelector("canvas"),url=img?.src||canvas?.toDataURL("image/png");if(!url)return toast("QR Code ainda não foi gerado.");const a=document.createElement("a");a.href=url;a.download=`QR-${norm(state.school.nome).replace(/\s+/g,"-")}.png`;a.click();};


$("btnEditarCompeticao").onclick=openEditCompetition;
$("btnSalvarDadosBasicos").onclick=saveBasicCompetitionData;
$("btnEditarParticipantes").onclick=()=>startStructuralEdit("participantes");
$("btnEditarRegras").onclick=()=>startStructuralEdit("regras");
$("btnEditarFormato").onclick=()=>startStructuralEdit("formato");
$("btnRegenerarCompeticao").onclick=regenerateCompetition;
$("btnGerarAgenda").onclick=generateAgenda;


$("btnTema").onclick=toggleTheme;
$("btnInstalarApp").onclick=installApp;
$("buscaCompeticaoAluno").oninput=filterStudentCompetitions;
if($("btnFavoritar"))$("btnFavoritar").onclick=toggleCurrentFavorite;
$("btnQRCompeticao").onclick=()=>renderCompetitionQR(true);
$("btnImprimirCompeticao").onclick=()=>window.print();
$("btnBaixarQRCompeticao").onclick=()=>{
  const img=$("qrcodeCompeticao").querySelector("img"),canvas=$("qrcodeCompeticao").querySelector("canvas");
  const url=img?.src||canvas?.toDataURL("image/png");
  if(!url)return toast("Gere o QR Code primeiro.");
  const a=document.createElement("a");a.href=url;a.download=`QR-${norm(state.current.esporte).replace(/\s+/g,"-")}.png`;a.click();
};
$("btnConfiguracoesEscola").onclick=openSchoolSettings;
$("btnSalvarNovaSenha").onclick=updateSchoolPassword;
$("btnRenovarValidade").onclick=renewSchool;
$("btnDesativarEscola").onclick=deactivateSchool;



let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  $("btnInstalarApp").classList.remove("hidden");
});
async function installApp(){
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  $("btnInstalarApp").classList.add("hidden");
}

async function copyPix(){
  const pix="donizetecelista@gmail.com";
  try{
    await navigator.clipboard.writeText(pix);
    toast("Pix copiado: donizetecelista@gmail.com");
  }catch{
    prompt("Copie a chave Pix:",pix);
  }
}
function closeSupportModal(){
  if($("naoMostrarApoio").checked){
    localStorage.setItem("ocultar-apoio-interclasses","sim");
  }
  $("modalApoio").classList.add("hidden");
}
function showSupportModal(){
  if(localStorage.getItem("ocultar-apoio-interclasses")==="sim")return;
  setTimeout(()=>$("modalApoio").classList.remove("hidden"),700);
}

$("btnCopiarPix").onclick=copyPix;
$("btnCopiarPixModal").onclick=copyPix;
$("btnFecharApoio").onclick=closeSupportModal;
$("modalApoio").onclick=e=>{if(e.target.id==="modalApoio")closeSupportModal();};
showSupportModal();

if(localStorage.getItem("tema-interclasses")==="dark")document.body.classList.add("dark");
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error);
const id=new URL(location.href).searchParams.get("escola");if(id)openSchoolById(id);else{const last=localStorage.getItem("ultimaEscola");if(last)try{openSchool(JSON.parse(last));}catch{localStorage.removeItem("ultimaEscola");}}