
const PERIODOS_PUBLICOS = [
  {key:"Matutino",label:"Manhã",icon:"🌅"},
  {key:"Vespertino",label:"Tarde",icon:"☀️"},
  {key:"Noturno",label:"Noite",icon:"🌙"},
  {key:"Outro",label:"Outro",icon:"🕐"}
];

function periodoPublicoKey(value){
  const text=String(value||"").trim().toLowerCase();
  if(text.includes("matut")||text==="manhã"||text==="manha")return"Matutino";
  if(text.includes("vesp")||text==="tarde")return"Vespertino";
  if(text.includes("notur")||text==="noite")return"Noturno";
  return"Outro";
}

function periodoPublicoLabel(value){
  const key=periodoPublicoKey(value);
  return PERIODOS_PUBLICOS.find(item=>item.key===key)?.label||"Outro";
}


const PERIODOS_DISPONIVEIS = ["Matutino","Vespertino","Noturno","Integral"];
function turnoLabel(value){const item=PERIODOS_PUBLICOS.find(x=>x.key===value);return item?.label||value||"";}

function normalizePeriodoLabel(value){
  const text=String(value||"").trim().toLowerCase();
  if(text.includes("matut"))return"Matutino";
  if(text.includes("vesp"))return"Vespertino";
  if(text.includes("notur"))return"Noturno";
  if(text.includes("integr"))return"Integral";
  return value||"Sem período";
}

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
  orderBy, query, serverTimestamp, setDoc, updateDoc, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const $=id=>document.getElementById(id);
const screens=[...document.querySelectorAll(".screen")];
const state={editPlayersOnly:false,screen:"telaBusca",school:null,admin:false,current:null,currentGame:null,wizard:newWizard(),unsubAdmin:null,unsubStudent:null,setDraft:[],editReturn:false,allChampionships:[],reorderDraft:null,reorderTab:"grupos",basketHistory:[],basketLockUntil:0,basketLockTimer:null};

function newWizard(){return{id:null,turno:"",esporte:"",modalidade:"",participantes:[],tipoPlacar:"pontos",formatoSets:"unico",pontosSetNormal:25,pontosTieBreak:15,formato:"",quantidadeGrupos:1,regraClassificacao:"",incluirQualificatorias:false,participantesQualificatorias:[],qualificatorias:[],grupos:[],jogos:[],eliminatorias:[],publicado:true,status:"aberto",podio:null};}
function show(id){screens.forEach(s=>s.classList.toggle("active",s.id===id));state.screen=id;$("btnVoltar").classList.toggle("hidden",id==="telaBusca");scrollTo({top:0,behavior:"smooth"});}
function toast(m){const e=$("toast");e.textContent=m;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),2600);}
function load(on){$("loading").classList.toggle("hidden",!on);}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function esc(s=""){const d=document.createElement("div");d.textContent=s;return d.innerHTML;}
async function hashPassword(s){const b=new TextEncoder().encode(s),h=await crypto.subtle.digest("SHA-256",b);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");}

const PUBLIC_APP_URL="https://donizetecelista.github.io/gerenciador-interclasses/";

function adminSessionKey(schoolId){
  return `interclasses-admin-${schoolId}`;
}

function rememberAdminSession(school){
  if(!school?.id||!school?.senhaHash)return;
  localStorage.setItem(adminSessionKey(school.id),school.senhaHash);
}

function hasValidAdminSession(school){
  if(!school?.id||!school?.senhaHash)return false;
  return localStorage.getItem(adminSessionKey(school.id))===school.senhaHash;
}

function clearAdminSession(schoolId=state.school?.id){
  if(!schoolId)return;
  localStorage.removeItem(adminSessionKey(schoolId));
}

function openTeacherArea(){
  if(!state.school)return toast("Escolha uma escola.");

  if(hasValidAdminSession(state.school)){
    state.admin=true;
    $("escolaPainel").textContent=state.school.nome;
    listenAdmin();
    show("telaProfessor");
    return;
  }

  show("telaLogin");
}

function schoolUrl(id=state.school?.id){
  const u=new URL(PUBLIC_APP_URL);
  u.searchParams.set("escola",id);
  u.searchParams.delete("campeonato");
  return u.toString();
}
function campsRef(){return collection(db,"escolas",state.school.id,"campeonatos");}

function sportIcon(s){if(s.includes("Futsal"))return"⚽";if(s.includes("Vôlei"))return"🏐";if(s.includes("Basquete"))return"🏀";if(s.includes("Tênis"))return"🏓";if(s.includes("Queimada"))return"🔥";return"🏆";}
function isIndividual(){return state.wizard.esporte==="Tênis de mesa";}
function recommendedScore(s){
  return ["Vôlei","Vôlei em duplas","Tênis de mesa"].includes(s) ? "sets" : "pontos";
}
function isCustomSport(){
  return !["Futsal","Vôlei","Vôlei em duplas","Basquete","Basquete 3x3","Queimada","Tênis de mesa"].includes(state.wizard.esporte);
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
let schoolSearchTimer=null;

async function searchSchools(showAll=false){
  const field=$("campoBusca");
  const termo=norm(field?.value||"");
  const palavras=termo.split(/\s+/).filter(Boolean);

  // Na abertura, mostra todas. Durante a busca, uma letra já é suficiente para filtrar.
  const shouldShowAll=showAll||palavras.length===0;

  load(true);
  const results=$("resultadosBusca");
  results.innerHTML=`<div class="card muted">Carregando escolas...</div>`;

  try{
    // A ordenação é feita no aplicativo para incluir também escolas antigas
    // que ainda não possuem o campo nomeBusca no Firebase.
    const snap=await getDocs(collection(db,"escolas"));
    const now=Date.now();
    const arr=snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(s=>{
        if(s.ativo===false)return false;
        const expires=s.expiraEm;
        if(!expires)return true;
        const date=typeof expires.toDate==="function"?expires.toDate():new Date(expires);
        return Number.isNaN(date.getTime())||date.getTime()>now;
      })
      .filter(s=>shouldShowAll||palavras.every(word=>norm(s.nome||s.nomeBusca||"").includes(word)))
      .sort((a,b)=>String(a.nome||"").localeCompare(String(b.nome||""),"pt-BR",{sensitivity:"base"}));

    results.innerHTML="";

    if(!arr.length){
      results.innerHTML=`<div class="card muted">${shouldShowAll?"Nenhuma escola cadastrada.":"Nenhuma escola encontrada."}</div>`;
      return;
    }

    arr.forEach(school=>{
      const button=document.createElement("button");
      button.className="school-item";
      button.innerHTML=`<span>🏫</span><div><strong>${esc(school.nome||"Escola sem nome")}</strong><small>Toque para abrir</small></div>`;
      button.onclick=()=>openSchool(school);
      results.appendChild(button);
    });
  }catch(error){
    console.error("Erro ao carregar escolas:",error);
    results.innerHTML='<div class="card muted">Não foi possível carregar as escolas. Verifique a conexão e tente novamente.</div>';
  }finally{load(false);}
}

function filterSchoolsInRealTime(){
  clearTimeout(schoolSearchTimer);
  schoolSearchTimer=setTimeout(()=>searchSchools(false),180);
}
async function openSchoolById(id){load(true);try{const s=await getDoc(doc(db,"escolas",id));if(!s.exists())return toast("Escola não encontrada.");openSchool({id:s.id,...s.data()});}finally{load(false);}}
function openSchool(s){
  state.school=s;
  state.admin=hasValidAdminSession(s);

  localStorage.setItem("ultimaEscola",JSON.stringify(s));
  $("nomeEscolaAtual").textContent=s.nome;
  if($("qrNomeEscola"))$("qrNomeEscola").textContent=s.nome;
  $("topSubtitle").textContent=s.nome;

  const teacherButton=$("btnProfessor");
  if(teacherButton){
    teacherButton.textContent=state.admin
      ?"👨‍🏫 Abrir painel"
      :"👨‍🏫 Sou professor";
  }

  listenStudent();
  renderQR();
  show("telaEscola");
}

function openSchoolQRModal(){
  if(!state.school)return;
  $("qrNomeEscola").textContent=state.school.nome;
  renderQR();
  $("modalQREscola").classList.remove("hidden");
}

function closeSchoolQRModal(){
  $("modalQREscola").classList.add("hidden");
}

function roundedRect(ctx,x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
}

function wrapCanvasText(ctx,text,maxWidth){
  const words=String(text).split(/\s+/);
  const lines=[];
  let line="";

  words.forEach(word=>{
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width>maxWidth&&line){
      lines.push(line);
      line=word;
    }else{
      line=test;
    }
  });

  if(line)lines.push(line);
  return lines;
}

function qrImageSource(){
  const img=$("qrcode").querySelector("img");
  const canvas=$("qrcode").querySelector("canvas");
  return img?.src||canvas?.toDataURL("image/png")||"";
}

async function downloadSchoolQRPoster(){
  if(!state.school)return;
  renderQR();

  const qrSource=qrImageSource();
  if(!qrSource)return toast("QR Code ainda não foi gerado.");

  const canvas=document.createElement("canvas");
  canvas.width=1240;
  canvas.height=1754;
  const ctx=canvas.getContext("2d");

  ctx.fillStyle="#f4f7fb";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const gradient=ctx.createLinearGradient(0,0,canvas.width,0);
  gradient.addColorStop(0,"#173b7a");
  gradient.addColorStop(1,"#2f67dc");
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,canvas.width,255);

  ctx.textAlign="center";
  ctx.fillStyle="#ffffff";
  ctx.font="700 42px Arial";
  ctx.fillText("GERENCIADOR DE INTERCLASSES",canvas.width/2,88);

  ctx.font="900 76px Arial";
  ctx.fillText("JOGOS INTERCLASSE",canvas.width/2,180);

  ctx.fillStyle="#ffffff";
  roundedRect(ctx,90,300,1060,1320,44);
  ctx.fill();

  ctx.fillStyle="#173b7a";
  ctx.font="900 52px Arial";
  const schoolLines=wrapCanvasText(ctx,state.school.nome,930).slice(0,3);
  schoolLines.forEach((line,index)=>{
    ctx.fillText(line,canvas.width/2,400+index*66);
  });

  const nameBottom=400+(schoolLines.length-1)*66;
  ctx.fillStyle="#53657c";
  ctx.font="400 31px Arial";
  ctx.fillText("Acompanhe jogos, resultados, classificações e artilharia",canvas.width/2,nameBottom+80);

  const qrImage=new Image();
  await new Promise((resolve,reject)=>{
    qrImage.onload=resolve;
    qrImage.onerror=reject;
    qrImage.src=qrSource;
  });

  const qrSize=590;
  const qrX=(canvas.width-qrSize)/2;
  const qrY=nameBottom+150;

  ctx.fillStyle="#f8fafc";
  roundedRect(ctx,qrX-30,qrY-30,qrSize+60,qrSize+60,30);
  ctx.fill();
  ctx.drawImage(qrImage,qrX,qrY,qrSize,qrSize);

  ctx.fillStyle="#173b7a";
  ctx.font="900 42px Arial";
  ctx.fillText("APONTE A CÂMERA DO CELULAR",canvas.width/2,qrY+qrSize+105);

  ctx.fillStyle="#53657c";
  ctx.font="400 31px Arial";
  ctx.fillText("O QR Code abre diretamente a página da escola.",canvas.width/2,qrY+qrSize+160);

  ctx.fillStyle="#e8f0ff";
  roundedRect(ctx,180,qrY+qrSize+220,880,120,25);
  ctx.fill();

  ctx.fillStyle="#173b7a";
  ctx.font="700 28px Arial";
  ctx.fillText("INFORMAÇÕES DO CAMPEONATO EM TEMPO REAL",canvas.width/2,qrY+qrSize+275);
  ctx.font="400 25px Arial";
  ctx.fillText("Jogos • Resultados • Classificação • Eliminatórias",canvas.width/2,qrY+qrSize+315);

  ctx.fillStyle="#64748b";
  ctx.font="400 23px Arial";
  ctx.fillText("Criado de professor para professor",canvas.width/2,1570);

  const link=document.createElement("a");
  link.href=canvas.toDataURL("image/png");
  link.download=`Cartaz-Jogos-Interclasse-${norm(state.school.nome).replace(/\s+/g,"-")}.png`;
  link.click();
}

