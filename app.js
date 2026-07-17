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
  const termo=norm($("campoBusca").value);
  const palavras=termo.split(/\s+/).filter(Boolean);

  if(palavras.join("").length<2){
    return toast("Digite pelo menos 2 letras.");
  }

  load(true);
  $("resultadosBusca").innerHTML="";

  try{
    const snap=await getDocs(
      query(collection(db,"escolas"),orderBy("nomeBusca"),limit(300))
    );
    const now=Date.now();

    const arr=snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(s=>s.ativo!==false&&(!s.expiraEm?.toDate||s.expiraEm.toDate().getTime()>now))
      .filter(s=>{
        const nome=norm(s.nome||s.nomeBusca||"");
        return palavras.every(palavra=>nome.includes(palavra));
      })
      .slice(0,30);

    if(!arr.length){
      $("resultadosBusca").innerHTML='<div class="card muted">Nenhuma escola encontrada. Tente uma palavra ou parte do nome.</div>';
      return;
    }

    arr.forEach(s=>{
      const b=document.createElement("button");
      b.className="school-item";
      b.innerHTML=`<span>🏫</span><div><strong>${esc(s.nome)}</strong><small>Toque para abrir</small></div>`;
      b.onclick=()=>openSchool(s);
      $("resultadosBusca").appendChild(b);
    });
  }catch(e){
    console.error(e);
    toast("Erro ao pesquisar.");
  }finally{
    load(false);
  }
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
  ctx.fillText("Próximos jogos • Resultados • Classificação • Eliminatórias",canvas.width/2,qrY+qrSize+315);

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
      button.innerHTML=`<span>${icon}</span><strong>${turn}</strong><small>Abrir</small>`;
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
    lideresFinal:1,
    top2grupo:4,
    lideres3Semi:4,
    top2Mais2Terceiros:8,
    lideres4Semi:4,
    top2Quarta:8
  };
  return counts[rule]??0;
}

function totalGamesForRule(total,groups,rule){
  return groupStageGameCount(total,groups)+knockoutGameCountForRule(rule);
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
  }else if(grupos===3){
    help.textContent="Os times são distribuídos da forma mais equilibrada possível entre os 3 grupos.";
    options=[
      {
        value:"lideres3Semi",
        label:"Os 1º colocados + o melhor 2º avançam",
        detail:"Os líderes dos Grupos A, B e C, junto com o melhor 2º colocado geral, avançam para as semifinais. Depois há disputa de 3º lugar e final."
      },
      {
        value:"top2Mais2Terceiros",
        label:"Os 2 melhores de cada grupo + os 2 melhores 3ºs avançam",
        detail:"Os dois primeiros de cada grupo e os dois melhores terceiros colocados avançam para as quartas de final. Depois há semifinal, disputa de 3º lugar e final."
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
    const games=totalGamesForRule(total,grupos,option.value);
    const o=document.createElement("option");
    o.value=option.value;
    o.textContent=option.label;
    o.dataset.detail=option.detail;
    o.dataset.games=String(games);
    sel.appendChild(o);
  });

  [...sel.options].forEach(o=>{
    if(o.value==="final2"&&total<3)o.disabled=true;
    if(o.value==="semi4"&&total<4)o.disabled=true;
    if(o.value==="lideresFinal"&&total<4)o.disabled=true;
    if(o.value==="top2grupo"&&total<4)o.disabled=true;
    if(o.value==="lideres3Semi"&&total<6)o.disabled=true;
    if(o.value==="top2Mais2Terceiros"&&total<9)o.disabled=true;
    if(o.value==="lideres4Semi"&&total<4)o.disabled=true;
    if(o.value==="top2Quarta"&&total<8)o.disabled=true;
  });

  const firstEnabled=[...sel.options].find(o=>!o.disabled);
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

function generateStructure(){
  const parts=shuffle(state.wizard.participantes);

  state.wizard.grupos=[];
  state.wizard.jogos=[];
  state.wizard.eliminatorias=[];

  if(state.wizard.formato==="grupos"){
    const quantity=Math.max(1,state.wizard.quantidadeGrupos);

    for(let i=0;i<quantity;i++){
      state.wizard.grupos.push({
        nome:String.fromCharCode(65+i),
        participantes:[]
      });
    }

    parts.forEach((participant,index)=>{
      state.wizard.grupos[index%quantity].participantes.push(participant);
    });

    state.wizard.jogos=createInterleavedGroupGames(state.wizard.grupos);

    if(state.wizard.regraClassificacao!=="campeaoGrupo"){
      let count=0;

      if(["final2","lideresFinal"].includes(state.wizard.regraClassificacao)){
        count=2;
      }else if(["semi4","top2grupo","lideres3Semi","lideres4Semi"].includes(state.wizard.regraClassificacao)){
        count=4;
      }else if(["top2Quarta","top2Mais2Terceiros"].includes(state.wizard.regraClassificacao)){
        count=8;
      }else{
        count=Math.max(2,state.wizard.grupos.length*2);
      }

      state.wizard.eliminatorias=makeBracket(
        createQualificationSeeds(state.wizard,count)
      );
    }
  }else{
    state.wizard.eliminatorias=makeBracket(parts);
  }

  assignGameNumbers(state.wizard);
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
    b.innerHTML=`<span>${sportIcon(c.esporte)}</span><strong>${esc(c.esporte)}</strong><small>${esc(c.modalidade)} · ${esc(c.turno)}</small>`;
    b.onclick=()=>openCompetitionSafe(c,false);
    box.appendChild(b);
  });
}