function renderQR(){const box=$("qrcode");box.innerHTML="";if(window.QRCode)new QRCode(box,{text:schoolUrl(),width:190,height:190,colorDark:"#173b7a",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});}
function listenStudent(){
  if(state.unsubStudent)state.unsubStudent();

  state.unsubStudent=onSnapshot(campsRef(),snap=>{
    const all=snap.docs.map(d=>({id:d.id,...d.data()}));
    state.allChampionships=all;
    renderStudentFavorites();

    // Mantém a competição aberta sincronizada para o aluno.
    if(state.current){
      const updated=all.find(item=>item.id===state.current.id);

      if(updated){
        state.current=normalizeCompetition(updated);

        const competitionOpen=$("telaCompeticaoAluno")?.classList.contains("active");
        const activeTab=document.querySelector(".tab.active")?.dataset.tab;

        if(competitionOpen&&activeTab){
          renderTab(activeTab,state.admin);
        }
      }
    }

    const camps=all.filter(c=>c.publicado!==false);
    const turns=[["Matutino","🌅"],["Vespertino","☀️"],["Noturno","🌙"],["Outro","⭐"]];
    const box=$("turnosAluno");
    box.innerHTML="";

    const active=turns.filter(([turn])=>camps.some(c=>c.turno===turn));

    if(!active.length){
      box.innerHTML='<div class="card muted" style="grid-column:1/-1">Ainda não há campeonatos publicados.</div>';
      return;
    }

    active.forEach(([turn,icon])=>{
      const button=document.createElement("button");
      button.className="choice-card compact-turn-card";
      button.innerHTML=`<span>${icon}</span><strong>${turnoLabel(turn)}</strong><small>Abrir</small>`;
      button.onclick=()=>openStudentList(turn,camps.filter(c=>c.turno===turn));
      box.appendChild(button);
    });
  });
}
async function teacherLogin(){
  if(!state.school)return toast("Escolha uma escola.");const senha=$("senhaLogin").value;if(!senha)return toast("Digite a senha.");
  load(true);try{
    const snap=await getDoc(doc(db,"escolas",state.school.id));if(!snap.exists())return toast("Escola não encontrada.");state.school={id:snap.id,...snap.data()};
    const hash=await hashPassword(senha);if(hash!==state.school.senhaHash)return toast("Senha incorreta.");
    rememberAdminSession(state.school);
    state.admin=true;
    $("senhaLogin").value="";
    $("escolaPainel").textContent=state.school.nome;
    listenAdmin();
    show("telaProfessor");
  }finally{load(false);}
}
function listenAdmin(){if(state.unsubAdmin)state.unsubAdmin();state.unsubAdmin=onSnapshot(campsRef(),snap=>renderAdmin(snap.docs.map(d=>({id:d.id,...d.data()}))));}
function renderAdmin(arr){
  const box=$("listaCampeonatosAdmin");
  box.innerHTML="";

  if(!arr.length){
    box.innerHTML='<div class="card muted">Nenhum campeonato criado. Clique em “Criar campeonato” para começar.</div>';
    return;
  }

  const order=["Matutino","Vespertino","Noturno","Outro"];
  const grouped={};

  arr.forEach(c=>{
    const turno=c.turno||"Outro";
    if(!grouped[turno])grouped[turno]=[];
    grouped[turno].push(c);
  });

  const turns=[
    ...order.filter(turno=>grouped[turno]?.length),
    ...Object.keys(grouped).filter(turno=>!order.includes(turno)).sort()
  ];

  turns.forEach(turno=>{
    const section=document.createElement("section");
    section.className="admin-turn-section";

    const header=document.createElement("div");
    header.className="admin-turn-header";
    header.innerHTML=`
      <div>
        <strong>${esc(turno)}</strong>
        <small>${grouped[turno].length} campeonato(s)</small>
      </div>
    `;
    section.appendChild(header);

    const list=document.createElement("div");
    list.className="admin-turn-list";

    grouped[turno]
      .sort((a,b)=>(a.esporte+a.modalidade).localeCompare(b.esporte+b.modalidade))
      .forEach(c=>{
        const el=document.createElement("div");
        el.className="admin-item";
        el.innerHTML=`
          <div class="admin-item-info">
            <strong>${esc(c.esporte)} — ${esc(c.modalidade)}</strong>
            <small>${c.participantes?.length||0} participantes · ${c.status==="encerrado"?"Encerrado":c.publicado===false?"Oculto":"Publicado"}</small>
          </div>

          <div class="admin-actions">
            <button class="mini" data-open>Jogos</button>
            <button class="mini secondary" data-edit>Editar</button>
            <button class="mini ghost" data-pub>${c.publicado===false?"Publicar":"Ocultar"}</button>
            <button class="mini danger" data-del>Excluir</button>
          </div>
        `;

        el.querySelector("[data-open]").onclick=()=>openCompetitionSafe(c,true);
        el.querySelector("[data-edit]").onclick=()=>editChamp(c);
        el.querySelector("[data-pub]").onclick=()=>updateDoc(
          doc(db,"escolas",state.school.id,"campeonatos",c.id),
          {publicado:c.publicado===false,atualizadoEm:serverTimestamp()}
        );
        el.querySelector("[data-del]").onclick=()=>deleteChamp(c);

        list.appendChild(el);
      });

    section.appendChild(list);
    box.appendChild(section);
  });
}
function startWizard(){state.wizard=newWizard();renderTurns();show("telaTurno");}
function renderTurns(){const opts=[["Matutino","🌅"],["Vespertino","☀️"],["Noturno","🌙"],["Outro","⭐"]],box=$("opcoesTurno");box.innerHTML="";opts.forEach(([n,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${turnoLabel(n)}</strong>`;b.onclick=()=>{state.wizard.turno=n;renderSports();show("telaEsporte");};box.appendChild(b);});}
function renderSports(){const opts=[["Futsal","⚽"],["Vôlei","🏐"],["Vôlei em duplas","🏐"],["Basquete","🏀"],["Basquete 3x3","🏀"],["Queimada","🔥"],["Tênis de mesa","🏓"],["Adicionar esporte","➕"]],box=$("opcoesEsporte");box.innerHTML="";$("boxEsporteCustom").classList.add("hidden");opts.forEach(([n,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${n}</strong>`;b.onclick=()=>{if(n==="Adicionar esporte"){$("boxEsporteCustom").classList.remove("hidden");$("nomeEsporteCustom").focus();}else{state.wizard.esporte=n;renderModalities();}};box.appendChild(b);});}
function customSport(){const n=$("nomeEsporteCustom").value.trim();if(!n)return toast("Digite o nome do esporte.");state.wizard.esporte=n;renderModalities();}
function renderModalities(){if(state.wizard.esporte==="Tênis de mesa"){state.wizard.modalidade="Misto";prepareParticipants();show("telaParticipantes");return;}const opts=[["Misto","⚥"],["Masculino","♂"],["Feminino","♀"]],box=$("opcoesModalidade");box.innerHTML="";opts.forEach(([n,i])=>{const b=document.createElement("button");b.className="choice-card";b.innerHTML=`<span>${i}</span><strong>${n}</strong>`;b.onclick=()=>{state.wizard.modalidade=n;prepareParticipants();show("telaParticipantes");};box.appendChild(b);});show("telaModalidade");}
function prepareParticipants(){$("tituloParticipantes").textContent=isIndividual()?"Adicionar jogadores":"Adicionar times";$("textoParticipantes").textContent="Cadastre todos os participantes antes de avançar.";$("labelParticipante").textContent=isIndividual()?"Nome do jogador":"Nome do time";$("nomeParticipante").placeholder=isIndividual()?"Ex.: João da Silva":"Ex.: 3º Ano A";renderParticipants();}
function addParticipant(){const n=$("nomeParticipante").value.trim();if(!n)return toast("Digite um nome.");if(state.wizard.participantes.some(p=>norm(p.nome)===norm(n)))return toast("Esse nome já foi adicionado.");state.wizard.participantes.push({id:crypto.randomUUID(),nome:n,jogadores:[]});$("nomeParticipante").value="";renderParticipants();}
function renderParticipants(){const box=$("listaParticipantes");box.innerHTML="";if(!state.wizard.participantes.length){box.innerHTML='<div class="card muted">Nenhum participante adicionado.</div>';return;}state.wizard.participantes.forEach(p=>{const el=document.createElement("div");el.className="participant-item";el.innerHTML=`<div class="participant-info"><strong>${esc(p.nome)}</strong><small>${p.jogadores.length?`${p.jogadores.length} jogadores`:"Nenhum jogador"}</small></div><div class="participant-actions"><button class="mini secondary" data-players>Jogadores</button>${state.editPlayersOnly?"":'<button class="mini ghost" data-edit>Editar</button><button class="mini danger" data-del>Excluir</button>'}</div>`;const editButton=el.querySelector("[data-edit]");if(editButton)editButton.onclick=()=>{const n=prompt("Novo nome:",p.nome)?.trim();if(n){p.nome=n;renderParticipants();}};const deleteButton=el.querySelector("[data-del]");if(deleteButton)deleteButton.onclick=()=>{state.wizard.participantes=state.wizard.participantes.filter(x=>x.id!==p.id);renderParticipants();};const bp=el.querySelector("[data-players]");if(bp)bp.onclick=()=>openPlayers(p.id);box.appendChild(el);});}
function openPlayers(id){state.wizard.playerTeamId=id;const p=state.wizard.participantes.find(x=>x.id===id);$("tituloTimeJogadores").textContent=p.nome;renderPlayers();show("telaJogadores");}
async function addPlayer(){const n=$("nomeJogador").value.trim();if(!n)return toast("Digite o nome.");const p=state.wizard.participantes.find(x=>x.id===state.wizard.playerTeamId);p.jogadores.push({id:crypto.randomUUID(),nome:n,gols:0});$("nomeJogador").value="";renderPlayers();if(state.editPlayersOnly)await savePlayerRosters(false,true);}
function playerHasRecordedGoal(playerId){
  const competition=state.current||state.wizard;
  return allGames(competition).some(game=>(game.gols||[]).some(goal=>goal.jogadorId===playerId));
}
function renderPlayers(){
  const p=state.wizard.participantes.find(x=>x.id===state.wizard.playerTeamId),box=$("listaJogadores");
  box.innerHTML="";
  if(!p.jogadores.length){box.innerHTML='<div class="card muted">Nenhum jogador adicionado.</div>';return;}
  p.jogadores.forEach(j=>{
    const e=document.createElement("div");
    e.className="participant-item";
    e.innerHTML=`<strong>${esc(j.nome)}</strong><div class="participant-actions"><button class="mini ghost" data-edit>Editar</button><button class="mini danger" data-del>Excluir</button></div>`;
    e.querySelector("[data-edit]").onclick=()=>{
      const novoNome=prompt("Novo nome do jogador:",j.nome)?.trim();
      if(!novoNome||novoNome===j.nome)return;
      if(p.jogadores.some(outro=>outro.id!==j.id&&norm(outro.nome)===norm(novoNome)))return toast("Já existe um jogador com esse nome neste time.");
      j.nome=novoNome;
      renderPlayers();
      if(state.editPlayersOnly)savePlayerRosters(false,true);
    };
    e.querySelector("[data-del]").onclick=()=>{
      if(playerHasRecordedGoal(j.id))return toast("Este jogador já possui gol registrado. Edite o nome para preservar o histórico.");
      p.jogadores=p.jogadores.filter(x=>x.id!==j.id);
      renderPlayers();
      if(state.editPlayersOnly)savePlayerRosters(false,true);
    };
    box.appendChild(e);
  });
}
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
function openFormat(){state.wizard.tipoPlacar=isCustomSport()?$("tipoPlacar").value:recommendedScore(state.wizard.esporte);state.wizard.formatoSets=$("formatoSets").value;state.wizard.pontosSetNormal=Number($("pontosSetNormal").value==="custom"?$("pontosSetCustom").value:$("pontosSetNormal").value);state.wizard.pontosTieBreak=Number($("pontosTieBreak").value==="custom"?$("pontosTieBreakCustom").value:$("pontosTieBreak").value);if(state.wizard.tipoPlacar==="sets"&&(!state.wizard.pontosSetNormal||state.wizard.pontosSetNormal<1))return toast("Informe os pontos do set.");renderRules();resetFormatSelection();show("telaFormato");}

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
function groupSizesForCount(total,groups){
  const base=Math.floor(total/groups);
  const extra=total%groups;
  return Array.from({length:groups},(_,index)=>base+(index<extra?1:0));
}

function groupStageGameCount(total,groups){
  return groupSizesForCount(total,groups)
    .reduce((sum,size)=>sum+(size*(size-1))/2,0);
}

function knockoutGameCountForRule(rule){
  const counts={
    campeaoGrupo:0,
    final2:1,
    semi4:4,
    top8UmGrupo:8,
    lideresFinal:1,
    top2grupo:4,
    top3Mais2Quartos:8,
    top4DoisGrupos:8,
    lideres3Semi:4,
    top2Mais2Terceiros:8,
    top2TresGrupos:6,
    top3TresGrupos:9,
    lideres4Semi:4,
    top2Quarta:8,
    top3QuatroGrupos:12,
    top4QuatroGrupos:16,
    lideres5Mais3Segundos:8,
    top2CincoGrupos:10,
    top3CincoGrupos:15,
    top3MaisMelhorQuartoCinco:16
  };
  return counts[rule]??0;
}

function totalGamesForRule(total,groups,rule){
  return groupStageGameCount(total,groups)+knockoutGameCountForRule(rule);
}

function qualifiedCountForRule(rule){
  if(rule==="campeaoGrupo")return 0;
  if(["final2","lideresFinal"].includes(rule))return 2;
  return knockoutGameCountForRule(rule);
}

function classificationOptionsForGroups(grupos){
  const map={
    1:[
      ["campeaoGrupo","Líder do grupo é o campeão","O 1º colocado recebe ouro, o 2º prata e o 3º bronze. Não haverá eliminatórias.",1],
      ["final2","1º e 2º avançam para a final","O 1º e o 2º disputam a final. O 3º colocado recebe o bronze diretamente.",2],
      ["semi4","Os 4 primeiros avançam para as semifinais","Semifinais: 1º × 4º e 2º × 3º, com disputa de 3º lugar e final.",4],
      ["top8UmGrupo","Os 8 primeiros avançam para as quartas","Quartas de final com os oito primeiros colocados, seguidas por semifinais, 3º lugar e final.",8]
    ],
    2:[
      ["lideresFinal","Os líderes se classificam para a final","O líder do Grupo A enfrenta o líder do Grupo B. O melhor 2º colocado recebe o bronze.",2],
      ["top2grupo","Os 2 melhores de cada grupo avançam","Semifinais cruzadas: 1º A × 2º B e 1º B × 2º A.",4],
      ["top3Mais2Quartos","Os 3 melhores de cada grupo + 2 melhores 4ºs","Oito classificados avançam às quartas de final.",8],
      ["top4DoisGrupos","Os 4 melhores de cada grupo avançam","Os quatro melhores de cada grupo avançam às quartas de final.",8]
    ],
    3:[
      ["lideres3Semi","Os líderes + o melhor 2º avançam","Quatro classificados disputam as semifinais.",4],
      ["top2Mais2Terceiros","Os 2 melhores + os 2 melhores 3ºs avançam","Oito classificados disputam as quartas de final.",8],
      ["top2TresGrupos","Os 2 melhores de cada grupo avançam","Seis classificados entram na eliminatória, com folgas automáticas.",6],
      ["top3TresGrupos","Os 3 melhores de cada grupo avançam","Nove classificados entram na eliminatória, com folgas automáticas.",9]
    ],
    4:[
      ["lideres4Semi","Os líderes avançam para as semifinais","Os quatro líderes disputam as semifinais.",4],
      ["top2Quarta","Os 2 melhores de cada grupo avançam","Oito classificados disputam as quartas de final.",8],
      ["top3QuatroGrupos","Os 3 melhores de cada grupo avançam","Doze classificados entram na eliminatória, com folgas automáticas.",12],
      ["top4QuatroGrupos","Os 4 melhores de cada grupo avançam","Dezesseis classificados disputam as oitavas de final.",16]
    ],
    5:[
      ["lideres5Mais3Segundos","Os líderes + os 3 melhores 2ºs avançam","Oito classificados disputam as quartas de final.",8],
      ["top2CincoGrupos","Os 2 melhores de cada grupo avançam","Dez classificados entram na eliminatória, com folgas automáticas.",10],
      ["top3CincoGrupos","Os 3 melhores de cada grupo avançam","Quinze classificados entram na eliminatória, com uma folga automática.",15],
      ["top3MaisMelhorQuartoCinco","Os 3 melhores + o melhor 4º avançam","Dezesseis classificados disputam as oitavas de final.",16]
    ]
  };
  return (map[grupos]||[]).map(([value,label,detail,minimum])=>({value,label,detail,minimum}));
}

function updateGroupRules(){
  const total=state.wizard.participantes.length;
  const grupos=Number($("quantidadeGrupos").value||1);
  const sel=$("regraClassificacao");
  const help=$("explicacaoGrupos");
  sel.innerHTML="";

  help.textContent=grupos===1
    ?"Um único grupo, com todos jogando entre si."
    :`Os times serão distribuídos da forma mais equilibrada possível entre ${grupos} grupos.`;

  const options=classificationOptionsForGroups(grupos);
  options.forEach(option=>{
    const games=totalGamesForRule(total,grupos,option.value);
    const o=document.createElement("option");
    o.value=option.value;
    o.textContent=option.label;
    o.dataset.detail=option.detail;
    o.dataset.games=String(games);
    const allAdvance=option.value==="top2grupo"&&grupos===2&&total===4;
    if(allAdvance){o.textContent="Todos os times dos grupos avançam (2 por grupo)";o.dataset.detail="Como cada grupo terá 2 times, os dois de cada grupo avançarão para as semifinais.";}
    o.disabled=total<option.minimum||grupos>total;
    sel.appendChild(o);
  });

  const previous=state.wizard.regraClassificacao;
  const preserved=[...sel.options].find(o=>o.value===previous&&!o.disabled);
  const firstEnabled=preserved||[...sel.options].find(o=>!o.disabled);
  if(firstEnabled)sel.value=firstEnabled.value;
  updateClassificationRuleDetails();
}

function updateClassificationRuleDetails(){
  const sel=$("regraClassificacao");
  const box=$("detalhesRegraClassificacao");
  if(!sel||!box)return;

  const option=sel.options[sel.selectedIndex];
  if(!option){
    box.innerHTML="";
    return;
  }

  const games=Number(option.dataset.games||0);
  box.innerHTML=`
    <div class="rule-games-highlight">
      <span class="rule-games-icon">🏆</span>
      <span>Total de partidas:</span>
      <strong>${games}</strong>
    </div>
    <div class="rule-description">${esc(option.dataset.detail||"")}</div>
  `;
}

function resetFormatSelection(){
  state.wizard.formato="";
  document.querySelectorAll(".format-card").forEach(card=>card.classList.remove("selected"));
  $("configGrupos").classList.add("hidden");
  $("btnConfirmarEliminatoria").classList.add("hidden");
  state.wizard.incluirQualificatorias=false;
  state.wizard.participantesQualificatorias=[];
  const qualifierCheckbox=$("incluirQualificatorias");
  if(qualifierCheckbox) qualifierCheckbox.checked=false;
}

function chooseFormat(f,b){
  state.wizard.formato=f;

  document.querySelectorAll(".format-card").forEach(card=>{
    card.classList.toggle("selected",card===b);
  });

  const isGroups=f==="grupos";
  $("configGrupos").classList.toggle("hidden",!isGroups);
  $("btnConfirmarEliminatoria").classList.toggle("hidden",isGroups);

  if(isGroups){
    updateGroupRules();
  }else{
    state.wizard.quantidadeGrupos=0;
    state.wizard.regraClassificacao="";
    state.wizard.incluirQualificatorias=false;
    state.wizard.participantesQualificatorias=[];
    const qualifierCheckbox=$("incluirQualificatorias");
    if(qualifierCheckbox) qualifierCheckbox.checked=false;
  }
}

function confirmEliminationFormat(){
  if(state.wizard.formato!=="eliminatoria"){
    return toast("Escolha o formato Eliminatórias.");
  }

  state.wizard.quantidadeGrupos=0;
  state.wizard.regraClassificacao="";
  generateStructure();
  review();
}


function renderSelecaoQualificatorias(){
  const box=$("listaTimesQualificatorias");
  if(!box)return;

  const selecionados=new Set(state.wizard.participantesQualificatorias||[]);
  box.innerHTML="";

  state.wizard.participantes.forEach(participante=>{
    const item=document.createElement("label");
    item.className="qualifier-team-item";
    item.innerHTML=`
      <span>${esc(participante.nome)}</span>
      <input type="checkbox" value="${participante.id}" ${selecionados.has(participante.id)?"checked":""}>
    `;

    const checkbox=item.querySelector("input");
    checkbox.onchange=()=>{
      state.wizard.participantesQualificatorias=[
        ...box.querySelectorAll('input[type="checkbox"]:checked')
      ].map(input=>input.value);
    };

    box.appendChild(item);
  });
}

function openSelecaoQualificatorias(){
  state.wizard.participantesQualificatorias=(state.wizard.participantesQualificatorias||[])
    .filter(id=>state.wizard.participantes.some(participante=>participante.id===id));

  renderSelecaoQualificatorias();
  show("telaSelecaoQualificatorias");
}

function avancarSelecaoQualificatorias(){
  const total=(state.wizard.participantesQualificatorias||[]).length;
  if(total<2)return toast("Selecione pelo menos 2 times para as Qualificatórias.");
  if(total%2!==0)return toast("A quantidade de times selecionados precisa ser par.");
  generateStructure();
  review();
}

function confirmGroups(){
  state.wizard.quantidadeGrupos=Number($("quantidadeGrupos").value);
  if(state.wizard.quantidadeGrupos>state.wizard.participantes.length)return toast("Há mais grupos do que participantes.");
  state.wizard.regraClassificacao=$("regraClassificacao").value;
  state.wizard.incluirQualificatorias=!!$("incluirQualificatorias")?.checked;

  if(state.wizard.incluirQualificatorias){
    openSelecaoQualificatorias();
    return;
  }

  state.wizard.participantesQualificatorias=[];
  generateStructure();
  review();
}
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

  (c.qualificatorias||[]).forEach(g=>{
    g.numeroJogo=number++;
  });

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


function buildRoundRobinRounds(participants){
  const list=[...participants];
  if(list.length%2===1)list.push(null);

  const rounds=[];
  let rotation=[...list];
  const total=rotation.length;

  for(let round=0;round<total-1;round++){
    const matches=[];

    for(let i=0;i<total/2;i++){
      const a=rotation[i];
      const b=rotation[total-1-i];

      if(a&&b){
        matches.push(round%2===0?[a,b]:[b,a]);
      }
    }

    rounds.push(matches);

    const fixed=rotation[0];
    const rest=rotation.slice(1);
    rest.unshift(rest.pop());
    rotation=[fixed,...rest];
  }

  return rounds;
}

function moveMatchToAvoidRepeat(matches,lastTeamIds){
  if(!matches.length||!lastTeamIds?.size)return matches;

  const index=matches.findIndex(([a,b])=>
    !lastTeamIds.has(a.id)&&!lastTeamIds.has(b.id)
  );

  if(index<=0)return matches;

  return[
    matches[index],
    ...matches.slice(0,index),
    ...matches.slice(index+1)
  ];
}

function createInterleavedGroupGames(groups){
  const roundsByGroup=groups.map(group=>buildRoundRobinRounds(group.participantes));
  const totalRounds=Math.max(...roundsByGroup.map(rounds=>rounds.length),0);
  const games=[];
  let lastTeamIds=new Set();

  for(let roundIndex=0;roundIndex<totalRounds;roundIndex++){
    const groupRounds=groups.map((group,groupIndex)=>({
      group,
      matches:moveMatchToAvoidRepeat(
        roundsByGroup[groupIndex][roundIndex]||[],
        lastTeamIds
      )
    }));

    const maxMatches=Math.max(...groupRounds.map(item=>item.matches.length),0);

    for(let matchIndex=0;matchIndex<maxMatches;matchIndex++){
      groupRounds.forEach(({group,matches})=>{
        const pair=matches[matchIndex];
        if(!pair)return;

        const[a,b]=pair;

        games.push({
          ...emptyGame(`Grupo ${group.nome}`,0,roundIndex),
          rodada:roundIndex+1,
          casaId:a.id,
          foraId:b.id,
          casa:a.nome,
          fora:b.nome
        });

        lastTeamIds=new Set([a.id,b.id]);
      });
    }
  }

  return games;
}


function createQualificatorias(participantes){
  const ids=new Set(state.wizard.participantesQualificatorias||[]);
  const selecionados=shuffle(participantes.filter(p=>ids.has(p.id)));
  const diretos=shuffle(participantes.filter(p=>!ids.has(p.id)));
  const jogos=[];
  const vagas=[];

  for(let i=0;i<selecionados.length;i+=2){
    const casa=selecionados[i];
    const fora=selecionados[i+1];
    const numero=i/2+1;
    const slotId=`vaga-qualificatoria-${numero}`;
    const jogo={
      ...emptyGame("Qualificatórias",0,i/2),
      casaId:casa.id,
      casa:casa.nome,
      foraId:fora.id,
      fora:fora.nome,
      qualificationSlotId:slotId,
      qualificationSlotName:`Vencedor da Qualificatória ${numero}`
    };
    jogos.push(jogo);
    vagas.push({
      id:slotId,
      nome:jogo.qualificationSlotName,
      qualificationPlaceholder:true,
      qualificationGameId:jogo.id
    });
  }

  return{
    jogos,
    participantesGrupos:shuffle([...diretos,...vagas])
  };
}

function qualificatoriasConcluidas(c){
  return !(c.qualificatorias||[]).length ||
    (c.qualificatorias||[]).every(j=>j.encerrado&&!!gameWinner(j));
}

function aplicarVencedorQualificatoria(c,jogo){
  const vencedor=gameWinner(jogo);
  if(!vencedor||!jogo.qualificationSlotId)return;

  (c.grupos||[]).forEach(grupo=>{
    grupo.participantes=(grupo.participantes||[]).map(p=>
      p.id===jogo.qualificationSlotId
        ?((c.participantes||[]).find(t=>t.id===vencedor.id)||vencedor)
        :p
    );
  });

  (c.jogos||[]).forEach(partida=>{
    if(partida.casaId===jogo.qualificationSlotId){
      partida.casaId=vencedor.id;
      partida.casa=vencedor.nome;
    }
    if(partida.foraId===jogo.qualificationSlotId){
      partida.foraId=vencedor.id;
      partida.fora=vencedor.nome;
    }
  });
}

function restaurarVagaQualificatoria(c,jogo){
  if(!jogo.qualificationSlotId)return;
  const slotId=jogo.qualificationSlotId;
  const slotName=jogo.qualificationSlotName||"Vencedor da Qualificatória";

  (c.grupos||[]).forEach(grupo=>{
    grupo.participantes=(grupo.participantes||[]).map(p=>{
      if(p.id===jogo.casaId||p.id===jogo.foraId){
        return{
          id:slotId,
          nome:slotName,
          qualificationPlaceholder:true,
          qualificationGameId:jogo.id
        };
      }
      return p;
    });
  });

  (c.jogos||[]).forEach(partida=>{
    if(
      partida.qualificationCasaGameId===jogo.id ||
      partida.casaId===jogo.casaId ||
      partida.casaId===jogo.foraId
    ){
      if(partida.qualificationCasaGameId===jogo.id){
        partida.casaId=slotId;
        partida.casa=slotName;
      }
    }
    if(
      partida.qualificationForaGameId===jogo.id ||
      partida.foraId===jogo.casaId ||
      partida.foraId===jogo.foraId
    ){
      if(partida.qualificationForaGameId===jogo.id){
        partida.foraId=slotId;
        partida.fora=slotName;
      }
    }
  });
}

function renderQualificatorias(c,box,admin){
  const jogos=[...(c.qualificatorias||[])].sort((a,b)=>(a.index||0)-(b.index||0));
  if(!jogos.length){
    box.innerHTML='<div class="card muted">Esta competição não possui Qualificatórias.</div>';
    return;
  }

  const title=document.createElement("div");
  title.className="games-section-title";
  title.textContent="QUALIFICATÓRIAS";
  box.appendChild(title);

  jogos.forEach(jogo=>{
    const disponivel=isGameAvailable(c,jogo);
    const card=document.createElement("div");
    card.className="simple-match-card";

    const score=jogo.encerrado
      ?c.tipoPlacar==="sets"
        ?finishedSetScoresHtml(jogo)
        :`<div class="simple-score">${jogo.placarCasa??0} × ${jogo.placarFora??0}</div>`
      :`<div class="simple-versus">×</div>`;

    const vencedor=gameWinner(jogo);

    card.innerHTML=`
      <div class="simple-match-header">
        <span class="simple-match-number">Jogo ${stableGameNumber(c,jogo)}</span>
        <span class="simple-phase">Qualificatórias · Partida única</span>
      </div>
      <div class="horizontal-match">
        <div class="horizontal-team">${esc(jogo.casa)}</div>
        ${score}
        <div class="horizontal-team">${esc(jogo.fora)}</div>
      </div>
      ${vencedor
        ?`<div class="qualification-winner">Classificado para a fase de grupos: <strong>${esc(vencedor.nome)}</strong></div>`
        :`<div class="qualification-note">O vencedor avança para a fase de grupos.</div>`
      }
    `;

    if(admin){
      const button=document.createElement("button");
      button.className=jogo.encerrado?"edit-result-btn":"launch-result-btn";
      button.textContent=jogo.encerrado?"Editar resultado":"Lançar resultado";
      button.disabled=!disponivel&&!jogo.encerrado;
      button.onclick=()=>openResult(jogo);
      card.appendChild(button);
    }

    box.appendChild(card);
  });
}

function generateStructure(){
  const parts=shuffle(state.wizard.participantes);

  state.wizard.qualificatorias=[];
  state.wizard.grupos=[];
  state.wizard.jogos=[];
  state.wizard.eliminatorias=[];

  if(state.wizard.formato==="grupos"){
    const quantity=Math.max(1,state.wizard.quantidadeGrupos);
    let participantesDosGrupos=parts;

    if(state.wizard.incluirQualificatorias){
      const estrutura=createQualificatorias(parts);
      state.wizard.qualificatorias=estrutura.jogos;
      participantesDosGrupos=estrutura.participantesGrupos;
    }

    for(let i=0;i<quantity;i++){
      state.wizard.grupos.push({
        nome:String.fromCharCode(65+i),
        participantes:[]
      });
    }

    participantesDosGrupos.forEach((participant,index)=>{
      state.wizard.grupos[index%quantity].participantes.push(participant);
    });

    state.wizard.jogos=createInterleavedGroupGames(state.wizard.grupos);

    state.wizard.jogos.forEach(jogo=>{
      const todos=state.wizard.grupos.flatMap(g=>g.participantes);
      const casa=todos.find(p=>p.id===jogo.casaId);
      const fora=todos.find(p=>p.id===jogo.foraId);
      if(casa?.qualificationGameId)jogo.qualificationCasaGameId=casa.qualificationGameId;
      if(fora?.qualificationGameId)jogo.qualificationForaGameId=fora.qualificationGameId;
    });

    if(state.wizard.regraClassificacao!=="campeaoGrupo"){
      const count=qualifiedCountForRule(state.wizard.regraClassificacao);

      state.wizard.eliminatorias=makeBracket(
        createQualificationSeeds(state.wizard,count)
      );
    }
  }else{
    state.wizard.eliminatorias=makeBracket(parts);
  }

  assignGameNumbers(state.wizard);
}

function groupSeed(groupIndex,position){
  const letter=String.fromCharCode(65+groupIndex);
  return {id:`vaga-${letter}${position}`,nome:`${position}º do Grupo ${letter}`};
}

function bestPositionSeed(position,rank=1){
  const ordinal=rank===1?"Melhor":`${rank}º melhor`;
  return {id:`vaga-melhor-${position}-${rank}`,nome:`${ordinal} ${position}º colocado`};
}

function seedsTopNPerGroup(groupCount,topN){
  const result=[];
  for(let position=1;position<=topN;position++){
    for(let group=0;group<groupCount;group++)result.push(groupSeed(group,position));
  }
  return result;
}

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

  if(rule==="lideres3Semi"&&groups.length===3){
    return [
      {id:"vaga-A1",nome:"1º do Grupo A"},
      {id:"vaga-M2",nome:"Melhor 2º colocado"},
      {id:"vaga-B1",nome:"1º do Grupo B"},
      {id:"vaga-C1",nome:"1º do Grupo C"}
    ];
  }

  if(rule==="top2Mais2Terceiros"&&groups.length===3){
    return [
      {id:"vaga-A1",nome:"1º do Grupo A"},
      {id:"vaga-M3-2",nome:"2º melhor 3º colocado"},
      {id:"vaga-B1",nome:"1º do Grupo B"},
      {id:"vaga-C2",nome:"2º do Grupo C"},
      {id:"vaga-C1",nome:"1º do Grupo C"},
      {id:"vaga-M3-1",nome:"Melhor 3º colocado"},
      {id:"vaga-A2",nome:"2º do Grupo A"},
      {id:"vaga-B2",nome:"2º do Grupo B"}
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


  if(rule==="top8UmGrupo") return Array.from({length:8},(_,i)=>groupSeed(0,i+1));
  if(rule==="top3Mais2Quartos") return [...seedsTopNPerGroup(2,3),bestPositionSeed(4,1),bestPositionSeed(4,2)];
  if(rule==="top4DoisGrupos") return seedsTopNPerGroup(2,4);
  if(rule==="top2TresGrupos") return seedsTopNPerGroup(3,2);
  if(rule==="top3TresGrupos") return seedsTopNPerGroup(3,3);
  if(rule==="top3QuatroGrupos") return seedsTopNPerGroup(4,3);
  if(rule==="top4QuatroGrupos") return seedsTopNPerGroup(4,4);
  if(rule==="lideres5Mais3Segundos") return [...seedsTopNPerGroup(5,1),bestPositionSeed(2,1),bestPositionSeed(2,2),bestPositionSeed(2,3)];
  if(rule==="top2CincoGrupos") return seedsTopNPerGroup(5,2);
  if(rule==="top3CincoGrupos") return seedsTopNPerGroup(5,3);
  if(rule==="top3MaisMelhorQuartoCinco") return [...seedsTopNPerGroup(5,3),bestPositionSeed(4,1)];

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

function compareStandingRows(c,a,b){
  if(c.tipoPlacar==="sets"){
    return b.pts-a.pts ||
      b.sv-a.sv ||
      b.pm-a.pm ||
      a.nome.localeCompare(b.nome,"pt-BR");
  }

  return b.pts-a.pts ||
    (b.gp-b.gc)-(a.gp-a.gc) ||
    b.gp-a.gp ||
    a.nome.localeCompare(b.nome,"pt-BR");
}

function overallGroupRanking(c){
  const all=[];
  (c.grupos||[]).forEach(g=>{
    standings(c,g).forEach((s,index)=>{
      all.push({...s,group:g.nome,position:index+1});
    });
  });
  return all.sort((a,b)=>compareStandingRows(c,a,b));
}

function rankedTeamsByPosition(c,position){
  return (c.grupos||[])
    .map(g=>standings(c,g)[position-1])
    .filter(Boolean)
    .sort((a,b)=>compareStandingRows(c,a,b));
}

function qualifiedTopNPerGroup(c,topN){
  const result=[];
  for(let position=1;position<=topN;position++){
    (c.grupos||[]).forEach(group=>{
      const team=standings(c,group)[position-1];
      if(team)result.push(team);
    });
  }
  return result;
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

  if(rule==="lideres3Semi"&&groups.length===3){
    const leaders=groups.map(g=>standings(c,g)[0]).filter(Boolean);
    const bestSecond=rankedTeamsByPosition(c,2)[0];
    return [leaders[0],bestSecond,leaders[1],leaders[2]].filter(Boolean);
  }

  if(rule==="top2Mais2Terceiros"&&groups.length===3){
    const a=standings(c,groups[0]);
    const b=standings(c,groups[1]);
    const cc=standings(c,groups[2]);
    const thirds=rankedTeamsByPosition(c,3);
    return [
      a[0],thirds[1],
      b[0],cc[1],
      cc[0],thirds[0],
      a[1],b[1]
    ].filter(Boolean);
  }

  if(rule==="lideres4Semi"&&groups.length===4){
    const a=standings(c,groups[0]),b=standings(c,groups[1]),cc=standings(c,groups[2]),d=standings(c,groups[3]);
    return [a[0],d[0],b[0],cc[0]].filter(Boolean);
  }

  if(rule==="top2Quarta"&&groups.length===4){
    const a=standings(c,groups[0]),b=standings(c,groups[1]),cc=standings(c,groups[2]),d=standings(c,groups[3]);
    return [a[0],b[1],b[0],a[1],cc[0],d[1],d[0],cc[1]].filter(Boolean);
  }


  if(rule==="top8UmGrupo") return standings(c,groups[0]).slice(0,8);
  if(rule==="top3Mais2Quartos") return [...qualifiedTopNPerGroup(c,3),...rankedTeamsByPosition(c,4).slice(0,2)];
  if(rule==="top4DoisGrupos") return qualifiedTopNPerGroup(c,4);
  if(rule==="top2TresGrupos") return qualifiedTopNPerGroup(c,2);
  if(rule==="top3TresGrupos") return qualifiedTopNPerGroup(c,3);
  if(rule==="top3QuatroGrupos") return qualifiedTopNPerGroup(c,3);
  if(rule==="top4QuatroGrupos") return qualifiedTopNPerGroup(c,4);
  if(rule==="lideres5Mais3Segundos") return [...qualifiedTopNPerGroup(c,1),...rankedTeamsByPosition(c,2).slice(0,3)];
  if(rule==="top2CincoGrupos") return qualifiedTopNPerGroup(c,2);
  if(rule==="top3CincoGrupos") return qualifiedTopNPerGroup(c,3);
  if(rule==="top3MaisMelhorQuartoCinco") return [...qualifiedTopNPerGroup(c,3),...rankedTeamsByPosition(c,4).slice(0,1)];

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
  return true;
}

function autoAdvanceByes(bracket){
  // Não encerra partidas automaticamente.
  // No chaveamento atual, um lado vazio pode significar apenas que
  // o adversário ainda será definido por uma partida anterior.
  return bracket;
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

function review(){const w=state.wizard,rule=w.tipoPlacar==="sets"?(w.formatoSets==="unico"?`1 set até ${w.pontosSetNormal}`:`${w.formatoSets==="melhor3"?"Melhor de 3":"Melhor de 5"} · sets até ${w.pontosSetNormal} · tie-break até ${w.pontosTieBreak}`):"Pontos ou gols";$("resumoCampeonato").innerHTML=`<div class="summary-list"><div class="summary-line"><strong>Turno</strong><span>${esc(w.turno)}</span></div><div class="summary-line"><strong>Esporte</strong><span>${esc(w.esporte)}</span></div><div class="summary-line"><strong>Modalidade</strong><span>${esc(w.modalidade)}</span></div><div class="summary-line"><strong>Participantes</strong><span>${w.participantes.length}</span></div><div class="summary-line"><strong>Regra</strong><span>${esc(rule)}</span></div><div class="summary-line"><strong>Formato</strong><span>${w.formato==="grupos"?"Grupos + eliminatórias":"Eliminatórias"}</span></div>${w.formato==="grupos"?`<div class="summary-line"><strong>Classificação</strong><span>${esc($("regraClassificacao").selectedOptions[0]?.textContent||"")}</span></div>${w.qualificatorias?.length?`<div class="summary-line"><strong>Qualificatórias</strong><span>${w.qualificatorias.length} partida(s)</span></div>`:""}`:""}</div>`;renderPreview();show("telaRevisao");}
function renderPreview(){const box=$("previewEstrutura");box.innerHTML="";
if(state.wizard.qualificatorias?.length){
  const q=document.createElement("div");
  q.className="group-card";
  q.innerHTML=`<h3>Qualificatórias</h3>${state.wizard.qualificatorias.map(j=>`<div class="bracket-game"><strong>${esc(j.casa)} × ${esc(j.fora)}</strong><small>Partida única · vencedor avança aos grupos</small></div>`).join("")}`;
  box.appendChild(q);
}
state.wizard.grupos.forEach(g=>{const e=document.createElement("div");e.className="group-card";e.innerHTML=`<h3>Grupo ${g.nome}</h3>${g.participantes.map(p=>`<div class="group-team">${esc(p.nome)}</div>`).join("")}`;box.appendChild(e);});if(state.wizard.eliminatorias.length){const e=document.createElement("div");e.className="group-card";e.innerHTML=`<h3>Eliminatórias</h3>${state.wizard.eliminatorias.filter(g=>g.round===0).map(j=>`<div class="bracket-game"><strong>${esc(j.casa)} × ${esc(j.fora)}</strong><small>${j.fase} · Os nomes reais aparecerão automaticamente após a definição dos classificados.</small></div>`).join("")}`;box.appendChild(e);}}
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

let basicDataAutosaveTimer=null;
async function saveBasicCompetitionData(closeAfter=true,silent=false){
  const turno=$("editarTurno").value;
  const esporte=$("editarEsporte").value.trim();
  const modalidade=$("editarModalidade").value;
  if(!esporte){if(!silent)toast("Informe o esporte.");return;}

  if(!silent)load(true);
  try{
    await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",state.current.id),{
      turno,esporte,modalidade,atualizadoEm:serverTimestamp()
    });
    state.current={...state.current,turno,esporte,modalidade};
    if(!silent)toast("Dados básicos atualizados.");
    if(closeAfter)openCompetition(state.current,true);
  }catch(e){console.error(e);if(!silent)toast("Erro ao salvar alterações.");}
  finally{if(!silent)load(false);}
}
function scheduleBasicDataAutosave(){
  clearTimeout(basicDataAutosaveTimer);
  basicDataAutosaveTimer=setTimeout(()=>saveBasicCompetitionData(false,true),650);
}

function startStructuralEdit(section){
  if(!state.current)return;
  const hasResults=allGames(state.current).some(g=>g.encerrado);
  if(section!=="participantes"&&hasResults&&!confirm("Esta competição já possui resultados. Ao salvar alterações estruturais, o sorteio e os resultados poderão ser apagados. Continuar?"))return;

  state.wizard=JSON.parse(JSON.stringify(state.current));
  state.wizard.id=state.current.id;
  state.editReturn=true;

  if(section==="participantes"){
    state.editPlayersOnly=true;
    prepareParticipants();
    $("tituloParticipantes").textContent="Editar jogadores dos times";
    $("textoParticipantes").textContent="As alterações nos jogadores são salvas automaticamente.";
    $("nomeParticipante").closest(".card").classList.add("hidden");
    $("btnAvancarRegras").textContent="Concluir";
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


function cloneCompetition(value){
  return JSON.parse(JSON.stringify(value));
}

function closeReorganizer(){
  $("modalReorganizar").classList.add("hidden");
  state.reorderDraft=null;
}

function openReorganizer(){
  if(!state.current||!state.admin)return;

  state.reorderDraft=cloneCompetition(state.current);
  state.reorderTab=(state.current.qualificatorias||[]).length
    ?"qualificatorias"
    :(state.current.formato==="grupos"?"grupos":"ordem");
  $("modalReorganizar").classList.remove("hidden");

  document.querySelectorAll(".reorganizer-tab").forEach(button=>{
    button.classList.toggle("active",button.dataset.reorderTab===state.reorderTab);
    if(button.dataset.reorderTab==="grupos"){
      button.classList.toggle("hidden",state.current.formato!=="grupos");
    }
    if(button.dataset.reorderTab==="qualificatorias"){
      button.classList.toggle("hidden",!(state.current.qualificatorias||[]).length);
    }
  });

  renderReorganizer();
}

function reorderParticipantById(id){
  return (state.reorderDraft?.participantes||[]).find(item=>item.id===id)||null;
}

function reorderGameById(id){
  return allGames(state.reorderDraft||{}).find(item=>item.id===id)||null;
}

function dragOptions(groupName){
  return{
    group:groupName,
    animation:170,
    delay:180,
    delayOnTouchOnly:true,
    touchStartThreshold:4,
    ghostClass:"reorder-ghost",
    chosenClass:"reorder-chosen",
    dragClass:"reorder-dragging",
    handle:".drag-handle"
  };
}

function initSortable(element,options={}){
  if(!element||!window.Sortable)return;
  new Sortable(element,{...dragOptions(options.group||"reorder"),...options});
}

function renderReorganizer(){
  const box=$("reorganizarConteudo");
  if(!state.reorderDraft)return;
  box.innerHTML="";

  if(state.reorderTab==="qualificatorias")renderReorderQualificatorias(box);
  else if(state.reorderTab==="grupos")renderReorderGroups(box);
  else if(state.reorderTab==="ordem")renderReorderGameOrder(box);
  else renderReorderBracket(box);
}


function qualifierSlotHtml(game,side){
  const id=game[`${side}Id`]||"";
  const name=game[side]||"A definir";
  return `
    <div class="bracket-drag-slot qualifier-drag-slot"
         data-qualifier-game="${game.id}"
         data-side="${side}"
         data-team-id="${esc(id)}"
         data-team-name="${esc(name)}">
      <span class="drag-handle">☰</span>
      <strong>${esc(name)}</strong>
    </div>
  `;
}

function renderReorderQualificatorias(box){
  const c=state.reorderDraft;
  const games=[...(c.qualificatorias||[])].sort((a,b)=>(a.index||0)-(b.index||0));

  if(!games.length){
    box.innerHTML='<div class="card muted">Esta competição não possui Qualificatórias.</div>';
    return;
  }

  const tip=document.createElement("div");
  tip.className="reorder-tip";
  tip.textContent="Arraste os times entre os confrontos das Qualificatórias. Partidas já realizadas ficam bloqueadas.";
  box.appendChild(tip);

  const grid=document.createElement("div");
  grid.className="reorder-qualifiers-grid";

  games.forEach((game,index)=>{
    const locked=!!game.encerrado;
    const card=document.createElement("section");
    card.className=`reorder-bracket-game${locked?" locked":""}`;
    card.innerHTML=`
      <div class="reorder-game-title">
        <strong>Qualificatória ${index+1}</strong>
        ${locked?'<span>🔒 Realizada</span>':'<span>Arraste os nomes</span>'}
      </div>
      <div class="qualifier-slot-list${locked?" bracket-slot-list-locked":""}"
           data-qualifier-match="${game.id}"
           data-locked="${locked?"1":"0"}">
        ${qualifierSlotHtml(game,"casa")}
        ${qualifierSlotHtml(game,"fora")}
      </div>
    `;
    grid.appendChild(card);

    if(!locked){
      initSortable(card.querySelector(".qualifier-slot-list"),{
        group:"qualifier-slots",
        sort:true,
        onEnd:updateQualificatoriasFromDOM
      });
    }
  });

  box.appendChild(grid);
}

function updateQualificatoriasFromDOM(){
  if(!state.reorderDraft)return;

  document.querySelectorAll(".qualifier-slot-list").forEach(list=>{
    const game=(state.reorderDraft.qualificatorias||[])
      .find(item=>item.id===list.dataset.qualifierMatch);
    if(!game||game.encerrado||list.dataset.locked==="1")return;

    const slots=[...list.querySelectorAll(".qualifier-drag-slot")];
    ["casa","fora"].forEach((side,index)=>{
      const slot=slots[index];
      game[`${side}Id`]=slot?.dataset.teamId||null;
      game[side]=slot?.dataset.teamName||"A definir";
    });
  });
}

function renderReorderGroups(box){
  const c=state.reorderDraft;
  const completed=(c.jogos||[]).some(game=>game.encerrado);

  if(completed){
    box.innerHTML=`
      <div class="reorder-warning">
        🔒 Os grupos estão bloqueados porque já existem jogos da fase de grupos realizados.
        A ordem dos jogos e os confrontos eliminatórios ainda podem ser ajustados.
      </div>
    `;
    return;
  }

  if(!(c.grupos||[]).length){
    box.innerHTML='<div class="card muted">Esta competição não possui grupos.</div>';
    return;
  }

  const intro=document.createElement("div");
  intro.className="reorder-tip";
  intro.textContent="Arraste um time para outra posição ou para outro grupo.";
  box.appendChild(intro);

  const grid=document.createElement("div");
  grid.className="reorder-groups-grid";

  c.grupos.forEach(group=>{
    const card=document.createElement("section");
    card.className="reorder-group-card";
    card.innerHTML=`<h3>Grupo ${esc(group.nome)}</h3><div class="reorder-list group-dropzone" data-group="${esc(group.nome)}"></div>`;
    grid.appendChild(card);

    const list=card.querySelector(".group-dropzone");
    (group.participantes||[]).forEach(participant=>{
      const item=document.createElement("div");
      item.className="reorder-item";
      item.dataset.participantId=participant.id;
      item.innerHTML=`<span class="drag-handle">☰</span><strong>${esc(participant.nome)}</strong>`;
      list.appendChild(item);
    });

    initSortable(list,{
      group:"competition-groups",
      onEnd:updateGroupsFromDOM
    });
  });

  box.appendChild(grid);
}

function updateGroupsFromDOM(){
  if(!state.reorderDraft)return;
  document.querySelectorAll(".group-dropzone").forEach(list=>{
    const group=state.reorderDraft.grupos.find(item=>String(item.nome)===String(list.dataset.group));
    if(!group)return;
    group.participantes=[...list.querySelectorAll("[data-participant-id]")]
      .map(item=>reorderParticipantById(item.dataset.participantId))
      .filter(Boolean);
  });
}

function gameLabel(game){
  const number=stableGameNumber(state.reorderDraft,game);
  return `Jogo ${number} · ${game.fase||"Partida"}${game.rodada?` · Rodada ${game.rodada}`:""}`;
}

function renderReorderGameOrder(box){
  const c=state.reorderDraft;
  const completed=allGames(c).filter(game=>game.encerrado).sort((a,b)=>stableGameNumber(c,a)-stableGameNumber(c,b));
  const pending=allGames(c).filter(game=>!game.encerrado).sort((a,b)=>stableGameNumber(c,a)-stableGameNumber(c,b));

  const tip=document.createElement("div");
  tip.className="reorder-tip";
  tip.textContent="Arraste apenas os jogos ainda não realizados. Os resultados já lançados ficam bloqueados.";
  box.appendChild(tip);

  if(completed.length){
    const locked=document.createElement("div");
    locked.className="reorder-locked-list";
    locked.innerHTML=`<h3>Jogos realizados</h3>${completed.map(game=>`
      <div class="reorder-item locked">
        <span>🔒</span>
        <div><strong>${esc(gameLabel(game))}</strong><small>${esc(game.casa)} × ${esc(game.fora)}</small></div>
      </div>
    `).join("")}`;
    box.appendChild(locked);
  }

  if(!pending.length){
    box.insertAdjacentHTML("beforeend",'<div class="card muted">Não há jogos pendentes para reorganizar.</div>');
    return;
  }

  const list=document.createElement("div");
  list.id="reorderGamesList";
  list.className="reorder-list";
  pending.forEach(game=>{
    const item=document.createElement("div");
    item.className="reorder-item";
    item.dataset.gameId=game.id;
    item.innerHTML=`
      <span class="drag-handle">☰</span>
      <div>
        <strong>${esc(gameLabel(game))}</strong>
        <small>${esc(game.casa||"A definir")} × ${esc(game.fora||"A definir")}</small>
      </div>
    `;
    list.appendChild(item);
  });
  box.appendChild(list);
  initSortable(list,{group:"game-order",onEnd:updateGameOrderFromDOM});
}

function updateGameOrderFromDOM(){
  const list=$("reorderGamesList");
  if(!list||!state.reorderDraft)return;

  const completed=allGames(state.reorderDraft)
    .filter(game=>game.encerrado)
    .sort((a,b)=>stableGameNumber(state.reorderDraft,a)-stableGameNumber(state.reorderDraft,b));

  completed.forEach((game,index)=>game.numeroJogo=index+1);

  [...list.querySelectorAll("[data-game-id]")].forEach((item,index)=>{
    const game=reorderGameById(item.dataset.gameId);
    if(game)game.numeroJogo=completed.length+index+1;
  });
}

function bracketSlotHtml(game,side){
  const id=game[`${side}Id`]||"";
  const name=game[side]||"A definir";
  return `
    <div class="bracket-drag-slot" data-game-id="${game.id}" data-side="${side}" data-team-id="${esc(id)}" data-team-name="${esc(name)}">
      <span class="drag-handle">☰</span>
      <strong>${esc(name)}</strong>
    </div>
  `;
}

function routingOptions(source){
  const later=(state.reorderDraft.eliminatorias||[])
    .filter(target=>!target.encerrado&&target.round>source.round&&target.fase!=="Disputa de 3º lugar")
    .sort((a,b)=>a.round-b.round||(a.index||0)-(b.index||0));

  const options=['<option value="">Sem destino automático</option>'];
  later.forEach(target=>{
    ["casa","fora"].forEach(side=>{
      const selected=source.nextMatchId===target.id&&source.nextSlot===side?" selected":"";
      options.push(`<option value="${target.id}|${side}"${selected}>${esc(target.fase)} · Jogo ${stableGameNumber(state.reorderDraft,target)} · ${side==="casa"?"posição de cima":"posição de baixo"}</option>`);
    });
  });
  return options.join("");
}

function renderReorderBracket(box){
  const c=state.reorderDraft;
  const games=[...(c.eliminatorias||[])].sort((a,b)=>a.round-b.round||(a.index||0)-(b.index||0));

  if(!games.length){
    box.innerHTML='<div class="card muted">Esta competição não possui fase eliminatória.</div>';
    return;
  }

  const tip=document.createElement("div");
  tip.className="reorder-tip";
  tip.textContent="Arraste os times entre os confrontos ainda não realizados. Também é possível escolher para onde o vencedor avançará.";
  box.appendChild(tip);

  const phases=[...new Set(games.map(game=>`${game.round}|${game.fase}`))];

  phases.forEach(key=>{
    const [roundText,phase]=key.split("|");
    const round=Number(roundText);
    const section=document.createElement("section");
    section.className="reorder-phase";
    section.innerHTML=`<h3>${esc(phase)}</h3>`;
    const phaseGames=games.filter(game=>game.round===round&&game.fase===phase);

    phaseGames.forEach(game=>{
      const adversariosDefinidos=!!game.casaId&&!!game.foraId;
      const bloqueado=game.encerrado||!adversariosDefinidos;
      const status=game.encerrado
        ? '<span>🔒 Realizado</span>'
        : !adversariosDefinidos
          ? '<span>🔒 Aguardando adversários</span>'
          : '<span>Arraste os nomes</span>';

      const card=document.createElement("div");
      card.className=`reorder-bracket-game${bloqueado?" locked":""}`;
      card.innerHTML=`
        <div class="reorder-game-title">
          <strong>Jogo ${stableGameNumber(c,game)}</strong>
          ${status}
        </div>
        <div class="bracket-slot-list${bloqueado?" bracket-slot-list-locked":""}" data-bracket-game="${game.id}" data-locked="${bloqueado?"1":"0"}">
          ${bracketSlotHtml(game,"casa")}
          ${bracketSlotHtml(game,"fora")}
        </div>
        ${!bloqueado&&game.fase!=="Final"&&game.fase!=="Disputa de 3º lugar"?`
          <label class="route-label">
            Vencedor avança para
            <select class="winner-route" data-source-game="${game.id}">
              ${routingOptions(game)}
            </select>
          </label>
        `:""}
      `;
      section.appendChild(card);

      if(!bloqueado){
        initSortable(card.querySelector(".bracket-slot-list"),{
          group:"bracket-slots",
          sort:true,
          onEnd:updateBracketFromDOM
        });
      }
    });

    box.appendChild(section);
  });

  box.querySelectorAll(".winner-route").forEach(select=>{
    select.onchange=()=>{
      const source=reorderGameById(select.dataset.sourceGame);
      if(!source)return;
      if(!select.value){
        source.nextMatchId=null;
        source.nextSlot=null;
        return;
      }
      const[targetId,slot]=select.value.split("|");
      source.nextMatchId=targetId;
      source.nextSlot=slot;
    };
  });
}

function updateBracketFromDOM(){
  if(!state.reorderDraft)return;
  document.querySelectorAll(".bracket-slot-list").forEach(list=>{
    const game=reorderGameById(list.dataset.bracketGame);
    if(!game||game.encerrado||list.dataset.locked==="1")return;

    const slots=[...list.querySelectorAll(".bracket-drag-slot")];
    ["casa","fora"].forEach((side,index)=>{
      const slot=slots[index];
      game[`${side}Id`]=slot?.dataset.teamId||null;
      game[side]=slot?.dataset.teamName||"A definir";
    });
  });
}

function validateWinnerRoutes(c){
  const used=new Set();
  for(const game of c.eliminatorias||[]){
    if(!game.nextMatchId||!game.nextSlot)continue;
    const target=(c.eliminatorias||[]).find(item=>item.id===game.nextMatchId);
    if(!target||target.round<=game.round)return "Um destino de vencedor aponta para uma fase inválida.";
    const key=`${game.nextMatchId}|${game.nextSlot}`;
    if(used.has(key))return "Dois vencedores estão apontando para a mesma posição da chave.";
    used.add(key);
  }
  return "";
}

function rebuildUnplayedGroupGames(c){
  if(c.formato!=="grupos"||(c.jogos||[]).some(game=>game.encerrado))return;

  const schedules=new Map();
  (c.jogos||[]).forEach(game=>{
    const key=[game.casaId,game.foraId].filter(Boolean).sort().join("|");
    schedules.set(key,{data:game.data||"",hora:game.hora||"",local:game.local||""});
  });

  c.jogos=createInterleavedGroupGames(c.grupos);
  c.jogos.forEach(game=>{
    const key=[game.casaId,game.foraId].filter(Boolean).sort().join("|");
    const schedule=schedules.get(key);
    if(schedule)Object.assign(game,schedule);
  });
}

async function saveReorganization(){
  if(!state.reorderDraft||!state.current)return;

  updateQualificatoriasFromDOM();
  updateGroupsFromDOM();
  updateGameOrderFromDOM();
  updateBracketFromDOM();

  const routeError=validateWinnerRoutes(state.reorderDraft);
  if(routeError)return toast(routeError);

  rebuildUnplayedGroupGames(state.reorderDraft);

  const payload={
    qualificatorias:state.reorderDraft.qualificatorias||[],
    grupos:state.reorderDraft.grupos||[],
    jogos:state.reorderDraft.jogos||[],
    eliminatorias:state.reorderDraft.eliminatorias||[],
    atualizadoEm:serverTimestamp()
  };

  load(true);
  try{
    await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",state.current.id),payload);
    state.current={...state.current,...cloneCompetition(payload)};
    delete state.current.atualizadoEm;
    closeReorganizer();
    openCompetition(state.current,true);
    toast("Reorganização salva.");
  }catch(error){
    console.error(error);
    toast("Erro ao salvar reorganização.");
  }finally{
    load(false);
  }
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
    [...(state.wizard.qualificatorias||[]),...state.wizard.jogos,...state.wizard.eliminatorias].forEach(g=>{
      const schedule=scheduleByMatch.get(matchupKey(g));
      if(schedule)Object.assign(g,schedule);
    });
  }

  const update={
    qualificatorias:state.wizard.qualificatorias||[],grupos:state.wizard.grupos,jogos:state.wizard.jogos,eliminatorias:state.wizard.eliminatorias,
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
    row.querySelector("button").onclick=()=>openCompetitionSafe(c,false);
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
    b.innerHTML=`<span>${sportIcon(c.esporte)}</span><strong>${esc(c.esporte)}</strong><small>${esc(c.modalidade)} · ${esc(turnoLabel(c.turno))}</small>`;
    b.onclick=()=>openCompetitionSafe(c,false);
    box.appendChild(b);
  });
}

function openStudentList(turn,camps){$("alunoTurnoLabel").textContent=turnoLabel(turn);const box=$("listaCampeonatosAluno");box.innerHTML="";camps.forEach(c=>{const b=document.createElement("button");b.className="school-item";b.innerHTML=`<span>${sportIcon(c.esporte)}</span><div><strong>${esc(c.esporte)} — ${esc(c.modalidade)}</strong><small>${c.participantes?.length||0} participantes · ${c.status==="encerrado"?"Encerrado":"Em andamento"}</small></div>`;b.onclick=()=>openCompetitionSafe(c,false);box.appendChild(b);});show("telaListaAluno");}

function renderStudentDashboard(c){
  const box=$("dashboardAluno");
  const finished=allGames(c).filter(g=>g.encerrado&&g.situacao!=="classificacaoDireta").length;
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
  const results=allGames(c).filter(g=>g.encerrado&&g.situacao!=="classificacaoDireta");
  const hasGroups=c.formato==="grupos"&&(c.grupos||[]).length>0;
  const hasQualificatorias=(c.qualificatorias||[]).length>0;
  const hasKnockout=(c.eliminatorias||[]).length>0;
  const finished=c.status==="encerrado"&&!!c.podio;

  const visibility={
    proximos:upcoming.length>0,
    resultados:true,
    qualificatorias:hasQualificatorias,
    classificacao:hasGroups,
    eliminatorias:hasKnockout,
    artilheiros:hasScorerData(c),
    podio:finished,
    resumoFinal:finished
  };

  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("hidden",!visibility[tab.dataset.tab]);
  });

  const preferred=["proximos","resultados","qualificatorias","classificacao","eliminatorias","artilheiros","podio","resumoFinal"];
  return preferred.find(name=>visibility[name])||"resultados";
}