function openStudentList(turn,camps){$("alunoTurnoLabel").textContent=turn;const box=$("listaCampeonatosAluno");box.innerHTML="";camps.forEach(c=>{const b=document.createElement("button");b.className="school-item";b.innerHTML=`<span>${sportIcon(c.esporte)}</span><div><strong>${esc(c.esporte)} — ${esc(c.modalidade)}</strong><small>${c.participantes?.length||0} participantes · ${c.status==="encerrado"?"Encerrado":"Em andamento"}</small></div>`;b.onclick=()=>openCompetitionSafe(c,false);box.appendChild(b);});show("telaListaAluno");}

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
  const hasKnockout=(c.eliminatorias||[]).length>0;
  const finished=c.status==="encerrado"&&!!c.podio;

  const visibility={
    proximos:upcoming.length>0,
    resultados:true,
    classificacao:hasGroups,
    eliminatorias:hasKnockout,
    artilheiros:hasScorerData(c),
    podio:finished,
    resumoFinal:finished
  };

  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("hidden",!visibility[tab.dataset.tab]);
  });

  const preferred=["proximos","resultados","classificacao","eliminatorias","artilheiros","podio","resumoFinal"];
  return preferred.find(name=>visibility[name])||"resultados";
}


function normalizeCompetition(c){
  return{
    ...c,
    participantes:Array.isArray(c.participantes)?c.participantes:[],
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
  if(loc.list==="jogos")return!g.encerrado;

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
  const all=[...(c.jogos||[]),...(c.eliminatorias||[])];
  return Math.max(1,all.findIndex(x=>x.id===g.id)+1);
}

function allGames(c){return[...(c.jogos||[]),...(c.eliminatorias||[])];}
function formatSchedule(j){const p=[];if(j.data)p.push(new Date(j.data+"T12:00:00").toLocaleDateString("pt-BR"));if(j.hora)p.push(j.hora);if(j.local)p.push(j.local);return p.join(" · ");}
function renderTab(tab,admin=false){const c=state.current,box=$("conteudoAluno");box.innerHTML="";updateClassificationNote(tab,c);if(tab==="proximos"||tab==="resultados"){
    const list=tab==="proximos"
      ?availableUpcomingGames(c)
      :allGames(c)
        .filter(game=>game.encerrado&&game.situacao!=="classificacaoDireta")
        .sort((a,b)=>stableGameNumber(c,a)-stableGameNumber(c,b));

    if(!list.length){
      box.innerHTML=`<div class="card muted">${tab==="proximos"?"Nenhum próximo jogo.":"Nenhum resultado registrado."}</div>`;
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
        ?`<div class="simple-score">${game.placarCasa??0} × ${game.placarFora??0}</div>`
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

        <div class="horizontal-match">
          <div class="horizontal-team">${esc(game.casa||"A definir")}</div>
          ${score}
          <div class="horizontal-team">${esc(game.fora||"A definir")}</div>
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
  if(tab==="classificacao"){
    const t=$("tabClassificacao");
    const hasLive=(c.jogos||[]).some(game=>game.live?.ativo&&!game.encerrado);
    if(t)t.innerHTML=hasLive
      ?'Classificação <span class="tab-live-dot"></span>'
      :'Classificação';
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
function locateGame(c,id){let i=(c.jogos||[]).findIndex(j=>j.id===id);if(i>=0)return{list:"jogos",i};i=(c.eliminatorias||[]).findIndex(j=>j.id===id);return i>=0?{list:"eliminatorias",i}:null;}

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
  return !!locateGame(c,g.id) && locateGame(c,g.id).list==="eliminatorias";
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

      await updateDoc(
        doc(db,"escolas",state.school.id,"campeonatos",competition.id),
        {
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

  const hasDetails=!!(g.data||g.hora||g.local);
  $("detalhesJogoBox").classList.toggle("hidden",!hasDetails);
  updateGameDetailsToggle();

  $("situacaoJogo").value=g.situacao||"normal";
  $("placarSimplesBox").classList.toggle("hidden",state.current.tipoPlacar==="sets");
  $("placarSetsBox").classList.toggle("hidden",state.current.tipoPlacar!=="sets");
  $("golsFutsalBox").classList.toggle("hidden",!["Futsal","Handebol"].includes(state.current.esporte));
  $("placarCasa").value=g.placarCasa??0;
  $("placarFora").value=g.placarFora??0;
  loadPenaltyFields(g);

  state.setDraft=JSON.parse(JSON.stringify(g.sets||[]));
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
  toast("Lados invertidos.");scheduleLiveScoreSync();
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
  if(!located)return null;

  const game=clone[located.list][located.i];
  game.placarCasa=Math.max(0,Number($("placarCasa")?.value)||0);
  game.placarFora=Math.max(0,Number($("placarFora")?.value)||0);
  game.encerrado=true;
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
      state.setDraft[index].casa=Math.max(0,Number(event.target.value)||0);scheduleLiveGameSync();
    };
    card.querySelector("[data-away]").oninput=event=>{
      state.setDraft[index].fora=Math.max(0,Number(event.target.value)||0);scheduleLiveGameSync();
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
  return select;
}

function selectedGoalValues(side){
  return [...document.querySelectorAll(`#golsFutsal select[data-side="${side}"]`)]
    .map(select=>select.value);
}

function savedGoalValues(side){
  return (state.currentGame?.gols||[])
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
async function saveGame(clear=false){const c=JSON.parse(JSON.stringify(state.current)),loc=locateGame(c,state.currentGame.id);if(!loc)return toast("Jogo não encontrado.");const g=c[loc.list][loc.i];if(clear){Object.assign(g,{encerrado:false,placarCasa:null,placarFora:null,situacao:"normal",gols:[],sets:[],vencedorPenaltisId:null,vencedorPenaltisNome:"",penaltisCasa:null,penaltisFora:null});}else{g.data=$("dataJogo").value;g.hora=$("horaJogo").value;g.local=$("localJogo").value.trim();g.situacao=$("situacaoJogo").value;if(g.situacao==="adiado"||g.situacao==="cancelado"){g.encerrado=g.situacao==="cancelado";g.placarCasa=null;g.placarFora=null;}else if(c.tipoPlacar==="sets"){if(g.situacao==="normal"){const v=validateSets(c);if(!v.ok)return toast(v.msg);g.sets=state.setDraft;g.placarCasa=v.winsCasa;g.placarFora=v.winsFora;}else{g.sets=[];g.placarCasa=g.situacao==="woCasa"?3:0;g.placarFora=g.situacao==="woFora"?3:0;}g.encerrado=true;
      if(g.live)delete g.live;}else{let pc=Math.max(0,+$("placarCasa").value||0),pf=Math.max(0,+$("placarFora").value||0);if(g.situacao==="woCasa"){pc=3;pf=0}if(g.situacao==="woFora"){pc=0;pf=3}if(g.situacao==="woDuplo"){pc=0;pf=0}if(loc.list==="eliminatorias"&&g.situacao==="normal"&&pc===pf){
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
}g.placarCasa=pc;g.placarFora=pf;g.encerrado=true;g.gols=[];if(c.esporte==="Futsal"&&g.situacao==="normal")document.querySelectorAll("#golsFutsal select").forEach(s=>{if(s.value)g.gols.push({jogadorId:s.value,lado:s.dataset.side});});}}
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
}

load(true);try{await updateDoc(doc(db,"escolas",state.school.id,"campeonatos",c.id),{jogos:c.jogos||[],eliminatorias:c.eliminatorias||[],participantes:c.participantes,atualizadoEm:serverTimestamp()});state.current=c;toast(clear?"Resultado apagado.":"Jogo salvo.");openCompetition(c,true);}catch(e){console.error(e);toast("Erro ao salvar.");}finally{load(false);}}
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

function goBack(){const m={telaCadastro:"telaBusca",telaEscola:"telaBusca",telaLogin:"telaEscola",telaProfessor:"telaEscola",telaTurno:"telaProfessor",telaEsporte:"telaTurno",telaModalidade:"telaEsporte",telaParticipantes:"telaModalidade",telaJogadores:"telaParticipantes",telaRegras:"telaParticipantes",telaFormato:"telaRegras",telaRevisao:"telaFormato",telaListaAluno:"telaEscola",telaCompeticaoAluno:state.admin?"telaProfessor":"telaListaAluno",telaResultado:"telaCompeticaoAluno",telaEditarCompeticao:"telaCompeticaoAluno",telaAgenda:"telaCompeticaoAluno",telaConfiguracoes:"telaProfessor"};show(m[state.screen]||"telaBusca");}

$("btnBuscar").onclick=searchSchools;$("campoBusca").onkeydown=e=>{if(e.key==="Enter")searchSchools();};$("btnAbrirCadastro").onclick=()=>show("telaCadastro");$("btnCancelarCadastro").onclick=()=>show("telaBusca");$("btnCriarEscola").onclick=createSchool;$("btnAbrirQREscola").onclick=openSchoolQRModal;$("btnFecharQREscola").onclick=closeSchoolQRModal;$("modalQREscola").onclick=e=>{if(e.target.id==="modalQREscola")closeSchoolQRModal();};$("btnProfessor").onclick=openTeacherArea;$("btnCancelarLogin").onclick=()=>show("telaEscola");$("btnEntrarProfessor").onclick=teacherLogin;$("btnNovoCampeonato").onclick=startWizard;$("btnSairPainel").onclick=()=>{state.admin=hasValidAdminSession(state.school);show("telaEscola");};$("btnTrocarEscola").onclick=()=>{clearAdminSession();localStorage.removeItem("ultimaEscola");state.school=null;state.admin=false;show("telaBusca");};$("btnVoltar").onclick=goBack;$("btnConfirmarEsporteCustom").onclick=customSport;$("btnAdicionarParticipante").onclick=addParticipant;$("nomeParticipante").onkeydown=e=>{if(e.key==="Enter")addParticipant();};$("btnAvancarRegras").onclick=openRules;$("btnAdicionarJogador").onclick=addPlayer;$("nomeJogador").onkeydown=e=>{if(e.key==="Enter")addPlayer();};$("btnConcluirJogadores").onclick=()=>show("telaParticipantes");$("tipoPlacar").onchange=syncSetOptions;$("formatoSets").onchange=syncSetOptions;$("pontosSetNormal").onchange=syncSetOptions;$("pontosTieBreak").onchange=syncSetOptions;$("btnAvancarFormato").onclick=openFormat;document.querySelectorAll(".format-card").forEach(b=>b.onclick=()=>chooseFormat(b.dataset.formato,b));$("quantidadeGrupos").onchange=updateGroupRules;
$("regraClassificacao").onchange=updateClassificationRuleDetails;$("btnConfirmarFormato").onclick=confirmGroups;$("btnConfirmarEliminatoria").onclick=confirmEliminationFormat;$("btnSalvarCampeonato").onclick=saveChamp;$("btnRefazerSorteio").onclick=()=>{generateStructure();renderPreview();toast("Sorteio refeito.");};document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");renderTab(t.dataset.tab,state.admin);});$("placarCasa").oninput=()=>{updateGoalInputs();updatePenaltyBox();};$("placarFora").oninput=()=>{updateGoalInputs();updatePenaltyBox();};$("maisCasa").onclick=()=>{$("placarCasa").value=+$("placarCasa").value+1;updateGoalInputs();updatePenaltyBox();};$("menosCasa").onclick=()=>{$("placarCasa").value=Math.max(0,+$("placarCasa").value-1);updateGoalInputs();updatePenaltyBox();};$("maisFora").onclick=()=>{$("placarFora").value=+$("placarFora").value+1;updateGoalInputs();updatePenaltyBox();};$("menosFora").onclick=()=>{$("placarFora").value=Math.max(0,+$("placarFora").value-1);updateGoalInputs();updatePenaltyBox();};$("btnAdicionarSet").onclick=()=>{state.setDraft.push({casa:0,fora:0});renderSets();scheduleLiveGameSync();};$("btnMostrarDetalhesJogo").onclick=toggleGameDetails;$("btnInverterLados").onclick=swapCurrentGameSides;$("situacaoJogo").onchange=()=>{updatePenaltyBox();updateClassificationPreview();};$("btnSalvarResultado").onclick=()=>saveGame(false);$("btnLimparResultado").onclick=()=>{if(confirm("Apagar o resultado?"))saveGame(true);};$("btnFinalizar").onclick=finishChampionship;
$("btnReabrir").onclick=reopenChampionship;
$("btnCopiarLink").onclick=async()=>{try{await navigator.clipboard.writeText(schoolUrl());toast("Link copiado.");}catch{prompt("Copie o link:",schoolUrl());}};$("btnBaixarQR").onclick=downloadSchoolQRPoster;


$("btnEditarCompeticao").onclick=openEditCompetition;
$("btnSalvarDadosBasicos").onclick=saveBasicCompetitionData;
$("btnEditarParticipantes").onclick=()=>startStructuralEdit("participantes");
$("btnEditarRegras").onclick=()=>startStructuralEdit("regras");
$("btnEditarFormato").onclick=()=>startStructuralEdit("formato");
$("btnRegenerarCompeticao").onclick=regenerateCompetition;
$("btnGerarAgenda").onclick=generateAgenda;


$("btnInstalarApp").onclick=installApp;
$("buscaCompeticaoAluno").oninput=filterStudentCompetitions;
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
const startupUrl=new URL(location.href);startupUrl.searchParams.delete("campeonato");const id=startupUrl.searchParams.get("escola");if(id)openSchoolById(id);else{const last=localStorage.getItem("ultimaEscola");if(last)try{openSchool(JSON.parse(last));}catch{localStorage.removeItem("ultimaEscola");}}