function normalizeCompetition(c){
  return{
    ...c,
    participantes:Array.isArray(c.participantes)?c.participantes:[],
    qualificatorias:Array.isArray(c.qualificatorias)?c.qualificatorias:[],
    grupos:Array.isArray(c.grupos)?c.grupos:[],
    jogos:Array.isArray(c.jogos)?c.jogos:[],
    eliminatorias:Array.isArray(c.eliminatorias)?c.eliminatorias:[]
  };
}

function openCompetitionSafe(c,admin){
  try{
    const normalized=normalizeCompetition(c);
    openCompetition(normalized,admin===true);
  }catch(error){
    console.error("Erro ao abrir competição:",error,c);
    toast("Não foi possível abrir a competição. Atualize a página e tente novamente.");
  }
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

function isGameAvailable(c,g){if(g?.live?.ativo)return true;
  const loc=locateGame(c,g.id);
  if(!loc)return false;
  if(loc.list==="qualificatorias")return!g.encerrado;
  if(loc.list==="jogos")return!g.encerrado&&qualificatoriasConcluidas(c)&&!!g.casaId&&!!g.foraId;

  if(c.formato==="grupos"&&!groupStageComplete(c))return false;

  const round=currentEliminationRound(c);
  return!g.encerrado&&g.round===round&&!!g.casaId&&!!g.foraId;
}

function availableUpcomingGames(c){
  return allGames(c)
    .filter(game=>!game.encerrado)
    .sort((a,b)=>stableGameNumber(c,a)-stableGameNumber(c,b));
}

function stableGameNumber(c,g){
  if(g.numeroJogo)return g.numeroJogo;
  const all=[...(c.qualificatorias||[]),...(c.jogos||[]),...(c.eliminatorias||[])];
  return Math.max(1,all.findIndex(x=>x.id===g.id)+1);
}

function allGames(c){return[...(c.qualificatorias||[]),...(c.jogos||[]),...(c.eliminatorias||[])];}
function formatSchedule(j){const p=[];if(j.data)p.push(new Date(j.data+"T12:00:00").toLocaleDateString("pt-BR"));if(j.hora)p.push(j.hora);if(j.local)p.push(j.local);return p.join(" · ");}

function finishedSetScoresHtml(game){
  const sets=(game.sets||[]).filter(set=>
    set &&
    Number.isFinite(Number(set.casa)) &&
    Number.isFinite(Number(set.fora))
  );

  if(!sets.length){
    return `<div class="simple-score">${game.placarCasa??0} × ${game.placarFora??0}</div>`;
  }

  let winsCasa=0,winsFora=0;
  sets.forEach(set=>{
    const casa=Number(set.casa)||0;
    const fora=Number(set.fora)||0;
    if(casa>fora)winsCasa++;
    else if(fora>casa)winsFora++;
  });

  const homeWon=winsCasa>winsFora;
  const awayWon=winsFora>winsCasa;

  return `
    <div class="finished-set-scores" aria-label="Resultado e pontuação dos sets">
      <div class="finished-set-total" title="Sets vencidos">
        <strong class="${homeWon?"match-winner-number":""}">${winsCasa}</strong>
        <b>×</b>
        <strong class="${awayWon?"match-winner-number":""}">${winsFora}</strong>
      </div>
      <div class="finished-set-caption">placar em sets</div>
      <div class="finished-set-details">
        ${sets.map((set,index)=>{
          const casa=Number(set.casa)||0;
          const fora=Number(set.fora)||0;
          const homeSetWon=casa>fora;
          const awaySetWon=fora>casa;
          return `
            <div class="finished-set-line" title="Set ${index+1}">
              <small>${index+1}º</small>
              <span class="set-score-side ${homeSetWon?"set-winner":"set-loser"}">
                ${homeSetWon?'<i aria-hidden="true">✓</i>':""}<b>${casa}</b>
              </span>
              <em>×</em>
              <span class="set-score-side right ${awaySetWon?"set-winner":"set-loser"}">
                <b>${fora}</b>${awaySetWon?'<i aria-hidden="true">✓</i>':""}
              </span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTab(tab,admin=false){const c=state.current,box=$("conteudoAluno");box.innerHTML="";updateClassificationNote(tab,c);if(tab==="proximos"||tab==="resultados"){
    const list=tab==="proximos"
      ?availableUpcomingGames(c)
      :allGames(c)
        .filter(game=>game.encerrado&&game.situacao!=="classificacaoDireta")
        .sort((a,b)=>stableGameNumber(c,a)-stableGameNumber(c,b));

    if(!list.length){
      box.innerHTML=`<div class="card muted">${tab==="proximos"?"Nenhum jogo agendado.":"Nenhum resultado registrado."}</div>`;
      return;
    }

    const title=document.createElement("div");
    title.className="games-section-title";
    title.textContent=tab==="proximos"?"JOGOS":"RESULTADOS";
    box.appendChild(title);

    list.forEach(game=>{
      const available=isGameAvailable(c,game);
      const unresolved=!game.casaId||!game.foraId;

      const card=document.createElement("div");
      card.className=
        "simple-match-card"+
        (!available&&!game.encerrado?" locked-match":"");

      const isLive=game.live?.ativo&&!game.encerrado;

      const score=game.encerrado
        ?c.tipoPlacar==="sets"
          ?finishedSetScoresHtml(game)
          :`<div class="simple-score">${game.placarCasa??0} × ${game.placarFora??0}</div>`
        :isLive
          ?game.live.tipo==="sets"
            ?`<div class="live-game-score live-set-score">
                <span class="live-set-title">${liveSetTitle(c,game.live)}</span>
                <div class="live-set-line">
                  <b>${game.live.pontosCasa??0} × ${game.live.pontosFora??0}</b>
                </div>
                <small>● AO VIVO</small>
              </div>`
            :`<div class="simple-score live-game-score">${game.live.placarCasa??0} × ${game.live.placarFora??0}</div>`
          :`<div class="simple-versus">×</div>`;

      card.innerHTML=`
        <div class="simple-match-header">
          <span class="simple-match-number">Jogo ${stableGameNumber(c,game)}</span>
          <span class="simple-phase">
            ${esc(game.fase||"")}
            ${game.rodada?` · Rodada ${game.rodada}`:""}
          </span>
        </div>

        <div class="horizontal-match ${game.encerrado&&c.tipoPlacar==="sets"?"sets-result-match":""}">
          <div class="horizontal-team ${game.encerrado&&c.tipoPlacar==="sets"&&Number(game.placarCasa)>Number(game.placarFora)?"overall-winner-team":""}">${esc(game.casa||"A definir")}</div>
          ${score}
          <div class="horizontal-team ${game.encerrado&&c.tipoPlacar==="sets"&&Number(game.placarFora)>Number(game.placarCasa)?"overall-winner-team":""}">${esc(game.fora||"A definir")}</div>
        </div>

        ${isLive&&game.live?.tipo!=="sets"?'<div class="live-match-badge">● AO VIVO</div>':""}

        ${!game.encerrado&&!available
          ?`<div class="waiting-phase">${
            unresolved
              ?"Aguardando definição dos classificados"
              :"Aguardando conclusão da fase anterior"
          }</div>`
          :""}

        ${game.vencedorPenaltisNome
          ?`<div class="penalty-result">
              Pênaltis: ${game.penaltisCasa} × ${game.penaltisFora}<br>
              <strong>${esc(game.vencedorPenaltisNome)} venceu</strong>
            </div>`
          :""}
      `;

      if(admin){
        const button=document.createElement("button");

        if(tab==="resultados"){
          button.className="edit-result-btn";
          button.textContent="Editar resultado";
          button.onclick=event=>{
            event.stopPropagation();
            openResult(game);
          };
          card.classList.add("clickable");
          card.onclick=()=>openResult(game);
        }else if(available){
          button.className="launch-result-btn";
          button.textContent=isLive?"Atualizar placar":"Lançar resultado";
          button.onclick=event=>{
            event.stopPropagation();
            openResult(game);
          };
          card.classList.add("clickable");
          card.onclick=()=>openResult(game);
        }else{
          button.className="locked-button";
          button.textContent=unresolved?"Aguardando classificados":"Aguardando fase anterior";
          button.disabled=true;
        }

        card.appendChild(button);
      }

      box.appendChild(card);
    });

    return;
  }
  if(tab==="qualificatorias")return renderQualificatorias(c,box,admin);
  if(tab==="classificacao"){
    const t=$("tabClassificacao");
    const hasLive=(c.jogos||[]).some(game=>game.live?.ativo&&!game.encerrado);
    if(t)t.innerHTML=hasLive
      ?'Fase de grupos <span class="tab-live-dot"></span>'
      :'Fase de grupos';
    return renderClassification(c,box);
  }if(tab==="eliminatorias")return renderKnockout(c,box);if(tab==="artilheiros")return renderScorers(c,box);if(tab==="podio")return renderPodium(c,box);if(tab==="resumoFinal")return renderFinalSummary(c,box);}

let liveScoreTimer=null;


function bindLiveScoreControls(){
  const homeInput=$("placarCasa");
  const awayInput=$("placarFora");
  const controls=["maisCasa","menosCasa","maisFora","menosFora"];

  [homeInput,awayInput].forEach(input=>{
    if(!input||input.dataset.liveBound==="1")return;
    input.dataset.liveBound="1";
    input.addEventListener("input",scheduleLiveScoreSync);
    input.addEventListener("change",scheduleLiveScoreSync);
  });

  controls.forEach(id=>{
    const button=$(id);
    if(!button||button.dataset.liveBound==="1")return;
    button.dataset.liveBound="1";

    // Aguarda o botão alterar o número antes de enviar ao Firebase.
    button.addEventListener("click",()=>{
      setTimeout(scheduleLiveScoreSync,0);
    });
  });
}

function scheduleLiveScoreSync(){
  if(!state.current||!state.currentGame)return;
  if(state.current.formato!=="grupos")return;

  clearTimeout(liveScoreTimer);

  liveScoreTimer=setTimeout(async()=>{
    try{
      const competition=JSON.parse(JSON.stringify(state.current));
      const located=locateGame(competition,state.currentGame.id);
      if(!located||located.list!=="jogos")return;

      const game=competition.jogos[located.i];
      game.live={
        ativo:true,
        placarCasa:Math.max(0,Number($("placarCasa")?.value)||0),
        placarFora:Math.max(0,Number($("placarFora")?.value)||0),
        atualizadoEm:Date.now()
      };

      await updateDoc(
        doc(db,"escolas",state.school.id,"campeonatos",competition.id),
        {
          jogos:competition.jogos,
          atualizadoEm:serverTimestamp()
        }
      );

      state.current=competition;
      state.currentGame=competition.jogos[located.i];
    }catch(error){
      console.warn("Não foi possível atualizar a classificação ao vivo:",error);
    }
  },450);
}

async function clearLiveScore(gameId){
  if(!state.current||!gameId)return;

  try{
    const competition=JSON.parse(JSON.stringify(state.current));
    const located=locateGame(competition,gameId);
    if(!located)return;

    const game=competition[located.list][located.i];
    if(game?.live)delete game.live;

    await updateDoc(
      doc(db,"escolas",state.school.id,"campeonatos",competition.id),
      {
        jogos:competition.jogos||[],
        eliminatorias:competition.eliminatorias||[],
        atualizadoEm:serverTimestamp()
      }
    );

    state.current=competition;
  }catch(error){
    console.warn("Não foi possível encerrar o placar ao vivo:",error);
  }
}

function standings(c,g){
  const participants=Array.isArray(g?.participantes)?g.participantes:[];
  const usesSets=c.tipoPlacar==="sets";
  const table=participants.map(team=>({
    id:team.id,
    nome:team.nome,
    pts:0,
    j:0,
    gp:0,
    gc:0,
    sv:0,
    pm:0,
    aoVivo:false
  }));

  const byId=Object.fromEntries(table.map(row=>[row.id,row]));

  (c.jogos||[])
    .filter(game=>
      game.fase===`Grupo ${g.nome}`&&
      game.situacao!=="cancelado"&&
      game.situacao!=="adiado"&&
      (game.encerrado||game.live?.ativo)
    )
    .forEach(game=>{
      const home=byId[game.casaId];
      const away=byId[game.foraId];
      if(!home||!away)return;

      const live=game.live?.ativo&&!game.encerrado;
      const homeScore=live
        ?Number(game.live.placarCasa)||0
        :Number(game.placarCasa)||0;
      const awayScore=live
        ?Number(game.live.placarFora)||0
        :Number(game.placarFora)||0;

      home.j++;
      away.j++;
      home.gp+=homeScore;
      home.gc+=awayScore;
      away.gp+=awayScore;
      away.gc+=homeScore;

      if(usesSets){
        const sets=live
          ?(game.live?.sets||[])
          :(game.sets||[]);

        home.sv+=homeScore;
        away.sv+=awayScore;

        sets.forEach(set=>{
          home.pm+=Number(set.casa)||0;
          away.pm+=Number(set.fora)||0;
        });
      }

      if(live){
        home.aoVivo=true;
        away.aoVivo=true;
      }

      if(homeScore>awayScore){
        home.pts+=3;
      }else if(awayScore>homeScore){
        away.pts+=3;
      }else{
        home.pts++;
        away.pts++;
      }
    });

  return table.sort((a,b)=>compareStandingRows(c,a,b));
}


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

  if(c.quantidadeGrupos===3){
    if(c.regraClassificacao==="lideres3Semi")return 1;
    if(c.regraClassificacao==="top2Mais2Terceiros")return 2;
  }

  if(c.quantidadeGrupos===4){
    if(c.regraClassificacao==="lideres4Semi")return 1;
    if(c.regraClassificacao==="top2Quarta")return 2;
  }

  return 0;
}

function classificationCriteriaText(c){
  const base=c.tipoPlacar==="sets"
    ?"Critérios de desempate: pontos, sets vencidos, pontos marcados e ordem alfabética."
    :"Critérios de desempate: pontos, saldo de gols/pontos, gols/pontos pró e ordem alfabética.";

  const rules={
    campeaoGrupo:"O 1º recebe ouro, o 2º prata e o 3º bronze.",
    final2:"1º e 2º fazem a final; o 3º recebe bronze direto.",
    semi4:"Os 4 primeiros fazem semifinais; os perdedores disputam o 3º lugar.",
    lideresFinal:"Os líderes fazem a final; o melhor 2º colocado recebe bronze.",
    top2grupo:"Os 2 melhores de cada grupo fazem semifinais e os perdedores disputam o 3º lugar.",
    lideres3Semi:"Os líderes dos 3 grupos e o melhor 2º colocado fazem as semifinais.",
    top2Mais2Terceiros:"Os 2 melhores de cada grupo e os 2 melhores 3º colocados avançam às quartas.",
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

function classificationLegend(c){
  return c.tipoPlacar==="sets"
    ?"P = Pontos · J = Jogos · SV = Sets vencidos · PM = Pontos marcados"
    :"P = Pontos · J = Jogos · SG = Saldo de gols/pontos · GP = Gols/pontos pró";
}

function renderClassification(c,box){
  if(c.formato!=="grupos"){
    box.innerHTML='<div class="card muted">Essa competição não possui fase de grupos.</div>';
    return;
  }

  const usesSets=c.tipoPlacar==="sets";
  const col3=usesSets?"SV":"SG";
  const col4=usesSets?"PM":"GP";

  c.grupos.forEach((group,groupIndex)=>{
    const rows=standings(c,group);
    const qualified=qualifiedCountForGroup(c,groupIndex);
    const wrapper=document.createElement("div");

    wrapper.className="table-wrap compact-standings";
    wrapper.innerHTML=`<table>
      <thead>
        <tr>
          <th>Grupo ${group.nome}</th>
          <th>P</th>
          <th>J</th>
          <th>${col3}</th>
          <th>${col4}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row,index)=>`
          <tr class="${index<qualified?"qualified":""}">
            <td>${index+1}º ${row.aoVivo?'<span class="live-dot" title="Jogando agora"></span>':""}${esc(row.nome)}${index<qualified?' <span title="Classificado">✓</span>':""}</td>
            <td>${row.pts}</td>
            <td>${row.j}</td>
            <td>${usesSets?row.sv:row.gp-row.gc}</td>
            <td>${usesSets?row.pm:row.gp}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="classification-symbols">${classificationLegend(c)}</div>`;

    box.appendChild(wrapper);
  });
}




function bracketSetScoreCells(game,side){
  if(!game?.encerrado)return"";

  const sets=game.sets||[];

  if(!sets.length){
    const score=side==="casa"?game.placarCasa:game.placarFora;
    return `<span class="bracket-score-cell">${score??""}</span>`;
  }

  return sets.map(set=>{
    const score=side==="casa"
      ?Number(set.casa)||0
      :Number(set.fora)||0;

    return `<span class="bracket-score-cell">${score}</span>`;
  }).join("");
}



function normalizeBracketName(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toUpperCase()
    .replace(/\s+/g," ")
    .trim();
}

function sourceLabelForSlot(c,game,slot){
  const currentName=slot==="casa"?game.casa:game.fora;
  const currentId=slot==="casa"?game.casaId:game.foraId;

  // Se a vaga já tem participante definido, mostra o nome completo.
  if(currentId&&currentName&&normalizeBracketName(currentName)!=="A DEFINIR"){
    return currentName;
  }

  // Procura somente a partida imediatamente anterior que alimenta esta vaga.
  const source=(c.eliminatorias||[])
    .filter(item=>
      String(item.nextMatchId||"")===String(game.id)&&
      item.nextSlot===slot
    )
    .sort((a,b)=>(a.index||0)-(b.index||0))[0];

  if(!source)return"A definir";

  const homeDefined=
    source.casaId&&
    source.casa&&
    normalizeBracketName(source.casa)!=="A DEFINIR";

  const awayDefined=
    source.foraId&&
    source.fora&&
    normalizeBracketName(source.fora)!=="A DEFINIR";

  // Exemplo: TIME A ou TIME B.
  // Não busca fases anteriores e não junta quatro ou mais times.
  if(homeDefined&&awayDefined){
    return`${source.casa} ou ${source.fora}`;
  }

  return"A definir";
}

function renderKnockout(c,box){
  const games=c.eliminatorias||[];

  if(!games.length){
    box.innerHTML='<div class="card muted">Não há eliminatórias.</div>';
    return;
  }

  const thirdPlaceGames=games
    .filter(game=>game.fase==="Disputa de 3º lugar")
    .sort((a,b)=>(a.index||0)-(b.index||0));

  const normalGames=games.filter(game=>game.fase!=="Disputa de 3º lugar");

  const phases=[...new Set(normalGames.map(game=>game.fase))].sort((phaseA,phaseB)=>{
    const gamesA=normalGames.filter(game=>game.fase===phaseA);
    const gamesB=normalGames.filter(game=>game.fase===phaseB);
    const roundA=Math.min(...gamesA.map(game=>game.round));
    const roundB=Math.min(...gamesB.map(game=>game.round));

    if(roundA!==roundB)return roundA-roundB;
    if(phaseA==="Final"&&phaseB!=="Final")return 1;
    if(phaseB==="Final"&&phaseA!=="Final")return-1;
    return phaseA.localeCompare(phaseB);
  });

  const viewport=document.createElement("div");
  viewport.className="single-phase-viewport";

  const flow=document.createElement("div");
  flow.className="bracket-flow single-phase-flow";

  const renderGameCard=(game,isThirdPlace=false)=>{
    const winner=gameWinner(game);
    const direct=game.situacao==="classificacaoDireta";
    const card=document.createElement("div");

    card.className="bracket-match"+(isThirdPlace?" third-place":"");

    const homeLabel=sourceLabelForSlot(c,game,"casa");
    const awayLabel=sourceLabelForSlot(c,game,"fora");

    card.innerHTML=`
      <small>${direct?"Classificação direta":`Jogo ${stableGameNumber(c,game)}`}</small>

      <div class="bracket-team ${winner?.id===game.casaId?"winner":game.encerrado&&winner&&!direct?"loser":""}">
        <span>${esc(homeLabel)}</span>
        <strong class="bracket-set-scores">${!direct?bracketSetScoreCells(game,"casa"):""}</strong>
      </div>

      <div class="bracket-team ${winner?.id===game.foraId?"winner":game.encerrado&&winner&&!direct?"loser":""}">
        <span>${esc(awayLabel)}</span>
        <strong class="bracket-set-scores">${!direct?bracketSetScoreCells(game,"fora"):""}</strong>
      </div>

      ${direct?'<small>Avança sem disputar partida</small>':""}

      ${game.vencedorPenaltisNome
        ?`<small>Pênaltis: ${game.penaltisCasa} × ${game.penaltisFora} — ${esc(game.vencedorPenaltisNome)}</small>`
        :""}
    `;

    return card;
  };

  phases.forEach(phase=>{
    const column=document.createElement("section");
    column.className="bracket-column single-phase-column";
    column.innerHTML=`<h3>${esc(phase)}</h3>`;

    normalGames
      .filter(game=>game.fase===phase)
      .sort((a,b)=>(a.index||0)-(b.index||0))
      .forEach(game=>{
        column.appendChild(renderGameCard(game,false));
      });

    if(phase==="Final"&&thirdPlaceGames.length){
      const heading=document.createElement("div");
      heading.className="third-place-heading";
      heading.textContent="Disputa de 3º lugar";
      column.appendChild(heading);

      thirdPlaceGames.forEach(game=>{
        column.appendChild(renderGameCard(game,true));
      });
    }

    flow.appendChild(column);
  });

  viewport.appendChild(flow);
  box.appendChild(viewport);
}
function renderScorers(c,box){const a=[];c.participantes.forEach(p=>(p.jogadores||[]).forEach(j=>a.push({...j,time:p.nome})));a.sort((x,y)=>(y.gols||0)-(x.gols||0));if(!a.length){box.innerHTML='<div class="card muted">Nenhum jogador cadastrado.</div>';return;}a.forEach((j,i)=>{const e=document.createElement("div");e.className="admin-item";e.innerHTML=`<div><strong>${i+1}º ${esc(j.nome)}</strong><small>${esc(j.time)}</small></div><strong>${j.gols||0} gols</strong>`;box.appendChild(e);});}
function renderPodium(c,box){if(!c.podio){box.innerHTML='<div class="card muted">O pódio aparecerá quando o campeonato for finalizado.</div>';return;}box.innerHTML=`<div class="podium"><div class="podium-place second"><span>🥈</span><strong>${esc(c.podio.segundo||"—")}</strong><small>2º lugar</small></div><div class="podium-place first"><span>🥇</span><strong>${esc(c.podio.primeiro||"—")}</strong><small>Campeão</small></div><div class="podium-place third"><span>🥉</span><strong>${esc(c.podio.terceiro||"—")}</strong><small>3º lugar</small></div></div>`;}
function locateGame(c,id){let i=(c.qualificatorias||[]).findIndex(j=>j.id===id);if(i>=0)return{list:"qualificatorias",i};i=(c.jogos||[]).findIndex(j=>j.id===id);if(i>=0)return{list:"jogos",i};i=(c.eliminatorias||[]).findIndex(j=>j.id===id);return i>=0?{list:"eliminatorias",i}:null;}

function updateGameDetailsToggle(){
  const box=$("detalhesJogoBox");
  const button=$("btnMostrarDetalhesJogo");
  if(!box||!button)return;

  const opened=!box.classList.contains("hidden");
  button.textContent=opened
    ?"− Ocultar data, horário e local"
    :"＋ Adicionar data, horário ou local";
}

function toggleGameDetails(){
  $("detalhesJogoBox").classList.toggle("hidden");
  updateGameDetailsToggle();
}


function isKnockoutGame(c,g){
  return !!locateGame(c,g.id) && ["eliminatorias","qualificatorias"].includes(locateGame(c,g.id).list);
}

function updatePenaltyBox(){
  if(!state.current||!state.currentGame)return;

  const tied=Number($("placarCasa").value||0)===Number($("placarFora").value||0);
  const normal=$("situacaoJogo").value==="normal";
  const simpleScore=state.current.tipoPlacar!=="sets";
  const showBox=isKnockoutGame(state.current,state.currentGame)&&tied&&normal&&simpleScore;

  $("penaltisBox").classList.toggle("hidden",!showBox);
}

function loadPenaltyFields(g){
  $("vencedorPenaltis").innerHTML=`
    <option value="">Selecione</option>
    <option value="${g.casaId||""}">${esc(g.casa)}</option>
    <option value="${g.foraId||""}">${esc(g.fora)}</option>
  `;
  $("vencedorPenaltis").value=g.vencedorPenaltisId||"";
  $("penaltisCasa").value=g.penaltisCasa??0;
  $("penaltisFora").value=g.penaltisFora??0;
  $("labelPenaltisCasa").textContent=g.casa;
  $("labelPenaltisFora").textContent=g.fora;
}


let liveGameTimer=null;

function bindLiveGameControls(){
  const home=$("placarCasa");
  const away=$("placarFora");
  const controls=["maisCasa","menosCasa","maisFora","menosFora"];

  [home,away].forEach(input=>{
    if(!input||input.dataset.liveGameBound==="1")return;
    input.dataset.liveGameBound="1";
    input.addEventListener("input",scheduleLiveGameSync);
    input.addEventListener("change",scheduleLiveGameSync);
  });

  controls.forEach(id=>{
    const button=$(id);
    if(!button||button.dataset.liveGameBound==="1")return;
    button.dataset.liveGameBound="1";
    button.addEventListener("click",()=>setTimeout(scheduleLiveGameSync,0));
  });
}


function liveSetTitle(c,live){
  return (c?.formatoSets||"unico")==="unico"
    ?"SET ÚNICO"
    :`SET ${live?.setAtual||1}`;
}


function displayedSetScore(game,side){
  const sets=game?.sets||[];
  if(!sets.length){
    return side==="casa"
      ?game?.placarCasa??""
      :game?.placarFora??"";
  }

  // Set único: exibe diretamente 25 x 14, por exemplo.
  if((game?.formatoSets||state.current?.formatoSets||"unico")==="unico"||sets.length===1){
    const set=sets[0]||{};
    return side==="casa"
      ?Number(set.casa)||0
      :Number(set.fora)||0;
  }

  // Melhor de 3/5: cada linha recebe a sequência de pontos do respectivo time.
  return sets.map(set=>
    side==="casa"
      ?Number(set.casa)||0
      :Number(set.fora)||0
  ).join(" / ");
}

function setPointsSummary(game){
  const sets=game?.sets||[];
  if(!sets.length)return"";

  return sets.map((set,index)=>
    `Set ${index+1}: ${Number(set.casa)||0} × ${Number(set.fora)||0}`
  ).join(" · ");
}

function getLiveGamePayload(){
  const usesSets=(state.current?.tipoPlacar||"pontos")==="sets";

  if(usesSets){
    const sets=JSON.parse(JSON.stringify(state.setDraft||[]));
    const currentIndex=Math.max(0,sets.length-1);
    const currentSet=sets[currentIndex]||{casa:0,fora:0};

    let homeSets=0;
    let awaySets=0;

    sets.forEach(set=>{
      const home=Number(set.casa)||0;
      const away=Number(set.fora)||0;
      if(home>away)homeSets++;
      if(away>home)awaySets++;
    });

    return{
      ativo:true,
      tipo:"sets",
      sets,
      setAtual:currentIndex+1,
      pontosCasa:Number(currentSet.casa)||0,
      pontosFora:Number(currentSet.fora)||0,
      placarCasa:homeSets,
      placarFora:awaySets,
      atualizadoEm:Date.now()
    };
  }

  return{
    ativo:true,
    tipo:"placar",
    placarCasa:Math.max(0,Number($("placarCasa")?.value)||0),
    placarFora:Math.max(0,Number($("placarFora")?.value)||0),
    pontuacoesBasquete:JSON.parse(JSON.stringify(state.basketHistory||[])),
    atualizadoEm:Date.now()
  };
}

function getResultDraftPayload(){
  return{
    data:$("dataJogo")?.value||"",
    hora:$("horaJogo")?.value||"",
    local:$("localJogo")?.value?.trim()||"",
    situacao:$("situacaoJogo")?.value||"normal",
    placarCasa:Math.max(0,Number($("placarCasa")?.value)||0),
    placarFora:Math.max(0,Number($("placarFora")?.value)||0),
    sets:JSON.parse(JSON.stringify(state.setDraft||[])),
    vencedorPenaltisId:$("vencedorPenaltis")?.value||"",
    penaltisCasa:Math.max(0,Number($("penaltisCasa")?.value)||0),
    penaltisFora:Math.max(0,Number($("penaltisFora")?.value)||0),
    gols:[...document.querySelectorAll("#golsFutsal select")].map(select=>({lado:select.dataset.side,jogadorId:select.value})).filter(item=>item.jogadorId),
    pontuacoesBasquete:JSON.parse(JSON.stringify(state.basketHistory||[])),
    atualizadoEm:Date.now()
  };
}

function scheduleLiveGameSync(){
  if(!state.current||!state.currentGame)return;

  clearTimeout(liveGameTimer);

  liveGameTimer=setTimeout(async()=>{
    try{
      const competition=JSON.parse(JSON.stringify(state.current));
      const located=locateGame(competition,state.currentGame.id);
      if(!located)return;

      competition[located.list][located.i].live=getLiveGamePayload();
      competition[located.list][located.i].rascunhoResultado=getResultDraftPayload();

      await updateDoc(
        doc(db,"escolas",state.school.id,"campeonatos",competition.id),
        {
          qualificatorias:competition.qualificatorias||[],
          jogos:competition.jogos||[],
          eliminatorias:competition.eliminatorias||[],
          atualizadoEm:serverTimestamp()
        }
      );

      state.current=competition;
      state.currentGame=competition[located.list][located.i];
    }catch(error){
      console.warn("Não foi possível atualizar o jogo ao vivo:",error);
    }
  },350);
}

async function clearLiveGame(gameId){
  if(!state.current||!gameId)return;

  try{
    const competition=JSON.parse(JSON.stringify(state.current));
    const located=locateGame(competition,gameId);
    if(!located)return;

    const game=competition[located.list][located.i];
    if(game?.live)delete game.live;

    await updateDoc(
      doc(db,"escolas",state.school.id,"campeonatos",competition.id),
      {
        jogos:competition.jogos||[],
        eliminatorias:competition.eliminatorias||[],
        atualizadoEm:serverTimestamp()
      }
    );

    state.current=competition;
  }catch(error){
    console.warn("Não foi possível encerrar o jogo ao vivo:",error);
  }
}


function isBasketballCompetition(){
  return ["Basquete","Basquete 3x3"].includes(state.current?.esporte);
}

function basketSideName(side){
  if(!state.currentGame)return side==="casa"?"Casa":"Fora";
  return side==="casa"?state.currentGame.casa:state.currentGame.fora;
}

function renderBasketHistory(){
  const homeTotal=$("basketCasaTotal");
  const awayTotal=$("basketForaTotal");
  if(homeTotal)homeTotal.textContent=String(Math.max(0,Number($("placarCasa")?.value)||0));
  if(awayTotal)awayTotal.textContent=String(Math.max(0,Number($("placarFora")?.value)||0));
  const box=$("historicoBasquete");
  if(!box)return;
  const history=state.basketHistory||[];
  if(!history.length){
    box.innerHTML='<div class="basket-history-empty">Nenhuma pontuação registrada.</div>';
    return;
  }
  box.innerHTML=history.slice().reverse().map(item=>{
    const time=item.horario||new Date(item.timestamp||Date.now()).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    return `<div class="basket-history-item"><span><strong>${esc(basketSideName(item.lado))}</strong> marcou +${Number(item.pontos)||0}</span><small>${esc(time)}</small></div>`;
  }).join("");
}

function updateBasketLockUI(){
  const buttons=["basketCasa2","basketCasa3","basketFora2","basketFora3"].map($).filter(Boolean);
  const info=$("basketLockInfo");
  const remaining=Math.max(0,state.basketLockUntil-Date.now());
  const locked=remaining>0;
  buttons.forEach(button=>button.disabled=locked);
  if(info){
    info.textContent=locked?`Aguarde ${Math.ceil(remaining/1000)}s para registrar outra pontuação.`:"Pronto para registrar a próxima pontuação.";
    info.classList.toggle("locked",locked);
  }
  clearTimeout(state.basketLockTimer);
  if(locked)state.basketLockTimer=setTimeout(updateBasketLockUI,250);
}

function addBasketPoints(side,points){
  if(!isBasketballCompetition()||!state.currentGame)return;
  const now=Date.now();
  if(now<state.basketLockUntil){
    toast(`Aguarde ${Math.ceil((state.basketLockUntil-now)/1000)} segundos.`);
    return;
  }
  const input=side==="casa"?$("placarCasa"):$("placarFora");
  input.value=Math.max(0,Number(input.value)||0)+points;
  state.basketHistory.push({lado:side,pontos:points,timestamp:now,horario:new Date(now).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})});
  state.basketLockUntil=now+10000;
  renderBasketHistory();
  updateBasketLockUI();
  updatePenaltyBox();
  updateClassificationPreview();
  scheduleLiveGameSync();
  scheduleLiveScoreSync();
}

function openResult(g){
  if(!g.encerrado&&!isGameAvailable(state.current,g)){
    return toast("Finalize todos os jogos da fase anterior primeiro.");
  }

  state.currentGame=g;
  const draft=g.rascunhoResultado||g;
  state.resultSidesInverted=false;
  $("telaResultado")?.classList.remove("sides-inverted");
  $("tituloJogoResultado").textContent=`Jogo ${stableGameNumber(state.current,g)} — ${g.casa} × ${g.fora}`;
  $("timeCasaNome").textContent=g.casa;
  $("timeForaNome").textContent=g.fora;
  $("dataJogo").value=draft.data||"";
  $("horaJogo").value=draft.hora||"";
  $("localJogo").value=draft.local||"";

  const hasDetails=!!(draft.data||draft.hora||draft.local);
  $("detalhesJogoBox").classList.toggle("hidden",!hasDetails);
  updateGameDetailsToggle();

  $("situacaoJogo").value=draft.situacao||"normal";
  const basketball=isBasketballCompetition();
  $("placarSimplesBox").classList.toggle("hidden",state.current.tipoPlacar==="sets"||basketball);
  $("placarBasqueteBox").classList.toggle("hidden",!basketball);
  $("placarSetsBox").classList.toggle("hidden",state.current.tipoPlacar!=="sets");
  $("golsFutsalBox").classList.toggle("hidden",!["Futsal","Handebol"].includes(state.current.esporte));
  $("placarCasa").value=draft.placarCasa??0;
  $("placarFora").value=draft.placarFora??0;
  $("basketCasaNome").textContent=g.casa;
  $("basketForaNome").textContent=g.fora;
  state.basketHistory=JSON.parse(JSON.stringify(draft.pontuacoesBasquete||g.pontuacoesBasquete||[]));
  const lastBasketPoint=state.basketHistory[state.basketHistory.length-1];
  state.basketLockUntil=basketball&&lastBasketPoint?.timestamp?Number(lastBasketPoint.timestamp)+10000:0;
  renderBasketHistory();
  updateBasketLockUI();
  loadPenaltyFields({...g,...draft});

  state.setDraft=JSON.parse(JSON.stringify(draft.sets||g.sets||[]));
  if(state.current.tipoPlacar==="sets"&&!state.setDraft.length){
    state.setDraft=[{casa:0,fora:0}];
  }

  renderSets();
  renderGoalInputs();
  updateGoalInputs();
  updatePenaltyBox();
  updateClassificationPreview();
  show("telaResultado");
  bindLiveGameControls();
  scheduleLiveGameSync();
  bindLiveScoreControls();

  // A partida passa a ser identificada como ao vivo assim que o editor abre.
  scheduleLiveScoreSync();
}

function swapCurrentGameSides(){
  if(!state.currentGame)return;

  state.resultSidesInverted=!state.resultSidesInverted;
  $("telaResultado")?.classList.toggle("sides-inverted",state.resultSidesInverted);

  const button=$("btnInverterLados");
  if(button){
    button.textContent=state.resultSidesInverted
      ?"⇄ Voltar lados originais"
      :"⇄ Inverter lados da tela";
  }

  toast(state.resultSidesInverted
    ?"Lados invertidos apenas na tela."
    :"Lados originais restaurados.");
}
function previewStandingsForCurrentGame(){
  const c=state.current;
  const g=state.currentGame;

  if(!c||!g||c.formato!=="grupos")return null;

  const groupName=String(g.fase||"").replace("Grupo ","");
  const group=(c.grupos||[]).find(item=>item.nome===groupName);
  if(!group)return null;

  const clone=JSON.parse(JSON.stringify(c));
  const located=locateGame(clone,g.id);
  if(!located||located.list!=="jogos")return null;

  const game=clone.jogos[located.i];
  game.live=getLiveGamePayload();
  game.encerrado=false;
  game.situacao=$("situacaoJogo")?.value||"normal";

  return{
    group,
    rows:standings(clone,group)
  };
}
function knockoutPathForCurrentGame(){
  const c=state.current;
  const game=state.currentGame;
  if(!c||!game||c.formato!=="eliminatoria")return null;

  const bracket=c.eliminatorias||[];
  const next=game.nextMatchId?bracket.find(item=>item.id===game.nextMatchId):null;

  if(!next){
    return{
      title:"Partida decisiva",
      text:game.fase==="Final"
        ?"O vencedor será o campeão."
        :"Esta partida não possui confronto seguinte cadastrado."
    };
  }

  const opponent=game.nextSlot==="casa"
    ?next.fora||"A definir"
    :next.casa||"A definir";

  return{
    title:`Próxima fase: ${next.fase}`,
    text:`O vencedor desta partida enfrentará ${opponent}.`
  };
}

function updateClassificationPreview(){
  const box=$("previewClassificacaoJogo");
  if(!box)return;

  const knockout=knockoutPathForCurrentGame();

  if(knockout){
    box.className="knockout-path-card";
    box.innerHTML=`
      <strong>${esc(knockout.title)}</strong>
      <span>${esc(knockout.text)}</span>
    `;
    return;
  }

  box.className="classification-preview hidden";
  const preview=previewStandingsForCurrentGame();

  if(!preview){
    box.innerHTML="";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML=`
    <div class="classification-preview-title">
      <strong>Prévia da classificação</strong>
      <span>Atualiza enquanto o placar é digitado</span>
    </div>
    <div class="classification-preview-grid classification-preview-header">
      <span>Time</span><span>P</span><span>J</span>
      <span>${state.current.tipoPlacar==="sets"?"SV":"SG"}</span>
      <span>${state.current.tipoPlacar==="sets"?"PM":"GP"}</span>
    </div>
    ${preview.rows.map((row,index)=>`
      <div class="classification-preview-grid">
        <strong>${index+1}º ${esc(row.nome)}</strong>
        <span>${row.pts}</span>
        <span>${row.j}</span>
        <span>${state.current.tipoPlacar==="sets"?row.sv:row.gp-row.gc}</span>
        <span>${state.current.tipoPlacar==="sets"?row.pm:row.gp}</span>
      </div>
    `).join("")}
    <div class="classification-symbols">${classificationLegend(state.current)}</div>
  `;
}

function changeSetPoint(index,side,delta){
  const set=state.setDraft[index];
  if(!set)return;
  set[side]=Math.max(0,(Number(set[side])||0)+delta);
  renderSets();
  updateClassificationPreview();
  scheduleLiveGameSync();
}

function renderSets(){
  const box=$("listaSets");
  box.innerHTML="";

  state.setDraft.forEach((set,index)=>{
    const card=document.createElement("div");
    card.className="volley-set-card";
    card.innerHTML=`
      <div class="volley-set-header">
        <strong>Set ${index+1}</strong>
        ${state.setDraft.length>1?'<button type="button" class="volley-set-delete">Excluir</button>':""}
      </div>
      <div class="volley-score-board">
        <div class="volley-score-side">
          <strong class="volley-team-name">${esc(state.currentGame?.casa||"Time A")}</strong>
          <div class="score-control compact-score">
            <button type="button" class="ghost" data-minus-home>−</button>
            <input type="number" min="0" value="${Number(set.casa)||0}" data-home>
            <button type="button" data-plus-home>＋</button>
          </div>
        </div>
        <span class="mobile-score-x">×</span>
        <div class="volley-score-side">
          <strong class="volley-team-name">${esc(state.currentGame?.fora||"Time B")}</strong>
          <div class="score-control compact-score">
            <button type="button" class="ghost" data-minus-away>−</button>
            <input type="number" min="0" value="${Number(set.fora)||0}" data-away>
            <button type="button" data-plus-away>＋</button>
          </div>
        </div>
      </div>
    `;

    card.querySelector("[data-home]").oninput=event=>{
      state.setDraft[index].casa=Math.max(0,Number(event.target.value)||0);updateClassificationPreview();scheduleLiveGameSync();
    };
    card.querySelector("[data-away]").oninput=event=>{
      state.setDraft[index].fora=Math.max(0,Number(event.target.value)||0);updateClassificationPreview();scheduleLiveGameSync();
    };
    card.querySelector("[data-minus-home]").onclick=()=>changeSetPoint(index,"casa",-1);
    card.querySelector("[data-plus-home]").onclick=()=>changeSetPoint(index,"casa",1);
    card.querySelector("[data-minus-away]").onclick=()=>changeSetPoint(index,"fora",-1);
    card.querySelector("[data-plus-away]").onclick=()=>changeSetPoint(index,"fora",1);

    const deleteButton=card.querySelector(".volley-set-delete");
    if(deleteButton){
      deleteButton.onclick=()=>{
        state.setDraft.splice(index,1);
        renderSets();
        updateClassificationPreview();
        scheduleLiveGameSync();
      };
    }
    box.appendChild(card);
  });
}
function renderGoalInputs(){
  const c=state.current;
  const g=state.currentGame;
  const homeTeam=(c.participantes||[]).find(team=>team.id===g.casaId);
  const awayTeam=(c.participantes||[]).find(team=>team.id===g.foraId);
  const box=$("golsFutsal");

  box.innerHTML=`
    <label>Gols de ${esc(g.casa)}</label>
    <div id="golsCasaInputs"></div>
    <label>Gols de ${esc(g.fora)}</label>
    <div id="golsForaInputs"></div>
  `;

  box.dataset.casa=JSON.stringify(homeTeam?.jogadores||[]);
  box.dataset.fora=JSON.stringify(awayTeam?.jogadores||[]);
}

function goalSelect(players,side,value=""){
  const select=document.createElement("select");
  select.dataset.side=side;
  select.innerHTML=`
    <option value="">Não informar</option>
    <option value="golContra">Gol contra</option>
    ${players.map(player=>`<option value="${player.id}">${esc(player.nome)}</option>`).join("")}
  `;
  select.value=value||"";
  select.onchange=scheduleLiveGameSync;
  return select;
}

function selectedGoalValues(side){
  return [...document.querySelectorAll(`#golsFutsal select[data-side="${side}"]`)]
    .map(select=>select.value);
}

function savedGoalValues(side){
  return (state.currentGame?.rascunhoResultado?.gols||state.currentGame?.gols||[])
    .filter(goal=>goal.lado===side)
    .map(goal=>goal.jogadorId||"");
}

function updateGoalInputs(){
  if(!["Futsal","Handebol"].includes(state.current?.esporte))return;

  const box=$("golsFutsal");
  const homeBox=$("golsCasaInputs");
  const awayBox=$("golsForaInputs");
  if(!box||!homeBox||!awayBox)return;

  const homePlayers=JSON.parse(box.dataset.casa||"[]");
  const awayPlayers=JSON.parse(box.dataset.fora||"[]");
  const homeScore=Math.max(0,Number($("placarCasa").value)||0);
  const awayScore=Math.max(0,Number($("placarFora").value)||0);

  let homeValues=selectedGoalValues("casa");
  let awayValues=selectedGoalValues("fora");

  if(!homeValues.length)homeValues=savedGoalValues("casa");
  if(!awayValues.length)awayValues=savedGoalValues("fora");

  homeBox.innerHTML="";
  awayBox.innerHTML="";

  for(let index=0;index<homeScore;index++){
    homeBox.appendChild(goalSelect(homePlayers,"casa",homeValues[index]||""));
  }

  for(let index=0;index<awayScore;index++){
    awayBox.appendChild(goalSelect(awayPlayers,"fora",awayValues[index]||""));
  }

  updateClassificationPreview();
}
function validateSets(c){if(!state.setDraft.length)return{ok:false,msg:"Adicione pelo menos um set."};const winsCasa=state.setDraft.filter(s=>s.casa>s.fora).length,winsFora=state.setDraft.filter(s=>s.fora>s.casa).length;if(state.setDraft.some(s=>s.casa===s.fora))return{ok:false,msg:"Um set não pode terminar empatado."};if(c.formatoSets==="unico"&&state.setDraft.length!==1)return{ok:false,msg:"Essa partida deve ter apenas 1 set."};const need=c.formatoSets==="melhor3"?2:c.formatoSets==="melhor5"?3:1;if(winsCasa!==need&&winsFora!==need)return{ok:false,msg:`O vencedor precisa ganhar ${need} set(s).`};return{ok:true,winsCasa,winsFora};}
async function saveGame(clear=false){const c=JSON.parse(JSON.stringify(state.current)),loc=locateGame(c,state.currentGame.id);if(!loc)return toast("Jogo não encontrado.");const g=c[loc.list][loc.i];if(clear){Object.assign(g,{encerrado:false,placarCasa:null,placarFora:null,situacao:"normal",gols:[],sets:[],pontuacoesBasquete:[],vencedorPenaltisId:null,vencedorPenaltisNome:"",penaltisCasa:null,penaltisFora:null});}else{g.data=$("dataJogo").value;g.hora=$("horaJogo").value;g.local=$("localJogo").value.trim();g.situacao=$("situacaoJogo").value;if(g.situacao==="adiado"||g.situacao==="cancelado"){g.encerrado=g.situacao==="cancelado";g.placarCasa=null;g.placarFora=null;}else if(c.tipoPlacar==="sets"){if(g.situacao==="normal"){const v=validateSets(c);if(!v.ok)return toast(v.msg);g.sets=state.setDraft;g.placarCasa=v.winsCasa;g.placarFora=v.winsFora;}else{g.sets=[];g.placarCasa=g.situacao==="woCasa"?3:0;g.placarFora=g.situacao==="woFora"?3:0;}g.encerrado=true;
      if(g.live)delete g.live;
      if(g.rascunhoResultado)delete g.rascunhoResultado;}else{let pc=Math.max(0,+$("placarCasa").value||0),pf=Math.max(0,+$("placarFora").value||0);if(g.situacao==="woCasa"){pc=3;pf=0}if(g.situacao==="woFora"){pc=0;pf=3}if(g.situacao==="woDuplo"){pc=0;pf=0}if((loc.list==="eliminatorias"||loc.list==="qualificatorias")&&g.situacao==="normal"&&pc===pf){
  const winnerId=$("vencedorPenaltis").value;
  const penCasa=Math.max(0,Number($("penaltisCasa").value||0));
  const penFora=Math.max(0,Number($("penaltisFora").value||0));

  if(!winnerId)return toast("Selecione quem venceu nos pênaltis.");
  if(penCasa===penFora)return toast("O placar dos pênaltis precisa ter um vencedor.");

  if(
    (winnerId===g.casaId&&penCasa<penFora)||
    (winnerId===g.foraId&&penFora<penCasa)
  ){
    return toast("O vencedor escolhido não corresponde ao placar dos pênaltis.");
  }

  g.vencedorPenaltisId=winnerId;
  g.vencedorPenaltisNome=winnerId===g.casaId?g.casa:g.fora;
  g.penaltisCasa=penCasa;
  g.penaltisFora=penFora;
}else{
  g.vencedorPenaltisId=null;
  g.vencedorPenaltisNome="";
  g.penaltisCasa=null;
  g.penaltisFora=null;
}g.placarCasa=pc;g.placarFora=pf;g.pontuacoesBasquete=isBasketballCompetition()?JSON.parse(JSON.stringify(state.basketHistory||[])):[];g.encerrado=true;g.gols=[];if(c.esporte==="Futsal"&&g.situacao==="normal")document.querySelectorAll("#golsFutsal select").forEach(s=>{if(s.value)g.gols.push({jogadorId:s.value,lado:s.dataset.side});});}}
if(g.live)delete g.live;
if(g.rascunhoResultado)delete g.rascunhoResultado;
recalcScorers(c);

if(c.formato==="grupos"){
  seedKnockoutWithTeamNames(c);
}

if(loc.list==="qualificatorias"){
  if(clear){
    restaurarVagaQualificatoria(c,g);
  }else{
    aplicarVencedorQualificatoria(c,g);
  }
}

if(loc.list==="eliminatorias"){
  const winner=gameWinner(g);
  if(winner){
    propagateWinner(c.eliminatorias,g,winner);
    propagateLoser(c.eliminatorias,g,gameLoser(g));
  }
}

load(true);try{await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",c.id),{qualificatorias:c.qualificatorias||[],grupos:c.grupos||[],jogos:c.jogos||[],eliminatorias:c.eliminatorias||[],participantes:c.participantes,atualizadoEm:serverTimestamp()});state.current=c;toast(clear?"Resultado apagado.":"Jogo salvo.");openCompetition(c,true);}catch(e){console.error(e);toast("Erro ao salvar.");}finally{load(false);}}
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

async function updateSchoolPassword(){
  const pass=$("novaSenhaEscola").value,confirmPass=$("confirmarNovaSenha").value;
  if(!pass||pass.length<6)return toast("A nova senha precisa ter pelo menos 6 caracteres.");
  if(pass!==confirmPass)return toast("As senhas não são iguais.");
  const senhaHash=await hashPassword(pass);
  await updateDoc(doc(db,"escolas",state.school.id),{senhaHash,atualizadoEm:serverTimestamp()});
  state.school.senhaHash=senhaHash;
  rememberAdminSession(state.school);
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

function goBack(){const m={telaCadastro:"telaBusca",telaEscola:"telaBusca",telaLogin:"telaEscola",telaProfessor:"telaEscola",telaTurno:"telaProfessor",telaEsporte:"telaTurno",telaModalidade:"telaEsporte",telaParticipantes:"telaModalidade",telaJogadores:"telaParticipantes",telaRegras:"telaParticipantes",telaFormato:"telaRegras",telaSelecaoQualificatorias:"telaFormato",telaRevisao:state.wizard.incluirQualificatorias?"telaSelecaoQualificatorias":"telaFormato",telaListaAluno:"telaEscola",telaCompeticaoAluno:state.admin?"telaProfessor":"telaListaAluno",telaResultado:"telaCompeticaoAluno",telaEditarCompeticao:"telaCompeticaoAluno",telaAgenda:"telaCompeticaoAluno",telaConfiguracoes:"telaProfessor"};show(m[state.screen]||"telaBusca");}

$("btnBuscar").onclick=()=>searchSchools(false);$("campoBusca").oninput=filterSchoolsInRealTime;$("campoBusca").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();searchSchools(false);}};$("btnAbrirCadastro").onclick=()=>show("telaCadastro");$("btnCancelarCadastro").onclick=()=>show("telaBusca");$("btnCriarEscola").onclick=createSchool;$("btnAbrirQREscola").onclick=openSchoolQRModal;$("btnFecharQREscola").onclick=closeSchoolQRModal;$("modalQREscola").onclick=e=>{if(e.target.id==="modalQREscola")closeSchoolQRModal();};$("btnProfessor").onclick=openTeacherArea;$("btnCancelarLogin").onclick=()=>show("telaEscola");$("btnEntrarProfessor").onclick=teacherLogin;$("btnNovoCampeonato").onclick=startWizard;$("btnSairPainel").onclick=()=>{state.admin=hasValidAdminSession(state.school);show("telaEscola");};$("btnTrocarEscola").onclick=()=>{clearAdminSession();localStorage.removeItem("ultimaEscola");state.school=null;state.admin=false;show("telaBusca");};$("btnVoltar").onclick=goBack;$("btnConfirmarEsporteCustom").onclick=customSport;$("btnAdicionarParticipante").onclick=addParticipant;$("nomeParticipante").onkeydown=e=>{if(e.key==="Enter")addParticipant();};$("btnAvancarRegras").onclick=()=>savePlayerRosters(true,false);$("btnAdicionarJogador").onclick=addPlayer;$("nomeJogador").onkeydown=e=>{if(e.key==="Enter")addPlayer();};$("btnConcluirJogadores").onclick=()=>{renderParticipants();show("telaParticipantes");};$("tipoPlacar").onchange=syncSetOptions;$("formatoSets").onchange=syncSetOptions;$("pontosSetNormal").onchange=syncSetOptions;$("pontosTieBreak").onchange=syncSetOptions;$("btnAvancarFormato").onclick=openFormat;document.querySelectorAll(".format-card").forEach(b=>b.onclick=()=>chooseFormat(b.dataset.formato,b));$("quantidadeGrupos").onchange=updateGroupRules;
$("btnAvancarSelecaoQualificatorias").onclick=avancarSelecaoQualificatorias;$("btnVoltarSelecaoQualificatorias").onclick=()=>show("telaFormato");$("regraClassificacao").onchange=updateClassificationRuleDetails;$("btnConfirmarFormato").onclick=confirmGroups;$("btnConfirmarEliminatoria").onclick=confirmEliminationFormat;$("btnSalvarCampeonato").onclick=saveChamp;$("btnRefazerSorteio").onclick=()=>{generateStructure();renderPreview();toast("Sorteio refeito.");};document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");renderTab(t.dataset.tab,state.admin);});$("placarCasa").oninput=()=>{updateGoalInputs();updatePenaltyBox();updateClassificationPreview();};$("placarFora").oninput=()=>{updateGoalInputs();updatePenaltyBox();updateClassificationPreview();};$("maisCasa").onclick=()=>{$("placarCasa").value=+$("placarCasa").value+1;updateGoalInputs();updatePenaltyBox();updateClassificationPreview();};$("menosCasa").onclick=()=>{$("placarCasa").value=Math.max(0,+$("placarCasa").value-1);updateGoalInputs();updatePenaltyBox();updateClassificationPreview();};$("maisFora").onclick=()=>{$("placarFora").value=+$("placarFora").value+1;updateGoalInputs();updatePenaltyBox();updateClassificationPreview();};$("basketCasa2").onclick=()=>addBasketPoints("casa",2);$("basketCasa3").onclick=()=>addBasketPoints("casa",3);$("basketFora2").onclick=()=>addBasketPoints("fora",2);$("basketFora3").onclick=()=>addBasketPoints("fora",3);$("menosFora").onclick=()=>{$("placarFora").value=Math.max(0,+$("placarFora").value-1);updateGoalInputs();updatePenaltyBox();updateClassificationPreview();};$("btnAdicionarSet").onclick=()=>{state.setDraft.push({casa:0,fora:0});renderSets();updateClassificationPreview();scheduleLiveGameSync();};$("btnMostrarDetalhesJogo").onclick=toggleGameDetails;$("btnInverterLados").onclick=swapCurrentGameSides;$("situacaoJogo").onchange=()=>{updatePenaltyBox();updateClassificationPreview();scheduleLiveGameSync();};$("btnSalvarResultado").onclick=()=>saveGame(false);$("btnLimparResultado").onclick=()=>{if(confirm("Apagar o resultado?"))saveGame(true);};$("btnFinalizar").onclick=finishChampionship;
$("btnReabrir").onclick=reopenChampionship;
["dataJogo","horaJogo","localJogo","vencedorPenaltis","penaltisCasa","penaltisFora"].forEach(id=>{
  const field=$(id);
  if(!field)return;
  field.addEventListener("input",scheduleLiveGameSync);
  field.addEventListener("change",scheduleLiveGameSync);
});

$("btnCopiarLink").onclick=async()=>{try{await navigator.clipboard.writeText(schoolUrl());toast("Link copiado.");}catch{prompt("Copie o link:",schoolUrl());}};$("btnBaixarQR").onclick=downloadSchoolQRPoster;


$("btnEditarCompeticao").onclick=openEditCompetition;
$("btnSalvarDadosBasicos").onclick=()=>saveBasicCompetitionData(true,false);
["editarTurno","editarEsporte","editarModalidade"].forEach(id=>{
  const field=$(id);
  if(!field)return;
  field.addEventListener("input",scheduleBasicDataAutosave);
  field.addEventListener("change",scheduleBasicDataAutosave);
});
let rosterSaveInProgress=false;
let rosterSavePending=false;
async function savePlayerRosters(closeAfter=true,silent=false){
  if(!state.editPlayersOnly)return openRules();
  if(rosterSaveInProgress){rosterSavePending=true;return;}
  rosterSaveInProgress=true;
  if(!silent)load(true);
  try{
    const participantes=JSON.parse(JSON.stringify(state.wizard.participantes||[]));
    const participantesPorId=new Map(participantes.map(time=>[time.id,time]));
    const grupos=(state.current.grupos||[]).map(grupo=>({
      ...grupo,
      participantes:(grupo.participantes||[]).map(time=>participantesPorId.get(time.id)||time)
    }));
    await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",state.current.id),{participantes,grupos,atualizadoEm:serverTimestamp()});
    state.current={...state.current,participantes,grupos};
    if(closeAfter){
      state.editPlayersOnly=false;
      state.wizard=newWizard();
      $("nomeParticipante").closest(".card").classList.remove("hidden");
      $("btnAvancarRegras").textContent="Avançar";
      openCompetition(state.current,true);
    }
    if(!silent)toast("Jogadores atualizados.");
  }catch(error){console.error(error);if(!silent)toast("Não foi possível salvar os jogadores.");}
  finally{
    if(!silent)load(false);
    rosterSaveInProgress=false;
    if(rosterSavePending){rosterSavePending=false;savePlayerRosters(false,true);}
  }
}

$("btnEditarParticipantes").onclick=()=>startStructuralEdit("participantes");
$("btnEditarRegras").onclick=()=>startStructuralEdit("regras");
$("btnEditarFormato").onclick=()=>startStructuralEdit("formato");
$("btnRegenerarCompeticao").onclick=openReorganizer;

$("btnFecharReorganizar").onclick=closeReorganizer;
$("modalReorganizar").onclick=event=>{if(event.target.id==="modalReorganizar")closeReorganizer();};
$("btnSalvarReorganizacao").onclick=saveReorganization;
$("btnRefazerSorteioCompleto").onclick=()=>{closeReorganizer();regenerateCompetition();};
document.querySelectorAll(".reorganizer-tab").forEach(button=>{
  button.onclick=()=>{
    state.reorderTab=button.dataset.reorderTab;
    document.querySelectorAll(".reorganizer-tab").forEach(item=>item.classList.toggle("active",item===button));
    renderReorganizer();
  };
});

$("btnGerarAgenda").onclick=generateAgenda;


$("btnInstalarApp").onclick=installApp;
if($("buscaCompeticaoAluno"))$("buscaCompeticaoAluno").oninput=filterStudentCompetitions;
if($("btnFavoritar"))$("btnFavoritar").onclick=toggleCurrentFavorite;

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

localStorage.removeItem("tema-interclasses");document.body.classList.remove("dark");
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error);
const startupUrl=new URL(location.href);startupUrl.searchParams.delete("campeonato");const id=startupUrl.searchParams.get("escola");if(id)openSchoolById(id);else{show("telaBusca");searchSchools(true);}

function ensureAllCompetitionPeriodsVisible(){
  const box=$("turnosCompeticao")||$("filtroTurnos")||$("listaTurnos")||document.querySelector(".turnos-lista,.turnos-grid");
  if(!box)return;

  const competitions=(state.competicoes||state.escolaAtual?.competicoes||state.school?.competicoes||[]);
  const existing=[...box.querySelectorAll("button")].map(button=>normalizePeriodoLabel(button.textContent));

  PERIODOS_DISPONIVEIS.forEach(periodo=>{
    if(existing.includes(periodo))return;
    const button=document.createElement("button");
    button.type="button";
    button.className="period-option";
    button.textContent=periodo;
    button.dataset.periodo=periodo;
    box.appendChild(button);
  });

  box.querySelectorAll("[data-periodo],button").forEach(button=>{
    const periodo=normalizePeriodoLabel(button.dataset.periodo||button.textContent);
    button.dataset.periodo=periodo;
    button.onclick=()=>{
      const hasCompetition=competitions.some(c=>normalizePeriodoLabel(c.turno||c.periodo)===periodo);
      let note=box.querySelector(".period-empty-note");
      if(!note){
        note=document.createElement("div");
        note.className="period-empty-note";
        box.appendChild(note);
      }
      note.textContent=hasCompetition?"":"Sem competições registradas nesse período.";
      note.classList.toggle("hidden",hasCompetition);
    };
  });
}

document.addEventListener("DOMContentLoaded",()=>setTimeout(ensureAllCompetitionPeriodsVisible,0));


function ensurePublicPeriodCards(){
  const schoolScreen=
    $("telaEscola")||
    $("schoolScreen")||
    document.querySelector('[data-screen="escola"],.school-screen');

  const scope=schoolScreen||document;
  const buttons=[...scope.querySelectorAll("button")];

  const periodButtons=buttons.filter(button=>{
    const text=String(button.textContent||"").toLowerCase();
    return text.includes("matutino")||
      text.includes("vespertino")||
      text.includes("noturno")||
      text.includes("manhã")||
      text.includes("manha")||
      text.includes("tarde")||
      text.includes("noite");
  });

  if(!periodButtons.length)return;

  const first=periodButtons[0];
  const container=first.parentElement?.parentElement;
  if(!container)return;

  // Mantém apenas os cards/botões de período no bloco e recria os quatro.
  const oldCards=[...container.children].filter(child=>{
    const text=String(child.textContent||"").toLowerCase();
    return text.includes("matutino")||
      text.includes("vespertino")||
      text.includes("noturno")||
      text.includes("manhã")||
      text.includes("manha")||
      text.includes("tarde")||
      text.includes("noite");
  });

  if(!oldCards.length)return;

  const template=oldCards[0];
  oldCards.forEach(card=>card.remove());

  PERIODOS_PUBLICOS.forEach(item=>{
    const card=template.cloneNode(true);
    const button=card.matches("button")?card:card.querySelector("button");
    if(!button)return;

    // Preserva a estrutura visual atual.
    const iconNode=button.querySelector(".icon,.turno-icon,.period-icon")||button.firstElementChild;
    if(iconNode&&iconNode.children.length===0)iconNode.textContent=item.icon;

    const textNodes=[...button.querySelectorAll("*")];
    const main=textNodes.find(node=>{
      const text=String(node.textContent||"").trim();
      return /Matutino|Vespertino|Noturno|Manhã|Tarde|Noite/i.test(text);
    });
    if(main)main.textContent=item.label;
    else button.textContent=`${item.icon} ${item.label}`;

    button.dataset.turno=item.key;
    button.dataset.periodo=item.key;

    button.onclick=()=>{
      const competitions=(
        state.competicoes||
        state.escolaAtual?.competicoes||
        state.school?.competicoes||
        state.currentSchool?.competicoes||
        []
      );

      const matching=competitions.filter(c=>periodoPublicoKey(c.turno||c.periodo)===item.key);

      // Tenta usar a navegação existente.
      state.turnoSelecionado=item.key;
      state.periodoSelecionado=item.key;

      if(typeof abrirTurno==="function")abrirTurno(item.key);
      else if(typeof openTurn==="function")openTurn(item.key);
      else if(typeof renderCompeticoes==="function")renderCompeticoes();
      else if(typeof renderCompetitions==="function")renderCompetitions();

      setTimeout(()=>{
        let note=scope.querySelector(".public-period-empty-note");
        if(!note){
          note=document.createElement("div");
          note.className="public-period-empty-note";
          container.insertAdjacentElement("afterend",note);
        }
        note.textContent=matching.length?"":"Sem competições registradas nesse período.";
        note.classList.toggle("hidden",matching.length>0);
      },0);
    };

    container.appendChild(card);
  });
}

const publicPeriodObserver=new MutationObserver(()=>{
  clearTimeout(window.__publicPeriodTimer);
  window.__publicPeriodTimer=setTimeout(ensurePublicPeriodCards,50);
});

document.addEventListener("DOMContentLoaded",()=>{
  ensurePublicPeriodCards();
  publicPeriodObserver.observe(document.body,{childList:true,subtree:true});
});
