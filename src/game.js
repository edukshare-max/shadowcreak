import { validateGameData } from './data-schema.js';
import { validateExpansion } from './expansion-rules.js';
import { Expansion } from './expansion.js';
import { geometry, createActors, createWorldAlgorithms } from './world-core.js';

// Datos versionados junto con el código. Cada recarga toma la configuración publicada.
let gameData, expansionData;
try {
  const response = await fetch(new URL('../data/game-data.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  gameData = validateGameData(await response.json());
  const extra = await fetch(new URL('../data/expansion.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!extra.ok) throw new Error('Expansion HTTP ' + extra.status);
  expansionData = validateExpansion(await extra.json());
} catch (error) {
  const overlay = document.getElementById('overlay');
  const panel = document.createElement('div');
  panel.className = 'menu-content';
  const title = document.createElement('h1');
  title.textContent = 'UMBRA';
  const message = document.createElement('p');
  message.textContent = 'No se pudieron cargar los datos del juego. Revisa la conexión o la configuración publicada y recarga la página.';
  const retry = document.createElement('button');
  retry.className = 'primary';
  retry.textContent = 'VOLVER A CARGAR';
  retry.addEventListener('click', () => location.reload());
  panel.append(title, message, retry);
  overlay.replaceChildren(panel);
  overlay.classList.remove('hidden');
  document.body.dataset.state = 'menu';
  throw error;
}

'use strict';
(() => {
let expansion;
// Standalone canvas game. Artwork, animation and audio are generated locally.
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d',{alpha:false});
const WORLD=geometry.width, GROUND=geometry.ground, SAVE_KEY='umbra.expedition.v3', VERSION=3;
let VW=1440,VH=810,scale=1,screenW=1440,screenH=810,dpr=1;
let state='menu',last=0,time=0,playTime=0,accumulator=0,cam=0,shake=0,hitstop=0,zone=0;
let keys={},jumpBuffer=0,particles=[],projectiles=[],texts=[],ghosts=[],enemies=[],nodes=[],boss,player;
let toastTime=0,bannerTime=0,saveClock=0,hudClock=0,interactClock=0,checkpoint=0,difficulty='veteran',kills=0,deaths=0,runStarted=false,restoreState='menu',nextEnemyId=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sign=v=>v<0?-1:1,rand=(a,b)=>a+Math.random()*(b-a);
const rectHit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const zones=[{name:'El bosque de las cenizas',short:'Bosque de cenizas',tag:'REGIÓN I · TIERRAS EXTERIORES',sub:'La llama aún recuerda tu nombre',weather:'NOCHE PERPETUA · AMENAZA CRECIENTE',sky:['#102a31','#26494a','#203a36'],mist:'#8ba990',ground:'#253e36'}, {name:'Las ruinas del silencio',short:'Ruinas del silencio',tag:'REGIÓN II · EL REINO OLVIDADO',sub:'Bajo las piedras, algo despierta',weather:'NIEBLA FRÍA · PELIGRO ELEVADO',sky:['#152533','#354550','#243a40'],mist:'#92aeb0',ground:'#303f3b'}, {name:'El santuario del Umbral',short:'Santuario del Umbral',tag:'REGIÓN III · LA ÚLTIMA FRONTERA',sub:'Ninguna luz cruza intacta',weather:'CENIZA ROJA · TERRITORIO HOSTIL',sky:['#251f2d','#514447','#3b363b'],mist:'#b3948c',ground:'#413e38'}];
const camps=geometry.camps;
const platforms=geometry.platforms;
const ledges=geometry.ledges;
function groundAt(x){if(expansion?.inCave)return GROUND;for(const t of ledges)if(x>=t.x&&x<=t.x+t.w)return t.y;return GROUND}
const recipes=gameData.recipes;
const actorFactory=createActors(gameData,groundAt);
function makePlayer(){return actorFactory.player()}
function spawnEnemy(type,x,y,id){return actorFactory.enemy(type,x,y,id)}
function makeWorld(){const r=random(85931);nodes=[];enemies=[];nextEnemyId=0;for(let i=0;i<47;i++){let x=350+i*139+r()*45;let type=i%3===0?'ore':i%5===0?'crystal':'wood';nodes.push({id:i,x,y:groundAt(x),type,hp:type==='ore'?3:2,alive:true,hit:0,seed:r()*30})}for(let i=0;i<platforms.length;i++){let pl=platforms[i];nodes.push({id:60+i,x:pl.x+pl.w*.63,y:pl.y,type:i%2?'crystal':'ore',hp:2,alive:true,hit:0,seed:i})}const placements=gameData.enemyPlacements;placements.forEach(([t,x])=>enemies.push(spawnEnemy(t,x,null,nextEnemyId++)));boss={x:7340,y:GROUND-124,w:80,h:124,hp:gameData.bossHealth,maxHp:gameData.bossHealth,active:false,dead:false,phase:1,mode:'sleep',timer:0,anim:0,hit:0,hitBy:-1,face:-1,pattern:0,attackHit:false,phasePulse:0};}
function reset(){resetForestAmbience();player=makePlayer();makeWorld();particles=[];projectiles=[];ghosts=[];texts=[];zone=0;checkpoint=0;playTime=0;kills=0;deaths=0;cam=0;saveClock=0;runStarted=true;shake=0;hitstop=0;jumpBuffer=0;expansion?.reset()}
function say(message){$('toast').textContent=message;$('toast').classList.add('visible');toastTime=3.2}
let storageOK=true;
function readSave(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY));return d?.version===VERSION&&d.player&&Number.isFinite(d.player.x)?d:null}catch{return null}}
function save(){if(expansion?.online){expansion.requestSave();return}if(!runStarted||player.hp<=0||!storageOK)return;try{const view=expansion?.saveView||{player,nodes,enemies,boss},p=view.player;localStorage.setItem(SAVE_KEY,JSON.stringify({version:VERSION,player:{x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,wood:p.wood,ore:p.ore,shard:p.shard,potions:p.potions,arrows:p.arrows,weapon:p.weapon,gear:{...p.gear}},nodes:view.nodes.filter(n=>!n.alive).map(n=>n.id),enemies:view.enemies.filter(e=>e.dead).map(e=>e.id),boss:{hp:view.boss.hp,dead:view.boss.dead},checkpoint,difficulty,kills,deaths,playTime,won:state==='won',expansion:expansion?.serialize()}));$('save-status').textContent='PROGRESO GUARDADO'}catch{storageOK=false;$('save-status').textContent='GUARDADO NO DISPONIBLE';say('El navegador bloqueó el guardado. Puedes continuar en esta sesión.')}}
function load(){const d=readSave();if(!d)return false;reset();Object.assign(player,d.player);player.x=clamp(player.x,30,WORLD-80);player.y=clamp(player.y,150,GROUND-player.h);player.hp=clamp(player.hp,1,player.maxHp);player.y=Math.min(player.y,groundAt(player.x+player.w/2)-player.h);player.ground=Math.abs(player.y+player.h-groundAt(player.x+player.w/2))<1;player.gear={sword:false,spear:false,bow:false,armor:false,...d.player.gear};checkpoint=clamp(d.checkpoint||0,0,2);difficulty=['veteran','relentless'].includes(d.difficulty)?d.difficulty:'veteran';kills=d.kills||0;deaths=d.deaths||0;playTime=d.playTime||0;nodes.forEach(n=>{if(d.nodes?.includes(n.id))n.alive=false});enemies.forEach(e=>{if(d.enemies?.includes(e.id)){e.dead=true;e.death=2}});boss.hp=clamp(d.boss?.hp??boss.maxHp,0,boss.maxHp);boss.dead=!!d.boss?.dead;boss.phase=boss.hp<=boss.maxHp*.5?2:1;zone=regionAt(player.x);cam=clamp(player.x-VW*.35,0,WORLD-VW);expansion?.restore(d.expansion);return true}
function regionAt(x){return x<2700?0:x<5450?1:2}
function setState(next){state=next;document.body.dataset.state=next;keys={};if(player)player.jumpHeld=false;document.body.classList.toggle('playing',next==='play');if(next==='play')canvas.focus({preventScroll:true});syncForestAmbience()}
function closeOverlays(){['overlay','inventory','map','help'].forEach(id=>$(id).classList.add('hidden'))}
function startGame(continuing=false){if(continuing&&!load()){say('Aún no hay una expedición guardada.');return}if(!continuing){difficulty=$('difficulty')?.value||difficulty;reset()}closeOverlays();setState('play');initAudio();updateHUD();announceZone();if(continuing&&boss.dead)say('El Guardián ha caído. Pulsa E junto al monolito para sellar el Umbral.');save()}
function showMenu(){closeOverlays();setState('menu');$('overlay').classList.remove('hidden');$('overlay').innerHTML=`<div class="menu-content"><div class="menu-mark">AVENTURA · ACCIÓN · SUPERVIVENCIA</div><h1>UMBRA</h1><div class="menu-subtitle">CRÓNICAS DEL UMBRAL</div><p>El bosque ha olvidado la luz.<br>Explora sus ruinas, forja tu destino y mantén viva <strong>la última llama.</strong></p><div class="menu-buttons"><button class="primary" id="start"><svg><use href="#i-sword"/></svg>NUEVA EXPEDICIÓN</button><button class="secondary" id="continue" ${readSave()?'':'disabled'}>CONTINUAR</button></div><div class="menu-options"><label for="difficulty">DIFICULTAD</label><select id="difficulty"><option value="veteran">Veterano</option><option value="relentless">Implacable</option></select></div><div class="menu-note"><svg><use href="#i-fire"/></svg>El fuego es tu refugio. El silencio, una advertencia.</div></div><div class="menu-decoration"><span>«Lo que duerme aquí<br>no debe despertar.»</span><small>FRAGMENTO DEL DIARIO DEL ERRANTE</small></div>`;$('difficulty').value=difficulty;$('start').onclick=()=>{if(readSave())showNewConfirmation();else startGame()};$('continue').onclick=()=>startGame(true);expansion?.menu()}
function showNewConfirmation(){const chosen=$('difficulty').value;$('overlay').innerHTML=`<div class="menu-content"><div class="eyebrow">UNA NUEVA HUELLA EN LA CENIZA</div><div class="pause-title">Volver a empezar</div><p>La nueva expedición reemplazará la partida guardada en este navegador.</p><div class="menu-buttons"><button class="primary" id="confirmNew">COMENZAR DE NUEVO</button><button class="secondary" id="cancelNew">CANCELAR</button></div></div>`;$('confirmNew').onclick=()=>{difficulty=chosen;startGame()};$('cancelNew').onclick=showMenu}
function pause(){if(state==='pause'){resume();return}if(state!=='play')return;save();setState('pause');$('overlay').classList.remove('hidden');$('overlay').innerHTML=`<div class="menu-content"><div class="menu-mark">LA LLAMA TE ESPERA</div><div class="pause-title">Un breve respiro.</div><p>La expedición se detiene.<br>Tu progreso se conserva en este navegador.</p><div class="menu-buttons"><button class="primary" id="resume">CONTINUAR</button><button class="secondary" id="toMenu">GUARDAR Y SALIR</button></div><div class="menu-note">ESC · Volver al bosque</div></div>`;$('resume').onclick=resume;$('toMenu').onclick=()=>{save();showMenu()}}
function resume(){closeOverlays();setState('play');initAudio()}
function openModal(id){if(['dying','dead','won'].includes(state))return;if(state===id){closeModal(id);return}if(['inventory','map','help'].includes(state))closeModal(state);restoreState=state;setState(id);$(id).classList.remove('hidden');if(id==='inventory')renderInventory();if(id==='map')renderMap();$(id).querySelector('button')?.focus()}
function closeModal(id){$(id).classList.add('hidden');setState(restoreState==='play'?'play':restoreState==='pause'?'pause':'menu')}
function announceZone(){const z=zones[zone];$('banner-num').textContent=z.tag;$('banner-title').textContent=z.name;$('banner-sub').textContent=z.sub;$('zone-banner').classList.add('visible');bannerTime=4.2;updateHUD()}
function equip(index){if(state!=='play')return;if(index===1&&!player.gear.spear||index===2&&!player.gear.bow){say('Fabrica esta arma en la forja · I');return}if(player.atk>0)return;player.weapon=index;expansion?.legacy('equip',{weapon:index});updateHUD();sound('equip')}
function costsLabel(cost){const names={wood:'madera',ore:'mineral',shard:'esencia'};return Object.entries(cost).map(([k,v])=>`${v} ${names[k]}`).join(' · ')}
function renderInventory(){const p=player;$('inventoryMaterials').innerHTML=[['wood','log','Madera'],['ore','ore','Mineral'],['shard','shard','Esencia']].map(([k,icon,name])=>`<div class="resource"><svg><use href="#i-${icon}"/></svg>${p[k]} <span style="color:#829b8c">${name}</span></div>`).join('');$('recipes').innerHTML=recipes.map(r=>{const done=r.once&&p.gear[r.id],can=Object.entries(r.cost).every(([k,v])=>p[k]>=v);return`<article class="recipe"><svg><use href="#i-${r.icon}"/></svg><h3>${r.name}</h3><p>${r.desc}</p><div class="recipe-cost">${costsLabel(r.cost)}</div><button class="${done?'secondary':'primary'}" data-craft="${r.id}" ${done||!can?'disabled':''}>${done?'EQUIPADO':r.id==='potion'?'PREPARAR':'FABRICAR'}</button></article>`}).join('');$('invStats').innerHTML=`Vida <b>${Math.ceil(p.hp)}/${p.maxHp}</b> · Defensa <b>${p.gear.armor?'28 %':'0 %'}</b> · Elixires <b>${p.potions}</b> · Flechas <b>${p.arrows}</b>`;$('recipes').querySelectorAll('[data-craft]').forEach(b=>b.onclick=()=>craft(b.dataset.craft));expansion?.inventory()}
function craft(id){if(state!=='inventory')return;if(expansion?.legacy('legacyCraft',{recipe:id}))return;const r=recipes.find(r=>r.id===id),p=player;if(!r||r.once&&p.gear[id]||!Object.entries(r.cost).every(([k,v])=>p[k]>=v))return;Object.entries(r.cost).forEach(([k,v])=>p[k]-=v);if(r.once)p.gear[id]=true;if(id==='armor'){p.maxHp=125;p.hp=Math.min(p.maxHp,p.hp+25)}if(id==='bow')p.arrows+=20;if(id==='arrows')p.arrows+=20;if(id==='potion')p.potions++;sound('craft');say(`${r.name} · ${r.once?'equipo mejorado':'listo'}`);renderInventory();updateHUD();save()}
function renderMap(){$('mapTrack').innerHTML=zones.map((z,i)=>`<div class="map-zone ${zone===i?'current':''}"><h3>${z.short}</h3><small>${zone===i?'ESTÁS AQUÍ':player.x>i*2700?'EXPLORADO':'AL ESTE'}</small><p>${['Madera, hierro y depredadores. Prepara tu equipo.','Centinelas y espectros. Vigila sus ataques a distancia.','Forja armadura. Vhal protege el último sello.'][i]}</p><small>${checkpoint>=i?'◆ REFUGIO ACTIVADO':'◇ LLAMA POR DESCUBRIR'}</small></div>`).join('');$('mapTip').textContent=boss.dead?'Vhal ha caído. Alcanza el monolito del este y pulsa E para sellar el Umbral.':!player.gear.sword?'Primera tarea: reúne 5 de madera y 8 de mineral. Abre la forja con I para mejorar tu espada.':!player.gear.armor?'El santuario castiga cada error. Fabrica armadura y reserva al menos dos elixires.':'Conserva resistencia para esquivar. El Guardián cambia de ritmo al perder la mitad de su vida.'}
function updateHUD(){const p=player;$('healthLabel').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('healthFill').style.width=p.hp/p.maxHp*100+'%';$('staminaFill').style.width=p.stamina+'%';$('lifeMeter').setAttribute('aria-valuenow',Math.ceil(p.hp));$('lifeMeter').setAttribute('aria-valuemax',p.maxHp);$('staminaMeter').setAttribute('aria-valuenow',Math.round(p.stamina));$('wood').textContent=p.wood;$('ore').textContent=p.ore;$('shard').textContent=p.shard;$('potionCount').textContent=p.potions;$('arrowCount').textContent=p.gear.bow?p.arrows:'—';$('weaponLabel').textContent=p.weapon===1?'LANZA DE VIGILIA':p.weapon===2?'ARCO DE CENIZA':p.gear.sword?'HOJA DE HIERRO':'HOJA DEL EXILIO';$('armorLabel').textContent=p.gear.armor?'· DEFENSA 28 %':'· SIN ARMADURA';document.querySelectorAll('[data-slot]').forEach(b=>{const i=+b.dataset.slot;b.classList.toggle('active',p.weapon===i);b.classList.toggle('locked',i===1&&!p.gear.spear||i===2&&!p.gear.bow);b.setAttribute('aria-pressed',p.weapon===i)});const z=zones[zone];$('zoneNumber').textContent=z.tag;$('zoneName').textContent=z.name;$('zoneWeather').textContent=z.weather;$('checkpointLabel').textContent=camps[checkpoint].name.toUpperCase();const active=boss.active&&!boss.dead;$('bossbar').classList.toggle('hidden',!active);if(active){$('bossfill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';$('bossname').textContent=`VHAL, GUARDIÁN DEL UMBRAL · ${boss.phase===2?'FASE II':'FASE I'}`;$('boss-intent').textContent=boss.mode==='windup'?['SEGADOR · Aléjate o cruza con dash','RUPTURA · Salta la onda','CENIZAS · Esquiva los proyectiles'][boss.pattern%3]:boss.mode==='phase'?'EL UMBRAL SE QUIEBRA · MANTÉN DISTANCIA':''}if(boss.dead){$('quest-title').textContent='El último sello';$('quest-text').textContent='El Guardián ha caído. Alcanza el monolito y sella el Umbral.';$('quest-progress').textContent='E · SELLAR EL UMBRAL'}else if(zone===2){$('quest-title').textContent='Lo que duerme al este';$('quest-text').textContent='Descansa, prepara elixires y enfrenta a Vhal. Observa antes de atacar.';$('quest-progress').textContent='DERROTA AL GUARDIÁN'}else if(p.gear.sword){$('quest-title').textContent='Sigue las llamas';$('quest-text').textContent='Atraviesa las ruinas. Busca refugios y forja una armadura antes del santuario.';$('quest-progress').textContent=`${checkpoint+1} / 3 REFUGIOS ACTIVADOS`}else{$('quest-title').textContent='Antes de la oscuridad';$('quest-text').textContent='Reúne madera y mineral. Una hoja mejor será tu única garantía.';$('quest-progress').textContent=`HIERRO ${Math.min(8,p.ore)}/8 · MADERA ${Math.min(5,p.wood)}/5`};expansion?.hud()}
// The supplied recording stays embedded, so the local HTML remains portable.
// Ambient and combat audio share one mute control; ambience is mixed at 9.9%.
const AUDIO_PREF_KEY='umbra.audio.enabled',FOREST_AMBIENT_GAIN=.55,SFX_MASTER_GAIN=.18;
let audio=null,audioMaster=null,ambientSource=null,ambientGain=null;
let ambientWanted=false,ambientStopTimer=0,ambientGeneration=0,ambientErrorShown=false;
const forestAmbient=$('forestAmbient');
let audioOn=(()=>{try{return localStorage.getItem(AUDIO_PREF_KEY)!=='false'}catch{return true}})();
function updateAudioButton(){
 const button=$('soundButton');button.querySelector('use').setAttribute('href',audioOn?'#i-sound':'#i-mute');
 button.setAttribute('aria-label',audioOn?'Silenciar sonido':'Activar sonido');button.setAttribute('aria-pressed',String(audioOn));
 button.title=audioOn?'Silenciar sonido':'Activar sonido';
}
function rampAudio(parameter,target,duration){
 if(!audio)return;const now=audio.currentTime;
 if(typeof parameter.cancelAndHoldAtTime==='function')parameter.cancelAndHoldAtTime(now);
 else{const current=parameter.value;parameter.cancelScheduledValues(now);parameter.setValueAtTime(current,now)}
 parameter.linearRampToValueAtTime(target,now+duration);
}
function initAudio(){
 if(!audioOn)return;
 try{
   if(!audio){
     const AudioContextClass=window.AudioContext||window.webkitAudioContext;
     if(!AudioContextClass)return;
     audio=new AudioContextClass();audioMaster=audio.createGain();audioMaster.gain.value=SFX_MASTER_GAIN;audioMaster.connect(audio.destination);
     ambientGain=audio.createGain();ambientGain.gain.value=0;ambientGain.connect(audioMaster);
     ambientSource=audio.createMediaElementSource(forestAmbient);ambientSource.connect(ambientGain);
     audio.addEventListener('statechange',syncForestAmbience);
   }
   rampAudio(audioMaster.gain,SFX_MASTER_GAIN,.05);
   if(audio.state==='suspended')audio.resume().then(syncForestAmbience).catch(()=>{});
   syncForestAmbience();
 }catch{
   if(!ambientErrorShown){ambientErrorShown=true;say('No se pudo activar el audio en este navegador.')}
 }
}
function syncForestAmbience(){
 const wanted=!!(audioOn&&audio?.state==='running'&&state==='play'&&zone===0&&!expansion?.inCave&&!document.hidden);
 if(wanted===ambientWanted)return;
 ambientWanted=wanted;const generation=++ambientGeneration;
 clearTimeout(ambientStopTimer);ambientStopTimer=0;
 if(!ambientGain)return;
 if(wanted){
   // Starting only after a gesture respects browser autoplay restrictions.
   forestAmbient.play().then(()=>{
     if(generation===ambientGeneration&&ambientWanted)rampAudio(ambientGain.gain,FOREST_AMBIENT_GAIN,1.4);
   }).catch(error=>{
     if(generation!==ambientGeneration)return;
     ambientWanted=false;
     if(error.name!=='AbortError'&&error.name!=='NotAllowedError'&&!ambientErrorShown){
       ambientErrorShown=true;say('No se pudo cargar el ambiente del bosque.')
     }
   });
 }else{
   const leavingForest=zone!==0,duration=document.hidden?.01:leavingForest?1.4:.18;
   rampAudio(ambientGain.gain,0,duration);
   ambientStopTimer=setTimeout(()=>{
     if(generation!==ambientGeneration||ambientWanted)return;
     forestAmbient.pause();if(leavingForest)forestAmbient.currentTime=0;
     ambientStopTimer=0;
   },Math.ceil(duration*1000)+35);
 }
}
function resetForestAmbience(){
 clearTimeout(ambientStopTimer);ambientStopTimer=0;ambientGeneration++;ambientWanted=false;
 forestAmbient.pause();forestAmbient.currentTime=0;
 if(ambientGain){ambientGain.gain.cancelScheduledValues(audio.currentTime);ambientGain.gain.setValueAtTime(0,audio.currentTime)}
}
function toggleAudio(){
 audioOn=!audioOn;try{localStorage.setItem(AUDIO_PREF_KEY,String(audioOn))}catch{}
 updateAudioButton();
 if(audioOn){initAudio();sound('equip')}
 else{if(audioMaster)rampAudio(audioMaster.gain,0,.06);syncForestAmbience()}
}
document.addEventListener('visibilitychange',syncForestAmbience);
forestAmbient.addEventListener('error',()=>{
 if(!ambientErrorShown){ambientErrorShown=true;say('No se pudo cargar el ambiente del bosque.')}
});
updateAudioButton();

function sound(type){if(!audioOn||!audio||audio.state!=='running')return;const presets={swing:[210,55,.13,'sawtooth'],hit:[100,35,.12,'triangle'],dash:[460,90,.15,'sine'],jump:[170,300,.11,'sine'],land:[65,32,.08,'triangle'],harvest:[320,95,.09,'triangle'],craft:[420,840,.45,'sine'],heal:[360,720,.4,'sine'],hurt:[130,42,.22,'sawtooth'],equip:[500,350,.07,'sine'],boss:[70,30,.65,'sawtooth'],shot:[320,100,.09,'triangle']};const [a,b,d,w]=presets[type]||presets.hit,o=audio.createOscillator(),g=audio.createGain();o.type=w;o.frequency.setValueAtTime(a,audio.currentTime);o.frequency.exponentialRampToValueAtTime(b,audio.currentTime+d);g.gain.setValueAtTime(.001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.3,audio.currentTime+.008);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audioMaster);o.start();o.stop(audio.currentTime+d+.02)}

function burst(x,y,color,n=12,power=150){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-power,power),vy:rand(-power*1.3,power*.25),life:rand(.25,.8),max:.8,size:rand(1.5,4),color,gravity:450});if(particles.length>550)particles.splice(0,particles.length-550)}
function floating(x,y,label,color='#e6ce97'){texts.push({x,y,label,color,life:1.15})}
function spend(value){if(player.stamina<value)return false;player.stamina-=value;player.staminaDelay=.38;return true}
let pointer={x:0,y:0,aim:false};
// All pose clocks advance in simulation time, never while drawing a frame.
const ATTACK_TIMING={activeStart:.32,activeEnd:.66,arrowRelease:.42};
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
function motionDefaults(){return{clock:0,gait:0,move:0,run:0,lean:0,state:'idle',stateTime:0,trailClock:0}}
function animationState(p){
 if(p.hp<=0)return 'death';
 if(p.hurt>0)return 'hurt';
 if(p.dash>0)return 'dash';
 if(p.atk>0)return ['sword','spear','bow'][p.weapon];
 if(p.harvest>0)return 'harvest';
 if(!p.ground)return p.vy<-60?'jump':p.vy>70?'fall':'apex';
 if(p.land>0)return 'land';
 return Math.abs(p.vx)>32?(Math.abs(p.vx)>245?'run':'walk'):'idle';
}
function updateMotion(p,dt,distance){
 const m=p.motion||(p.motion=motionDefaults()),speed=Math.abs(p.vx);
 m.clock+=dt;m.move=lerp(m.move,p.ground&&speed>30?1:0,1-Math.exp(-18*dt));
 m.run=lerp(m.run,speed>245?1:0,1-Math.exp(-10*dt));
 m.lean=lerp(m.lean,p.dash>0?.33:p.hurt>0?-.18:speed>245?.13:speed>40?.045:0,1-Math.exp(-16*dt));
 if(p.ground&&speed>18&&p.dash===0)m.gait+=Math.abs(distance)/(64+m.run*24)*Math.PI*2;
 const next=animationState(p);m.stateTime=next===m.state?m.stateTime+dt:0;m.state=next;
 p.anim=m.gait;
}
function attackSample(p){
 const t=p.atk>0?clamp(1-p.atk/p.atkMax,0,1):0;
 const swing=ease((t-.19)/.43),recover=ease((t-.72)/.28);
 const reverse=p.combo===1;
 return{t,active:p.atk>0&&t>=(p.weapon===1?.38:ATTACK_TIMING.activeStart)&&t<=(p.weapon===1?.67:ATTACK_TIMING.activeEnd),
   angle:lerp(lerp(reverse?1.65:-2.05,reverse?-1.25:1.05,swing),.45,recover),
   thrust:t<.23?lerp(-8,-15,ease(t/.23)):t<.53?lerp(-15,17,ease((t-.23)/.3)):lerp(17,0,ease((t-.53)/.47)),
   draw:t<ATTACK_TIMING.arrowRelease?ease(t/ATTACK_TIMING.arrowRelease):1-ease((t-ATTACK_TIMING.arrowRelease)/.2)};
}
function releaseArrow(){
 const p=player,shot=p.pendingShot;if(!shot||p.atk<=0||attackSample(p).t<ATTACK_TIMING.arrowRelease)return;
 p.pendingShot=null;if(p.arrows<1)return;p.arrows--;
 projectiles.push({x:p.x+14+shot.ax*30,y:p.y+23+shot.ay*30,vx:shot.ax*790,vy:shot.ay*790,w:16,h:5,life:2,kind:'arrow',damage:shot.damage*(expansion?.sheet.bowDamage??1),owner:'player'});
 sound('shot');
}
function attack(){
 const p=player;if(state!=='play'||p.dash>0||p.hurt>.17)return;
 if(p.atk>0){if(p.atk<p.atkMax*.65)p.queueAttack=true;return}
 const cost=p.weapon===1?20:p.weapon===2?16:14;
 if(p.weapon===2&&!p.arrows){say('Sin flechas. Fabrica un haz en la forja · I');return}
 if(!spend(cost)){p.queueAttack=false;say('Sin resistencia · toma un respiro');return}
 p.combo=p.comboTime>0?(p.combo+1)%3:0;p.comboTime=.85;
 p.atkMax=p.weapon===1?.45:p.weapon===2?.5:p.combo===2?.43:.34;
 p.atkMax/=expansion?.sheet.attackSpeed??1;p.atk=p.atkMax;p.attackId++;p.queueAttack=false;p.harvest=0;
 if(p.weapon===2){
   let ax=p.face,ay=-.025;
   if(pointer.aim){const dx=pointer.x-(p.x+14-cam),dy=pointer.y-(p.y+22),length=Math.hypot(dx,dy);if(length>10){ax=dx/length;ay=dy/length;p.face=sign(ax)}}
   p.aimAngle=Math.atan2(ay,ax*p.face);p.pendingShot={ax,ay,damage:p.gear.sword?34:28};
 }else{p.vx+=p.face*(p.combo===2?105:55);sound('swing')}
 expansion?.onAttack();
}
function dash(){
 const p=player;if(state!=='play'||p.dashCd>0||p.hurt>.17||!spend(28))return;
 p.dash=.19;p.dashCd=.64;p.inv=Math.max(p.inv,.24);p.atk=0;p.pendingShot=null;p.queueAttack=false;p.vy*=.3;
 p.motion.trailClock=0;expansion?.legacy('dash');if(expansion?.progress.characterId==='samurai')p.inv=Math.max(p.inv,.34);sound('dash');burst(p.x+14,p.y+30,'#96b8b1',10,85);
}

function usePotion(){if(state!=='play')return;if(expansion?.legacy('legacyPotion'))return;const p=player;if(p.potions<1){say('No quedan elixires · fabrica más en la forja');return}if(p.hp>=p.maxHp){say('La llama ya arde con fuerza · vida completa');return}p.potions--;p.hp=Math.min(p.maxHp,p.hp+55);burst(p.x+14,p.y+30,'#a6d0a5',30,100);floating(p.x,p.y-5,'+55','#a7dda8');sound('heal');updateHUD();save()}
function nearestInteraction(){const extra=expansion?.interactionTarget();if(expansion?.inCave||extra?.portal)return extra;const p=player;if(boss.dead&&p.x>7640)return{type:'seal',x:7760,y:GROUND,label:'Sellar el Umbral'};for(let i=0;i<camps.length;i++)if(Math.abs(p.x+14-camps[i].x)<78&&Math.abs(p.y+p.h-GROUND)<40)return{type:'camp',index:i,x:camps[i].x,y:GROUND,label:'Descansar y guardar'};let nearest=null,best=75;for(const n of nodes){if(!n.alive)continue;const dx=Math.abs(n.x-(p.x+14)),dy=Math.abs(n.y-(p.y+p.h));if(dx<best&&dy<55){best=dx;nearest={type:'node',node:n,x:n.x,y:n.y,label:n.type==='wood'?'E · Recoger madera':n.type==='ore'?'E · Extraer mineral':'E · Absorber esencia'}}}return nearest||extra}
function interact(){if(state!=='play')return;if(expansion?.interact())return;const p=player;if(p.harvest>0||p.dash>0||p.atk>0)return;const target=nearestInteraction();if(!target){say('Acércate a madera, mineral, cristales o una llama.');return}if(target.type==='seal'){win();return}if(target.type==='camp'){checkpoint=target.index;p.hp=p.maxHp;p.stamina=100;p.potions=Math.max(p.potions,2);projectiles=projectiles.filter(q=>q.owner==='player');enemies.forEach(e=>{if(!e.dead&&Math.abs(e.x-target.x)<420){e.x=e.home;e.mode='idle';e.timer=1.5}});burst(target.x,GROUND-25,'#f0c687',40,130);sound('heal');say(`${camps[checkpoint].name} · vida restaurada · mínimo 2 elixires`);updateHUD();save();return}const n=target.node;p.face=sign(n.x-(p.x+14));p.harvest=.24;n.hit=.18;n.hp--;sound('harvest');burst(n.x,n.y-20,n.type==='wood'?'#ae9366':n.type==='ore'?'#b9c2ae':'#7fd6d2',8,110);if(n.hp<=0){n.alive=false;const key=n.type==='wood'?'wood':n.type==='ore'?'ore':'shard',amount=n.type==='wood'?5:n.type==='ore'?4:3;p[key]+=amount;floating(n.x,n.y-60,`+${amount} ${key==='wood'?'madera':key==='ore'?'mineral':'esencia'}`);burst(n.x,n.y-20,n.type==='crystal'?'#84d6ce':'#b5ae81',17,150);updateHUD();save()}}
function damagePlayer(amount,sourceX){if(expansion?.online)return false;amount*=expansion?.defenseMultiplier()??1;const p=player;if(state!=='play'||p.inv>0||p.hp<=0)return false;const value=Math.round(amount*(p.gear.armor?.72:1)*(difficulty==='relentless'?1.35:1));p.hp=Math.max(0,p.hp-value);p.inv=.82;p.hurt=.34;p.atk=0;p.pendingShot=null;p.queueAttack=false;p.dash=0;p.vx=sign(p.x-sourceX)*245;p.vy=-190;shake=Math.max(shake,8);hitstop=.045;burst(p.x+14,p.y+25,'#c67a66',20,170);floating(p.x,p.y-9,`−${value}`,'#ef9c87');sound('hurt');if(p.hp<=0){p.deadTime=0;deaths++;setState('dying');$('interact').classList.add('hidden')}updateHUD();return true}
function damageEnemy(e,amount,direction,attackId){if(expansion?.online)return;amount*=expansion?.damageMultiplier()??1;if(e.dead||e.hitBy===attackId)return;e.hitBy=attackId;e.hp-=amount;e.hit=.16;e.stun=e.type==='knight'?.12:.24;e.vx=direction*(e.type==='knight'?100:230);burst(e.x+e.w*.5,e.y+e.h*.4,e.type==='wisp'?'#96d0c6':'#d3b982',12,150);floating(e.x+e.w*.5,e.y-4,Math.round(amount).toString());shake=Math.max(shake,3);hitstop=.035;sound('hit');if(e.hp<=0){e.dead=true;e.death=0;kills++;const reward=e.type==='knight'?4:2;player.shard+=reward;floating(e.x,e.y-25,`+${reward} esencia`,'#8bcac1');burst(e.x+e.w/2,e.y+e.h/2,'#81b7a0',24,170);save()}}
function damageBoss(amount,id){if(expansion?.online)return;amount*=expansion?.damageMultiplier()??1;if(boss.dead||boss.hitBy===id||!boss.active||boss.mode==='phase')return;boss.hitBy=id;boss.hp=Math.max(0,boss.hp-amount);boss.hit=.13;burst(boss.x+40,boss.y+50,'#ddb681',15,180);floating(boss.x+40,boss.y-10,Math.round(amount).toString());shake=Math.max(shake,4);hitstop=.04;sound('hit');if(boss.hp<=0){boss.dead=true;boss.death=0;boss.mode='dead';player.shard+=20;kills++;projectiles=projectiles.filter(q=>q.owner==='player');burst(boss.x+40,boss.y+60,'#edd3a0',90,350);shake=18;sound('boss');say('VHAL HA CAÍDO · El monolito del este aguarda tu último sello.');updateHUD();save()}}
function meleeHits(){
 const p=player;if(p.atk<=0||p.weapon===2||!attackSample(p).active)return;
 const range=p.weapon===1?115:p.combo===2?83:p.gear.sword?72:61;
 const box={x:p.face>0?p.x+9:p.x+19-range,y:p.y-4,w:range,h:p.h+7};
 const damage=p.weapon===1?27:(p.gear.sword?26.4:16)*(p.combo===2?1.55:1);
 for(const e of enemies)if(!e.dead&&rectHit(box,e))damageEnemy(e,damage,p.face,p.attackId);
 if(!boss.dead&&rectHit(box,boss))damageBoss(damage,p.attackId);
}
function movePlayer(dt){
 const p=player,oldX=p.x,prevBottom=p.y+p.h,wasGround=p.ground;
 p.previousX=p.x;p.previousY=p.y;
 for(const k of ['inv','hurt','dash','dashCd','atk','comboTime','staminaDelay','land','harvest'])p[k]=Math.max(0,p[k]-dt);
 if(p.atk===0&&p.queueAttack)attack();jumpBuffer=Math.max(0,jumpBuffer-dt);
 const ax=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
 const running=(keys.KeyW||keys.ArrowUp)&&p.stamina>4&&p.atk===0;
 if(p.hurt===0&&p.dash===0){
   if(ax&&p.atk===0)p.face=ax;
   const target=ax*(running?307:205)*(expansion?.sheet.moveSpeed??1)*(p.atk>0?.36:1);
   p.vx=lerp(p.vx,target,1-Math.exp(-dt*(p.ground?17:8)));
   if(!ax&&Math.abs(p.vx)<.4)p.vx=0;
   if(running&&ax){p.stamina=Math.max(0,p.stamina-17*dt);p.staminaDelay=.2}
 }
 p.coyote=p.ground?.11:Math.max(0,p.coyote-dt);
 if(jumpBuffer>0&&p.coyote>0&&p.hurt===0&&p.dash===0){
   p.vy=p.jumpHeld?-625:-260;p.ground=false;p.coyote=0;jumpBuffer=0;
   sound('jump');burst(p.x+14,prevBottom,'#a6b1a0',8,85);
 }
 if(p.dash>0){p.vx=p.face*685;p.vy*=Math.pow(.01,dt)}else p.vy+=1390*dt;
 p.x=clamp(p.x+p.vx*dt,boss.active&&!boss.dead?6860:15,boss.active&&!boss.dead?WORLD-80:WORLD-45);
 // Solid ledge sides block movement; floating platforms remain one-way.
 for(const ledge of [...(expansion?.inCave?[]:ledges),...(expansion?.solids()||[])]){
   if(prevBottom<=ledge.y+1||p.y>=GROUND)continue;
   if(p.vx>0&&oldX+p.w<=ledge.x+1&&p.x+p.w>ledge.x){p.x=ledge.x-p.w;p.vx=0}
   else if(p.vx<0&&oldX>=ledge.x+ledge.w-1&&p.x<ledge.x+ledge.w){p.x=ledge.x+ledge.w;p.vx=0}
 }
 p.y+=p.vy*dt;p.ground=false;
 let landingY=GROUND;
 if(p.vy>=0)for(const surface of [...(expansion?.inCave?[]:[...ledges,...platforms]),...(expansion?.solids()||[])]){
   if(p.x+p.w>surface.x&&p.x<surface.x+surface.w&&prevBottom<=surface.y+2&&p.y+p.h>=surface.y)landingY=Math.min(landingY,surface.y);
 }
 if(p.vy>=0&&p.y+p.h>=landingY){
   const impact=p.vy;p.y=landingY-p.h;p.vy=0;p.ground=true;
   if(impact>220&&!wasGround){p.land=.18;burst(p.x+14,landingY,'#a1afa0',10,Math.min(130,impact*.18));sound('land')}
 }
 if(p.staminaDelay===0&&p.atk===0&&p.dash===0)p.stamina=Math.min(100,p.stamina+31*dt);
 updateMotion(p,dt,p.x-oldX);
 if(p.dash>0&&!reduced){
   p.motion.trailClock-=dt;
   if(p.motion.trailClock<=0){
     const frozen={...p,gear:{...p.gear},motion:{...p.motion},atk:0,hurt:0,inv:0,pendingShot:null};
     ghosts.push({actor:frozen,life:.14});if(ghosts.length>3)ghosts.shift();p.motion.trailClock=.045;
   }
 }
 if(p.ground&&Math.abs(p.vx)>120&&Math.random()<dt*10)burst(p.x+14,p.y+p.h,'#6d8671',1,25);
 releaseArrow();meleeHits();
}

function updateEnemyLogic(e,dt){return worldAI.enemy(e,dt)}
// Attacks are evaluated by the shared world algorithms.
function updateBossLogic(dt){return worldAI.boss(dt)}
function updateProjectiles(dt){if(expansion?.online)return;for(const q of projectiles){q.life-=dt;const oldX=q.x,oldY=q.y;q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.kind==='arrow')q.vy+=170*dt;if(q.kind==='wave')q.y=GROUND-20;const box={x:Math.min(oldX,q.x)-q.w/2,y:Math.min(oldY,q.y)-q.h/2,w:Math.abs(q.x-oldX)+q.w,h:Math.abs(q.y-oldY)+q.h};if(q.owner==='player'){for(const e of enemies)if(!e.dead&&rectHit(box,e)){damageEnemy(e,q.damage,sign(q.vx),-time-Math.random());q.life=0;break}if(q.life>0&&!boss.dead&&rectHit(box,boss)){damageBoss(q.damage,-time-Math.random());q.life=0}}else if(rectHit(box,player)){if(damagePlayer(q.damage,q.x-sign(q.vx)*20))q.life=0}if(q.kind!=='wave'&&q.y>groundAt(q.x)){q.life=0;burst(q.x,q.y,q.owner==='player'?'#bbaa7d':'#bc8b67',4,55)}if(q.kind!=='arrow'&&Math.random()<.45)particles.push({x:q.x,y:q.y,vx:rand(-10,10),vy:-12,life:.3,max:.3,size:2,color:q.kind==='wisp'?'#83c0bf':'#dda16d',gravity:0})}projectiles=projectiles.filter(q=>q.life>0&&q.x>0&&q.x<WORLD)}
function deathScreen(){setState('dead');$('overlay').classList.remove('hidden');$('overlay').innerHTML=`<div class="menu-content"><div class="menu-mark">EL BOSQUE RECLAMA SU DEUDA</div><div class="pause-title">La llama persiste.</div><p>Has caído, pero tu historia continúa.<br>Regresa a <strong>${camps[checkpoint].name}</strong>. Conservas tu equipo; pierdes un 20 % de esencia.</p><div class="menu-buttons"><button class="primary" id="retry">VOLVER A LA LLAMA</button><button class="secondary" id="deathMenu">MENÚ PRINCIPAL</button></div></div>`;$('retry').onclick=respawn;$('deathMenu').onclick=()=>{respawn();save();showMenu()}}
function respawn(){if(expansion?.legacy('respawn'))return;if(expansion?.inCave)expansion.exitCave();const p=player;p.x=camps[checkpoint].x+30;p.y=GROUND-p.h;p.hp=p.maxHp;p.stamina=100;p.potions=Math.max(2,p.potions);p.shard=Math.floor(p.shard*.8);p.vx=p.vy=p.atk=p.dash=p.hurt=p.deadTime=0;p.inv=1.5;p.queueAttack=false;p.motion=motionDefaults();p.pendingShot=null;p.jumpHeld=false;p.ground=true;projectiles=[];particles=[];ghosts=[];enemies.forEach(e=>{if(!e.dead){e.x=e.home;e.y=groundAt(e.x)-e.h;e.hp=e.maxHp;e.mode='idle';e.timer=1}});if(!boss.dead){boss.hp=boss.maxHp;boss.phase=1;boss.active=false;boss.mode='sleep';boss.x=7340}zone=regionAt(p.x);cam=clamp(p.x-VW*.35,0,WORLD-VW);closeOverlays();setState('play');updateHUD();save()}
function win(){if(state!=='play'||!boss.dead)return;setState('won');save();burst(7760,GROUND-90,'#e4d99f',100,300);$('overlay').classList.remove('hidden');const minutes=Math.floor(playTime/60);$('overlay').innerHTML=`<div class="menu-content"><div class="menu-mark">EL UMBRAL HA SIDO SELLADO</div><div class="pause-title">Vuelve la luz.</div><p>El bosque respira por primera vez en siglos.<br>Tu llama sobrevivió a la noche.<br><strong>Expedición completada.</strong></p><div class="end-stats"><div><b>${minutes}:${String(Math.floor(playTime%60)).padStart(2,'0')}</b><span>TIEMPO</span></div><div><b>${kills}</b><span>VICTORIAS</span></div><div><b>${deaths}</b><span>CAÍDAS</span></div></div><div class="menu-buttons"><button class="primary" id="exploreEnd">SEGUIR EXPLORANDO</button><button class="secondary" id="endMenu">MENÚ PRINCIPAL</button></div></div>`;$('exploreEnd').onclick=resume;$('endMenu').onclick=showMenu;sound('craft')}
function updateInteraction(){const target=state==='play'?nearestInteraction():null;if(!target){$('interact').classList.add('hidden');return}const el=$('interact');el.classList.remove('hidden');el.innerHTML=`<kbd>E</kbd>${target.label.replace('E · ','')}`;el.style.left=((target.x-cam)/VW*100)+'%';el.style.top=((target.y-95)/VH*100)+'%'}
function updateFX(dt){particles.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=q.gravity*dt;q.life-=dt});particles=particles.filter(q=>q.life>0);texts.forEach(q=>{q.y-=27*dt;q.life-=dt});texts=texts.filter(q=>q.life>0);ghosts.forEach(q=>q.life-=dt);ghosts=ghosts.filter(q=>q.life>0);shake=Math.max(0,shake-25*dt)}
function tick(dt){expansion?.tick(dt);if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible')}if(bannerTime>0&&state==='play'){bannerTime-=dt;if(bannerTime<=0)$('zone-banner').classList.remove('visible')}if(state==='dying'){player.deadTime+=dt;player.vx*=Math.pow(.02,dt);player.x=clamp(player.x+player.vx*dt,15,WORLD-45);player.vy+=1390*dt;player.y+=player.vy*dt;const deathFloor=groundAt(player.x+player.w/2);if(player.y+player.h>=deathFloor){player.y=deathFloor-player.h;player.vy=0;player.ground=true}else player.ground=false;updateMotion(player,dt,0);updateFX(dt);if(player.deadTime>1.35)deathScreen();return}if(state!=='play')return;playTime+=dt;if(hitstop>0){hitstop=Math.max(0,hitstop-dt);return}movePlayer(dt);for(const e of enemies){updateEnemy(e,dt);if(state!=='play')break}if(state==='play'){updateBoss(dt);updateProjectiles(dt)}nodes.forEach(n=>n.hit=Math.max(0,n.hit-dt));updateFX(dt);const newZone=regionAt(player.x);if(zone!==newZone){zone=newZone;syncForestAmbience();announceZone();save()}cam=lerp(cam,clamp(player.x-VW*.36+player.face*45,0,WORLD-VW),1-Math.exp(-dt*5));hudClock+=dt;interactClock+=dt;saveClock+=dt;if(hudClock>.09){updateHUD();hudClock=0}if(interactClock>.1){updateInteraction();interactClock=0}if(saveClock>8){save();saveClock=0}}

// A layered, deterministic landscape. The forest is cached so animation stays light.
function box(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function line(points,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function treeShape(g,x,base,height,width,color,seed,foliage=true){
 const r=random(seed),lean=(r()-.5)*height*.12;g.fillStyle=color;
 g.beginPath();g.moveTo(x-width*1.15,base);g.bezierCurveTo(x-width*.23,base-height*.17,x-width*.4+lean,base-height*.63,x+lean,base-height);g.lineTo(x+lean+width*.2,base-height-8);g.bezierCurveTo(x+width*.3+lean,base-height*.68,x+width*.2,base-height*.14,x+width,base);g.closePath();g.fill();
 const crown=(cx,cy,rx,ry)=>{g.fillStyle=color;g.beginPath();for(let k=0;k<64;k++){const a=k/64*Math.PI*2,jitter=.79+r()*.25,xx=cx+Math.cos(a)*rx*jitter,yy=cy+Math.sin(a)*ry*jitter;k?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.closePath();g.fill();for(let k=0;k<24;k++){const xx=cx+(r()-.5)*rx*1.8,yy=cy+(r()-.5)*ry*1.65;g.fillRect(xx,yy,2+r()*8,1+r()*3)}};
 for(let j=0;j<8;j++){const f=.38+j*.072,y=base-height*f,direction=j%2?1:-1,length=height*(.09+r()*.16),xx=x+lean*f+direction*length,yy=y-height*(.09+r()*.08);g.fillStyle=color;g.beginPath();g.moveTo(x+lean*f,y+width*.35);g.quadraticCurveTo(x+direction*length*.5,y-5,xx,yy);g.lineTo(xx+direction*length*.25,yy-height*.065);g.lineTo(xx,yy+3);g.quadraticCurveTo(x+direction*length*.5,y-10,x+lean*f,y-width*.2);g.fill();g.lineWidth=Math.max(1,width*.06);g.strokeStyle=color;for(let k=0;k<3;k++){const tx=xx-direction*k*length*.18,ty=yy+k*5;g.beginPath();g.moveTo(tx,ty);g.lineTo(tx+direction*length*.17,ty-height*.07);g.lineTo(tx+direction*length*.25,ty-height*.085);g.stroke()}if(foliage&&j>2)crown(xx,yy-8,length*.55,height*.035)}
 if(foliage)crown(x+lean,base-height+5,height*.16,height*.085);
 // Fine bark grooves, roots and hanging moss break up the broad silhouettes.
 g.save();g.globalAlpha=.17;g.strokeStyle='#a6b994';g.lineWidth=Math.max(.6,width*.035);for(let k=0;k<7;k++){let xx=x+(r()-.5)*width*.7,yy=base-r()*height*.65;g.beginPath();g.moveTo(xx,yy);g.bezierCurveTo(xx-2,yy-25,xx+3,yy-60,xx+lean*.12,yy-100-r()*50);g.stroke()}g.restore();g.strokeStyle=color;g.lineWidth=Math.max(1,width*.16);for(let k=0;k<5;k++){g.beginPath();g.moveTo(x+(k-2)*width*.15,base-10);g.quadraticCurveTo(x+(k-2)*width*.8,base-2,x+(k-2)*width*1.7,base+4);g.stroke()}
}
const forestCache=new Map();
function forestLayer(z,layer){const key=z+'-'+layer;if(forestCache.has(key))return forestCache.get(key);const cv=document.createElement('canvas');cv.width=1800;cv.height=810;const g=cv.getContext('2d'),r=random(320+layer*122),colors=[['#355653','#264843','#14352f'],['#3b5156','#2a4249','#182f36'],['#574c4b','#413e3d','#292f2e']][z];const count=layer===0?25:layer===1?18:11;for(let i=0;i<count;i++){const x=(i+.1+r()*.5)*1800/count,base=layer===0?575:layer===1?619:654,h=layer===0?240+r()*200:layer===1?350+r()*210:470+r()*210;g.globalAlpha=layer===0?.55:layer===1?.8:1;treeShape(g,x,base,h,layer===0?9:layer===1?17:27,colors[layer],i*41+layer*10,z!==2||i%3!==0)}forestCache.set(key,cv);return cv}
const scenery=[];{const r=random(4190);for(let x=0;x<WORLD;x+=19){scenery.push({x:x+r()*12,y:groundAt(x),h:3+r()*19,seed:r(),kind:r()>.4?'grass':'rock'})}}
function drawBackground(){const z=zones[zone];let g=ctx.createLinearGradient(0,0,0,VH);g.addColorStop(0,z.sky[0]);g.addColorStop(.55,z.sky[1]);g.addColorStop(1,z.sky[2]);ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);const moonX=VW*.7-cam*.025,moonY=146;glow(moonX,moonY,180,zone===2?'#cf8a6c20':'#d6d7ad20');ellipse(moonX,moonY,46,46,zone===2?'#c99780':'#bdcbb4');ellipse(moonX-12,moonY-7,41,42,z.sky[0]);glow(moonX+20,moonY+6,65,'#d2caa218');const r=random(99);for(let i=0;i<85;i++){const x=(r()*2200-cam*.04)%(VW+50),y=40+r()*330;const a=.12+Math.sin(time*.7+i)*.08;ctx.globalAlpha=a;box(x,y,i%7===0?2:1,i%7===0?2:1,'#e5e8d0')}ctx.globalAlpha=1;
// Broken spires and distant hills.
for(let j=0;j<2;j++){const shift=cam*(.045+j*.05);ctx.fillStyle=j===0?'#1b373d':'#254742';ctx.globalAlpha=zone===0?.65:.36;ctx.beginPath();ctx.moveTo(-40,VH);for(let x=-40;x<VW+100;x+=80)ctx.lineTo(x,435+j*55+Math.sin((x+shift)*.005+j)*45+Math.sin((x+shift)*.014)*16);ctx.lineTo(VW+100,VH);ctx.fill()}ctx.globalAlpha=1;
for(let layer=0;layer<3;layer++){const cv=forestLayer(zone,layer),offset=(cam*(.13+layer*.16))%1800;for(let x=-offset;x<VW;x+=1800)ctx.drawImage(cv,x,0);if(layer===0){ctx.save();ctx.globalAlpha=.055;for(let i=0;i<4;i++){const x=VW*.45+i*235-cam*.12;poly([[x,30],[x+28,30],[x-220,640],[x-370,640]],'#e2e7c5')}ctx.restore()}let fog=ctx.createLinearGradient(0,350+layer*70,0,675);fog.addColorStop(0,'#00000000');fog.addColorStop(.68,z.mist+(layer===0?'17':'0d'));fog.addColorStop(1,'#00000000');ctx.fillStyle=fog;ctx.fillRect(0,300,VW,420)}
for(let i=0;i<4;i++){const x=(i*490-time*8-cam*.21)%(VW+600)-200,y=470+i*31;const fog=ctx.createRadialGradient(x,y,0,x,y,330);fog.addColorStop(0,z.mist+'0c');fog.addColorStop(1,'#00000000');ctx.save();ctx.translate(0,y);ctx.scale(1,.12);ctx.fillStyle=fog;ctx.fillRect(x-350,-4000,700,8000);ctx.restore()}
// Distant birds and drifting motes.
for(let i=0;i<4;i++){const x=(VW*.65+i*23+time*5-cam*.07)%(VW+100),y=230+Math.sin(time*.65+i)*8+i*5;line([[x-4,y-Math.sin(time*4+i)*3],[x,y],[x+4,y-Math.sin(time*4+i)*3]],'#142e30',1.4)}
for(let i=0;i<28;i++){const x=((i*137.2+Math.sin(time*.3+i)*30-cam*.25)%(VW+90)+VW+90)%(VW+90)-40,y=240+(i*71%390)+Math.sin(time*.55+i)*15;ctx.globalAlpha=.15+Math.sin(time+i)*.12;ellipse(x,y,1.2,1.2,'#d9dfac')}ctx.globalAlpha=1}
function drawRuins(){const r=random(43);for(let i=0;i<20;i++){const wx=480+i*370,x=wx-cam;if(x<-250||x>VW+250)continue;const zz=regionAt(wx),height=zz===0?65+r()*65:130+r()*140;ctx.save();ctx.globalAlpha=.7;const col=zz===2?'#4e4c43':'#39544b';box(x,GROUND-height,27,height,col);box(x-6,GROUND-height-7,39,12,'#536556');box(x+4,GROUND-height+10,5,height-20,'#61715b40');for(let y=GROUND-height+38;y<GROUND;y+=26)line([[x,y],[x+27,y-2]],'#182e2c',2);poly([[x-11,GROUND],[x+15,GROUND-19],[x+42,GROUND]],'#3d5145');if(zz>0&&i%2===0){box(x+125,GROUND-height+20,27,height-20,col);ctx.strokeStyle=col;ctx.lineWidth=17;ctx.beginPath();ctx.arc(x+77,GROUND-height+25,64,Math.PI,Math.PI*1.92);ctx.stroke();line([[x+130,GROUND-height+18],[x+143,GROUND-height+33]],'#81917a',2)}ctx.restore()}}
function drawGround(){const start=Math.floor(cam/80)*80;for(let wx=start;wx<cam+VW+80;wx+=80){let x=wx-cam,gy=groundAt(wx+40),r=random(wx*7+99);box(x,gy,80,VH-gy+10,'#172b29');box(x,gy,80,12,zones[zone].ground);box(x,gy,80,2,'#718166');for(let j=0;j<18;j++){let xx=x+r()*78,yy=gy+13+r()*145,w=4+r()*17;poly([[xx,yy],[xx+w,yy-1],[xx+w+3,yy+5],[xx-2,yy+7]],j%3===0?'#253a32':'#1d302d');if(j%4===0)box(xx+2,yy,w-2,1,'#45514280')}if(wx%240===0){line([[x+25,gy+34],[x+37,gy+55],[x+29,gy+89],[x+42,gy+123]],'#0f2526',2);box(x+46,gy+80,3,3,'#79948755')}}
for(const t of ledges){const x=t.x-cam;if(x>VW||x+t.w<0)continue;box(x,t.y,t.w,GROUND-t.y,'#263f36');box(x,t.y,t.w,4,'#65775b');for(let j=0;j<t.w;j+=19)line([[x+j,t.y+13],[x+j+13,t.y+22],[x+j+8,t.y+35]],'#3d5140',2)}
for(const pl of platforms){const x=pl.x-cam;if(x>VW+20||x+pl.w<0)continue;poly([[x,pl.y],[x+pl.w,pl.y],[x+pl.w-8,pl.y+17],[x+pl.w*.75,pl.y+29],[x+pl.w*.55,pl.y+19],[x+pl.w*.22,pl.y+34],[x+9,pl.y+15]],'#293e36');box(x,pl.y,pl.w,4,'#78866b');for(let j=9;j<pl.w;j+=18){box(x+j,pl.y+5,11,3,'#485b43');line([[x+j,pl.y-1],[x+j+3,pl.y-8],[x+j+6,pl.y-1]],'#667c54',1)}for(let j=0;j<3;j++){const xx=x+25+j*43;line([[xx,pl.y+17],[xx+4,pl.y+38+j*5],[xx,pl.y+47+j*4]],'#4f6042',1)}}
for(const d of scenery){const x=d.x-cam;if(x<-30||x>VW+30)continue;if(d.kind==='grass'){const sway=Math.sin(time*1.8+d.seed*9)*2;line([[x-4,d.y],[x-5+sway,d.y-d.h*.7],[x,d.y-3],[x+2+sway,d.y-d.h],[x+4,d.y]],d.seed>.6?'#789065':'#465f47',1.2)}else{poly([[x,d.y],[x+3,d.y-5-d.seed*4],[x+10,d.y-7],[x+16,d.y]],'#53614d');line([[x+3,d.y-5],[x+10,d.y-7],[x+13,d.y-4]],'#81907160',1)}}}
function drawNode(n){if(!n.alive)return;const x=n.x-cam;if(x<-80||x>VW+80)return;ctx.save();ctx.translate(x+(n.hit?Math.sin(n.hit*90)*3:0),n.y);if(n.type==='wood'){ellipse(0,0,32,6,'#071b1b66');ctx.save();ctx.rotate(-.19);box(-24,-22,45,17,'#332e24');box(-25,-23,44,5,'#766044');box(-21,-14,41,4,'#4e422e');ellipse(22,-14,7,9,'#aa8b58');ellipse(22,-14,4.5,6,'#584932');line([[-20,-18],[5,-18],[14,-20]],'#a0865166',1);ctx.restore();poly([[-19,-27],[-8,-31],[5,-25],[14,-28],[21,-22],[-24,-17]],'#4e6746');for(let i=0;i<4;i++)line([[-16+i*10,-23],[-18+i*10,-33-Math.sin(i)*5]],'#7a8553',1)}else if(n.type==='ore'){ellipse(0,0,28,5,'#071b1b66');poly([[-26,-1],[-22,-16],[-12,-26],[3,-30],[19,-23],[27,-5],[19,0]],'#434d48');poly([[-22,-16],[-12,-26],[2,-28],[-2,-10]],'#7d8976');poly([[-2,-10],[2,-28],[19,-23],[11,-8]],'#5c6f63');line([[-14,-13],[-5,-19],[5,-14],[10,-22]],'#c3b58b',3);line([[1,-5],[6,-10],[12,-6]],'#bac5a2',2)}else{glow(0,-20,70,'#67cdc821');for(let i=0;i<3;i++){const xx=(i-1)*12,yy=-16-(i===1?16:0);poly([[xx-5,-3],[xx-7,yy],[xx,yy-12],[xx+7,yy+1],[xx+4,-3]],i===1?'#6eb5b1':'#4b8788');poly([[xx,yy-12],[xx,0],[xx+7,yy+1]],'#9bcfc155');line([[xx-1,yy-7],[xx-3,yy]],'#d1ecce',1)}}ctx.restore()}
function drawCamp(wx,lit=true){const x=wx-cam;if(x<-180||x>VW+180)return;glow(x,GROUND-27,160,lit?'#f2a94d24':'#778e6815');ellipse(x,GROUND+2,46,7,'#091d1d88');for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ellipse(x+Math.cos(a)*24,GROUND-2+Math.sin(a)*4,6,4,'#6f7460')}line([[x-17,GROUND-3],[x+15,GROUND-10]],'#785539',6);line([[x+16,GROUND-2],[x-12,GROUND-11]],'#937046',5);if(lit){for(let i=0;i<4;i++){const flicker=Math.sin(time*(6+i)+i)*4;poly([[x-12+i*3,GROUND-6],[x-11+i*5,GROUND-24-flicker],[x-8+i*4,GROUND-47+flicker],[x+3+i*3,GROUND-18],[x+12-i*3,GROUND-6]],['#ad6238','#d99b4d','#edbf65','#f3d998'][i])}for(let i=0;i<9;i++){const age=(time*.42+i/9)%1;ctx.globalAlpha=(1-age)*.7;box(x+Math.sin(i*2+time)*age*28,GROUND-18-age*110,1.5,2,'#f4cf8c')}ctx.globalAlpha=1}box(x+39,GROUND-44,3,41,'#514e3b');poly([[x+42,GROUND-44],[x+65,GROUND-40],[x+60,GROUND-24],[x+42,GROUND-29]],'#8a836044');line([[x+43,GROUND-42],[x+62,GROUND-39]],'#b4ae7980',1)}
function drawSanctuary(){if(cam+VW<6790)return;for(const wx of [6850,7800]){const x=wx-cam;box(x-12,GROUND-225,24,225,'#4e4e43');box(x-20,GROUND-230,40,11,'#77715c');box(x-17,GROUND-218,34,7,'#333f36');for(let i=0;i<6;i++)line([[x-11,GROUND-190+i*30],[x+11,GROUND-191+i*30]],'#2b3934',2);if(boss.active&&!boss.dead){glow(x,GROUND-75,95,'#d18f5d18');line([[x,GROUND-200],[x+Math.sin(time*5)*7,GROUND-140],[x-4,GROUND-80],[x,GROUND]],'#c7a56b77',2)}}const x=7760-cam;glow(x,GROUND-85,180,boss.dead?'#cce7ad30':'#b0659020');poly([[x-31,GROUND],[x-28,GROUND-118],[x-8,GROUND-153],[x+18,GROUND-147],[x+31,GROUND-119],[x+26,GROUND]],'#465248');poly([[x-8,GROUND-153],[x-2,GROUND-10],[x+26,GROUND],[x+31,GROUND-119],[x+18,GROUND-147]],'#33423a');line([[x-1,GROUND-126],[x-13,GROUND-92],[x+2,GROUND-59],[x+13,GROUND-91],[x-1,GROUND-126],[x-1,GROUND-40]],boss.dead?'#d8df9f':'#b588a3',2);if(boss.active&&!boss.dead){ctx.globalAlpha=.2+Math.sin(time*4)*.1;line([[6860-cam,GROUND],[6860-cam,GROUND-130]],'#e7bf7d',9);ctx.globalAlpha=1}}

// Pixel character rig based on the supplied reference: brown hair, grey jacket,
// light shirt, patched trousers and heavy boots. Limbs have independent joints.
// A fresh transparent surface for every actor and every frame prevents trails
// and keeps dash snapshots independent of the live protagonist.
const sprite=document.createElement('canvas');sprite.width=256;sprite.height=192;
const sp=sprite.getContext('2d',{willReadFrequently:true});
function pixelRect(g,x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),w,h)}
function pixelStroke(g,points,color,width){g.strokeStyle=color;g.lineWidth=width;g.lineCap='square';g.lineJoin='miter';g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.stroke()}
function limbJoint(root,end,a,b,bend=1){
 const dx=end.x-root.x,dy=end.y-root.y,raw=Math.hypot(dx,dy),d=clamp(raw,.01,a+b-.01);
 const angle=Math.atan2(dy,dx),offset=Math.acos(clamp((a*a+d*d-b*b)/(2*a*d),-1,1))*bend;
 return{x:root.x+Math.cos(angle+offset)*a,y:root.y+Math.sin(angle+offset)*a};
}
function drawLeg(g,hip,foot,front){
 const knee=limbJoint(hip,foot,13,13,-1),pants=front?'#62513f':'#403c34';
 pixelStroke(g,[[hip.x,hip.y],[knee.x,knee.y],[foot.x,foot.y-2]],'#1c1c19',8);
 pixelStroke(g,[[hip.x,hip.y],[knee.x,knee.y],[foot.x,foot.y-2]],pants,5);
 pixelRect(g,knee.x-2,knee.y-2,4,4,front?'#b18c66':'#7a6850');
 pixelRect(g,foot.x-3,foot.y-5,8,5,'#28251f');pixelRect(g,foot.x-2,foot.y-4,7,2,front?'#8a7455':'#685c47');
 pixelRect(g,foot.x-3,foot.y,10,2,'#141d1c');pixelRect(g,foot.x+2,foot.y-1,5,1,'#ad9671');
}
function gaitFoot(m,offset){
 const phase=((m.gait/(Math.PI*2)+offset)%1+1)%1,support=lerp(.44,.37,m.run),reach=lerp(14,16.3,m.run);
 if(phase<support)return{x:lerp(reach,-reach,phase/support)*m.move,y:0};
 const t=(phase-support)/(1-support);return{x:lerp(-reach,reach,ease(t))*m.move,y:-Math.sin(t*Math.PI)*lerp(7,13,m.run)*m.move};
}
function characterPose(p){
 const m=p.motion||motionDefaults(),kind=animationState(p),a=attackSample(p);
 let back=gaitFoot(m,.5),front=gaitFoot(m,0),hipY=-21,hipX=0,lean=m.lean;
 const land=clamp(p.land/.18,0,1);
 if(!p.ground){const ascent=clamp(-p.vy/625,0,1),fall=clamp(p.vy/750,0,1);back={x:lerp(-7,-12,ascent)-fall*3,y:lerp(-2,-13,ascent)-fall*2};front={x:lerp(8,11,ascent)+fall*2,y:-5+fall*3};hipY=-24+ascent*3-fall*1.8}
 else if(m.move>.01){hipY+=Math.cos(m.gait*2)*1.2*m.move+m.run*2}
 hipY+=land*4;
 if(kind==='dash'){const push=Math.sin(clamp(1-p.dash/.19,0,1)*Math.PI);hipY=-19+push*2;hipX=4+push;back={x:-15-push*3,y:-1};front={x:9,y:-5-push*3};lean=.2+push*.13}
 if(kind==='hurt'){const recoil=ease(p.hurt/.34);hipX=-3*recoil;hipY+=2*recoil;lean=-.18*recoil}
 if(kind==='sword'){hipX+=Math.sin(a.t*Math.PI)*3;hipY+=Math.sin(a.t*Math.PI)*1.5;lean+=(p.combo===1?-.08:.08)*Math.sin(a.t*Math.PI)}
 if(kind==='harvest'){hipY+=2;lean+=.1}
 return{m,kind,a,back:{x:back.x-4,y:back.y-1},front:{x:front.x+3,y:front.y-1},hipX,hipY,lean};
}
function drawArm(g,shoulder,hand,armor,front){
 const elbow=limbJoint(shoulder,hand,11,12,front?1:-1);
 pixelStroke(g,[[shoulder.x,shoulder.y],[elbow.x,elbow.y],[hand.x,hand.y]],'#1d211e',8);
 pixelStroke(g,[[shoulder.x,shoulder.y],[elbow.x,elbow.y],[hand.x,hand.y-2]],armor?'#7b897e':front?'#767565':'#4c5047',5);
 pixelRect(g,elbow.x-2,elbow.y-2,4,3,'#99967b');pixelRect(g,hand.x-2,hand.y-3,5,6,'#c38c66');pixelRect(g,hand.x,hand.y-2,3,3,'#e3b58a');
}
function drawHairAndFace(g,clock,headTilt){
 g.save();g.translate(0,headTilt);
 pixelRect(g,-8,-56,18,18,'#211a17');pixelRect(g,-6,-53,16,14,'#ba8764');pixelRect(g,-4,-53,13,11,'#d5a480');pixelRect(g,7,-49,5,7,'#d6a17d');pixelRect(g,-7,-48,4,7,'#a77858');
 const blink=clock%5.1>4.96;pixelRect(g,1,-50,7,blink?2:6,'#251d1a');if(!blink){pixelRect(g,2,-50,3,5,'#eee9d7');pixelRect(g,6,-50,2,5,'#0e1719')}pixelRect(g,9,-45,3,2,'#edc29d');
 const hair=[[-12,-58,22,7,'#241b18'],[-9,-62,17,7,'#38251c'],[-3,-65,9,5,'#493025'],[6,-60,8,6,'#2e211a'],[-15,-54,10,7,'#32241d'],[-12,-57,8,4,'#5f3f2c'],[-8,-61,6,4,'#745039'],[-1,-62,5,4,'#80583f'],[4,-58,5,4,'#68452f'],[10,-57,5,3,'#563a28'],[-10,-52,6,7,'#493025'],[-4,-55,6,7,'#593a28'],[2,-55,5,5,'#79513a'],[-13,-50,5,4,'#211d19']];
 for(const r of hair)pixelRect(g,...r);g.restore();
}
function drawActorWeapon(g,p,pose,hand){
 const {kind,a}=pose;if(kind==='death'||kind==='hurt'||kind==='dash')return;if(expansion?.drawTool(g,p,pose,hand))return;
 g.save();g.translate(hand.x,hand.y);
 if(p.weapon===2){
   g.rotate(p.aimAngle||0);g.strokeStyle='#ba9d6b';g.lineWidth=3;g.beginPath();g.moveTo(5,-19);g.quadraticCurveTo(25,0,5,19);g.stroke();
   const pull=kind==='bow'?a.draw:0;pixelStroke(g,[[5,-19],[-pull*13,0],[5,19]],'#d4d5b5',1);
   if(kind==='bow'&&p.pendingShot){pixelStroke(g,[[-12-pull*13,0],[19-pull*13,0]],'#d8d4b0',1);pixelStroke(g,[[15-pull*13,-3],[20-pull*13,0],[15-pull*13,3]],'#cbd9c4',1)}
 }else if(p.weapon===1){
   g.rotate(kind==='spear'?-.04:-1.12);pixelStroke(g,[[-40,0],[66,0]],'#6f5537',4);pixelStroke(g,[[-38,-1],[66,-1]],'#bda16d',1);
   g.fillStyle='#cbd7c7';g.beginPath();g.moveTo(64,-5);g.lineTo(80,0);g.lineTo(64,5);g.closePath();g.fill();pixelStroke(g,[[64,0],[77,0]],'#f4edce',1);
 }else if(kind==='sword'||kind==='harvest'){
   const angle=kind==='harvest'?-1.8+ease(1-p.harvest/.24)*2.6:a.angle;g.rotate(angle);
   const length=p.combo===2?65:p.gear.sword?54:44;
   pixelStroke(g,[[0,0],[length,0]],'#293d39',7);pixelStroke(g,[[8,0],[length,0]],p.gear.sword?'#c5d6cb':'#a8b6a3',5);pixelStroke(g,[[9,-2],[length-1,-2]],'#f4edce',1);
   pixelStroke(g,[[7,-6],[7,6]],'#b49a62',3);pixelStroke(g,[[-3,0],[6,0]],'#776043',3);
 }else{
   // A sheathed blade rests at the hip instead of intersecting the ground.
   pixelStroke(g,[[-9,-2],[-21,16]],'#34372f',5);pixelStroke(g,[[-9,-2],[-21,16]],'#7b8065',2);pixelStroke(g,[[-13,-5],[-5,0]],'#b29c69',2);
 }
 g.restore();
}
function drawCharacter(p,alpha=1,afterimage=false){
 const pose=characterPose(p),{m,kind,a}=pose;
 // Reset everything, including the complete enlarged sprite surface.
 sp.setTransform(1,0,0,1,0,0);sp.globalAlpha=1;sp.globalCompositeOperation='source-over';
 sp.clearRect(0,0,sprite.width,sprite.height);sp.imageSmoothingEnabled=false;
 sp.save();sp.translate(128,128);sp.scale(p.face,1);
 if(kind==='death'){const t=ease(p.deadTime/.85);sp.translate(0,1);sp.rotate(t*Math.PI*.49);sp.translate(0,-t*4)}
 drawLeg(sp,{x:-5+pose.hipX,y:pose.hipY},pose.back,false);
 drawLeg(sp,{x:5+pose.hipX,y:pose.hipY},pose.front,true);
 sp.save();sp.translate(pose.hipX,pose.hipY+21);sp.rotate(pose.lean);
 const breathe=Math.sin(m.clock*2.7)*.55,armSwing=Math.sin(m.gait)*m.move*(.7+m.run*.25);
 let hand={x:12-armSwing*5,y:-23+Math.abs(armSwing)*2},backHand={x:-10+armSwing*6,y:-24};
 if(!p.ground){const brace=clamp(p.vy/750,0,1);hand={x:14,y:-28-brace*4};backHand={x:-13,y:-30-brace*3}}
 if(kind==='sword'){hand={x:10+Math.sin(a.t*Math.PI)*8,y:-29-Math.cos(a.angle)*5};backHand={x:-12,y:-27}}
 if(kind==='spear'){hand={x:17+a.thrust*.45,y:-30};backHand={x:-7+a.thrust*.35,y:-28}}
 if(kind==='bow'){hand={x:23,y:-31};backHand={x:16-a.draw*14,y:-31}}
 if(kind==='dash'){hand={x:-2,y:-25};backHand={x:-15,y:-34}}
 if(kind==='hurt'){const recoil=ease(p.hurt/.34);hand={x:lerp(hand.x,7,recoil),y:lerp(hand.y,-30,recoil)};backHand={x:lerp(backHand.x,-15,recoil),y:lerp(backHand.y,-27,recoil)}}
 if(kind==='harvest')hand={x:14,y:-32};
 const skill=p===player?expansion?.progress.skill:p.skill;
 if(skill){const charge=skill.time<.42;hand=charge?{x:-7,y:-44}:{x:31,y:-27};backHand=charge?{x:-13,y:-37}:{x:10,y:-34};}
 drawArm(sp,{x:-8,y:-36+breathe},backHand,p.gear.armor,false);
 pixelRect(sp,-10,-39+breathe,20,20,'#211f1c');pixelRect(sp,-9,-38+breathe,7,18,p.gear.armor?'#6f7973':'#5a5a4f');pixelRect(sp,3,-38+breathe,6,18,p.gear.armor?'#626f6b':'#444941');
 pixelRect(sp,-2,-36+breathe,6,15,'#a59073');pixelRect(sp,-1,-35+breathe,4,13,'#c0ab8a');pixelRect(sp,-9,-37+breathe,7,4,'#8e8b77');pixelRect(sp,-6,-34+breathe,3,10,'#363b35');pixelRect(sp,4,-36+breathe,4,3,'#8a8c79');
 pixelRect(sp,-10,-26,6,3,'#7b7761');pixelRect(sp,4,-23,5,3,'#87816b');pixelRect(sp,-8,-21,17,5,'#302c25');pixelRect(sp,-8,-20,17,2,'#7c684b');pixelRect(sp,0,-21,3,4,'#bdab7d');
 drawHairAndFace(sp,m.clock,breathe*.5);
 expansion?.drawCostume(sp,p,pose,breathe);drawActorWeapon(sp,p,pose,hand);drawArm(sp,{x:8,y:-35+breathe},hand,p.gear.armor,true);
 sp.restore();sp.restore();
 if(afterimage){sp.globalCompositeOperation='source-atop';sp.fillStyle='#81b4ae';sp.fillRect(0,0,sprite.width,sprite.height);sp.globalCompositeOperation='source-over'}
 const x=p.x+14-cam-128,y=p.y+p.h-128;
 ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sprite,Math.round(x*dpr*scale)/(dpr*scale),Math.round(y*dpr*scale)/(dpr*scale));ctx.restore();
 if(kind==='sword'&&a.active&&!afterimage){
   const cx=p.x+14-cam,cy=p.y+25,dir=p.combo===1?-1:1,r=p.combo===2?77:p.gear.sword?65:55;
   ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(p.face,1);
   ctx.strokeStyle='#e9dab449';ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,0,r,a.angle-dir*.7,a.angle,dir<0);ctx.stroke();
   ctx.strokeStyle='#f6ecc9b0';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r+4,a.angle-dir*.52,a.angle,dir<0);ctx.stroke();ctx.restore();
 }
}

function advanceEnemyMotion(e,dt,previousX,previousMode){
 e.motionClock=(e.motionClock||0)+dt;
 if(previousMode!==e.mode){e.modeElapsed=0;e.modeDuration=Math.max(.01,e.timer)}else e.modeElapsed=(e.modeElapsed||0)+dt;
 const velocity=(e.x-previousX)/dt;
 e.moveBlend=lerp(e.moveBlend||0,Math.abs(velocity)>8?1:0,1-Math.exp(-dt*15));
 e.gait=(e.gait||0)+Math.abs(e.x-previousX)/(e.type==='wolf'?66:58)*Math.PI*2;
}
function updateEnemy(e,dt){if(expansion?.online){e.anim+=dt;e.motionClock=(e.motionClock||0)+dt;e.modeElapsed=(e.modeElapsed||0)+dt;return;}const x=e.x,mode=e.mode;updateEnemyLogic(e,dt);advanceEnemyMotion(e,dt,x,mode)}
function updateBoss(dt){
 if(expansion?.online){boss.anim+=dt;boss.modeElapsed=(boss.modeElapsed||0)+dt;return;}
 const x=boss.x,mode=boss.mode;updateBossLogic(dt);advanceEnemyMotion(boss,dt,x,mode);
 if(boss.dead)boss.death=(boss.death||0)+dt;
}
function enemyCharge(e){return worldAI.charge(e)}
function enemyStrikeBox(e){return worldAI.strike(e)}
function enemyWeaponAngle(e){return worldAI.angle(e)}
function drawEnemy(e){
 const x=e.x-cam;if(x<-120||x>VW+120||e.dead&&e.death>.75)return;
 const charge=enemyCharge(e),phase=e.gait||0,move=e.moveBlend||0,clock=e.motionClock||e.anim;
 ctx.save();
 if(e.dead){const t=ease(e.death/.65);ctx.globalAlpha=1-t;ctx.translate(x+e.w/2,e.y+e.h);ctx.rotate(t*e.face*1.4);ctx.translate(-x-e.w/2,-e.y-e.h)}
 const flash=e.hit>0;ellipse(x+e.w/2,e.y+e.h+2,e.w*.6,4,'#05161855');
 if(e.type==='wolf'){
   ctx.save();ctx.translate(x+24,e.y+32);ctx.scale(e.face,1);
   const crouch=charge*5,flight=e.mode==='attack'?Math.sin(clamp(e.modeElapsed/.42,0,1)*Math.PI)*5:0,bob=Math.cos(phase*2)*move;
   const bodyY=-18+crouch-flight+bob;
   // Two pairs of legs, with a planted stance and a lifted recovery step.
   for(let j=0;j<4;j++){
     const a=phase+(j===0||j===3?0:Math.PI),hip={x:j<2?-15:14,y:bodyY+5};
     let foot={x:hip.x+Math.cos(a)*8*move,y:-1-Math.max(0,Math.sin(a))*8*move};
     if(e.mode==='windup')foot={x:j<2?-20:19,y:-1};
     if(e.mode==='attack')foot={x:j<2?-25:26,y:-3-flight*.5};
     const knee=limbJoint(hip,foot,10,12,j<2?-1:1);
     line([[hip.x,hip.y],[knee.x,knee.y],[foot.x,foot.y]],'#20352e',5);
     line([[hip.x,hip.y],[knee.x,knee.y],[foot.x,foot.y]],j%2?'#566b53':'#3d5143',3);
     line([[foot.x-2,foot.y],[foot.x+4,foot.y]],'#899278',2);
   }
   poly([[-25,bodyY],[-15,bodyY-12],[7,bodyY-8],[20,bodyY+3],[12,bodyY+10],[-15,bodyY+11]],flash?'#eee2bd':'#5a6c57');
   poly([[-24,bodyY],[-37,bodyY-7+Math.sin(clock*4)*2],[-29,bodyY+7],[-18,bodyY+10]],'#354c3d');
   poly([[-10,bodyY-10],[2,bodyY-9],[15,bodyY],[-6,bodyY+2]],'#829075');
   const hy=bodyY-charge*2;
   poly([[8,hy-5],[13,hy-17],[20,hy-11],[26,hy-11],[36,hy+2],[30,hy+8],[12,hy+4]],flash?'#faf0cc':'#859073');
   poly([[14,hy-15],[18,hy-7],[23,hy-9]],'#302e29');box(25,hy-5,5,3,charge?'#ffd391':'#e0bf7f');box(31,hy+1,7,3,'#1a2725');
   line([[28,hy+6],[35,hy+6+charge*3]],'#d2cbaa',2);ctx.restore();
 }else if(e.type==='crawler'){
   const stretch=e.mode==='attack'?.85:1+charge*.28,cy=e.y+23+charge*3;
   for(let j=0;j<4;j++){const lift=Math.sin(phase+j*Math.PI)*move*3;line([[x+3+j*8,cy],[x-3+j*11,cy+9-lift]],'#314c3b',3)}
   ellipse(x+16,cy,22*stretch,12/stretch,flash?'#e4dab5':'#536e54');ellipse(x+16,cy-8,16*stretch,13/stretch,flash?'#e4dab5':'#819366');
   for(let j=0;j<5;j++)poly([[x+j*7,cy-16],[x+3+j*7,cy-25-j%2*5],[x+7+j*7,cy-13]],'#a4ad7a');
   box(x+8,cy-6,4,3,charge?'#ffe0a5':'#d4b87b');box(x+23,cy-6,4,3,charge?'#ffe0a5':'#d4b87b');
 }else if(e.type==='wisp'){
   glow(x+16,e.y+18,65+charge*35,flash?'#e2e6c552':'#8fcfc12b');
   for(let j=3;j>=0;j--)ellipse(x+16+Math.sin(clock*4-j)*j*3,e.y+21+j*9,11-j*2.5,9-j,'#88b8a5'+['aa','77','44','22'][j]);
   ellipse(x+16,e.y+15,12-charge*3,16+charge*4,flash?'#f3e8bb':'#b1d2b9');
   poly([[x+7,e.y+7],[x+25,e.y+7],[x+24,e.y+23],[x+10,e.y+25]],'#3b6d65');box(x+10,e.y+13,4,3,'#e2e3a4');box(x+20,e.y+13,4,3,'#e2e3a4');
   if(charge)ellipse(x+16,e.y+30,2+charge*4,2+charge*4,'#c9ead2');
 }else{
   ctx.save();ctx.translate(x+17,e.y+60);ctx.scale(e.face,1);
   const footA={x:-5+Math.cos(phase)*10*move,y:-1-Math.max(0,Math.sin(phase))*7*move};
   const footB={x:5-Math.cos(phase)*10*move,y:-1-Math.max(0,-Math.sin(phase))*7*move};
   poly([[-15,-43],[-22,-7+Math.sin(clock*3)*2],[1,-1],[15,-15],[10,-46]],'#343e36');
   drawLeg(ctx,{x:-5,y:-21+charge*2},footA,false);drawLeg(ctx,{x:5,y:-21+charge*2},footB,true);
   ctx.save();ctx.translate(0,charge*2+Math.sin(phase*2)*move*.6);ctx.rotate(charge*-.07);
   poly([[-14,-47],[12,-46],[15,-26],[2,-18],[-13,-27]],flash?'#efe0b5':'#7b8069');poly([[-13,-43],[2,-35],[13,-43],[12,-30],[0,-27]],'#434d40');
   box(-11,-59,22,17,flash?'#f9eac5':'#677566');poly([[-15,-59],[-13,-65],[13,-62],[16,-55]],'#849078');box(-6,-52,19,3,'#172d2a');box(3,-51,8,2,charge?'#ffd49a':'#d3b475');
   ctx.save();ctx.translate(13,-34);ctx.rotate(enemyWeaponAngle(e));line([[0,6],[0,-43]],'#c4c7a9',6);line([[-8,-8],[8,-8]],'#a49061',3);line([[0,-10],[0,-42]],'#e0dfbb',1);ctx.restore();ctx.restore();ctx.restore();
 }
 if(e.mode==='windup'&&!e.dead){glow(x+e.w/2,e.y-13,26,'#e5b77033');line([[x+e.w/2-5,e.y-16],[x+e.w/2,e.y-23],[x+e.w/2+5,e.y-16],[x+e.w/2,e.y-9],[x+e.w/2-5,e.y-16]],'#edc27f',1.5)}
 if(e.hp<e.maxHp&&!e.dead){box(x-3,e.y-14,e.w+6,3,'#0c2421');box(x-3,e.y-14,(e.w+6)*Math.max(0,e.hp/e.maxHp),2,'#bd9d6e')}
 ctx.restore();
}
function drawBoss(){
 const b=boss,x=b.x-cam;if(x<-230||x>VW+230)return;
 if(b.dead&&b.death>=1){glow(x+40,GROUND-13,90,'#a5b99e18');poly([[x,GROUND-5],[x+20,GROUND-29],[x+57,GROUND-27],[x+83,GROUND-7]],'#5c6553');box(x+23,GROUND-31,32,8,'#858975');return}
 const charge=enemyCharge(b),clock=b.motionClock||b.anim,step=Math.sin(b.gait||0)*(b.moveBlend||0)*10;
 ellipse(x+40,GROUND+2,65,10,'#091a1b77');
 if(b.mode==='windup'){const range=b.pattern%3===0?240:b.pattern%3===1?330:180;ctx.save();ctx.globalAlpha=.13+charge*.12;box((b.face<0?x-range:x+40),GROUND-6,range,5,'#f5b16b');ctx.restore();glow(x+40,b.y+35,120,'#e7ad6333')}
 if(b.mode==='phase'){glow(x+40,b.y+50,230,'#cd7c6940');ctx.strokeStyle='#e7b183'+Math.round(clamp(b.phasePulse/2.1,0,1)*120).toString(16).padStart(2,'0');ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+40,b.y+60,(2.1-b.phasePulse)*140,0,Math.PI*2);ctx.stroke()}
 ctx.save();ctx.translate(x+40,GROUND);ctx.scale(b.face,1);
 if(b.dead){const t=ease((b.death||0)/1);ctx.translate(0,t*4);ctx.rotate(t*.95);ctx.scale(1,1-t*.55);ctx.globalAlpha=1-t*.6}
 const flash=b.hit>0,stone=flash?'#f3dfac':b.phase===2?'#8b7767':'#778474';
 poly([[-38,-100],[-58,-9+Math.sin(clock*2)*3],[-28,-1],[0,-17],[34,-5],[41,-90]],b.phase===2?'#4e3a3b':'#30493f');
 for(let i=0;i<3;i++)line([[-33+i*21,-88],[-36+i*25,-14]],'#102e2b66',3);
 line([[-19,-42],[-27+step,-7]],stone,22);line([[20,-42],[27-step,-7]],stone,22);box(-40+step,-12,32,11,'#44544a');box(14-step,-12,32,11,'#44544a');
 ctx.save();ctx.translate(0,charge*5+Math.sin(clock*1.7)*.8);ctx.rotate(charge*-.06);
 poly([[-33,-102],[31,-105],[38,-62],[10,-43],[-27,-57]],stone);poly([[-27,-97],[3,-86],[29,-99],[23,-67],[1,-59],[-26,-71]],flash?'#fff0c3':'#47594d');
 poly([[-43,-100],[-25,-115],[-14,-99],[-22,-77],[-44,-83]],stone);poly([[21,-108],[44,-103],[47,-80],[25,-78],[12,-94]],stone);box(-22,-130,45,30,stone);
 poly([[-26,-131],[-35,-154],[-15,-143],[-2,-150],[9,-142],[30,-153],[24,-129]],'#a3a285');box(-15,-121,33,6,'#18312c');box(-11,-120,10,3,b.phase===2?'#f9bc89':'#e0cb85');box(8,-120,10,3,b.phase===2?'#f9bc89':'#e0cb85');line([[-8,-108],[12,-108]],'#293f36',3);
 ctx.save();ctx.translate(36,-78);ctx.rotate(enemyWeaponAngle(b));line([[0,14],[0,-75]],'#8a7754',8);poly([[-7,-26],[-7,-92],[5,-104],[11,-89],[10,-26]],flash?'#fff2c6':'#b0b49a');box(-18,-28,42,6,'#a49b6d');line([[-3,-89],[-3,-32]],'#e4d8a9',2);ctx.restore();ctx.restore();ctx.restore();
}

function drawEffects(){for(const q of projectiles){const x=q.x-cam;if(q.kind==='arrow'){const a=Math.atan2(q.vy,q.vx);ctx.save();ctx.translate(x,q.y);ctx.rotate(a);line([[-16,0],[12,0]],'#d1c29a',2);poly([[8,-3],[17,0],[8,3]],'#dfe5c5');line([[-13,-4],[-8,0],[-13,4]],'#97a489',2);ctx.restore()}else if(q.kind==='wave'){glow(x,q.y,55,'#ebaa6825');poly([[x-20,q.y+17],[x-10,q.y-10],[x,q.y-23],[x+10,q.y-8],[x+20,q.y+17]],'#c69f6a');line([[x-10,q.y+9],[x,q.y-17],[x+7,q.y+8]],'#f2d299',2)}else{glow(x,q.y,38,q.kind==='wisp'?'#8ed9d333':'#f1a06c44');ellipse(x,q.y,6,6,q.kind==='wisp'?'#c1e6cf':'#edc28a')}}for(const q of particles){ctx.globalAlpha=clamp(q.life/q.max,0,1);box(q.x-cam,q.y,q.size,q.size,q.color)}ctx.globalAlpha=1;ctx.font='bold 13px Segoe UI';ctx.textAlign='center';for(const t of texts){ctx.globalAlpha=clamp(t.life*2,0,1);ctx.fillStyle='#0c1b19';ctx.fillText(t.label,t.x-cam+1,t.y+1);ctx.fillStyle=t.color;ctx.fillText(t.label,t.x-cam,t.y)}ctx.globalAlpha=1;ctx.textAlign='left'}
function render(){ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);ctx.clearRect(0,0,VW,VH);ctx.save();if(shake>0&&!reduced)ctx.translate(rand(-shake,shake)*.4,rand(-shake,shake)*.4);if(expansion?.inCave)expansion.drawCave(ctx,cam,VW,VH,time);else{drawBackground();drawRuins();drawGround();for(const c of camps)drawCamp(c.x);drawSanctuary();}for(const n of nodes)drawNode(n);expansion?.drawWorld(ctx,cam,VW,VH,time);for(const e of enemies)drawEnemy(e);drawBoss();for(const g of ghosts)drawCharacter(g.actor,clamp(g.life/.14,0,1)*.14,true);if(state==='menu'){drawCamp(cam+VW*.65);drawCharacter({...player,x:cam+VW*.65-58,y:GROUND-54,face:1,ground:true,vx:0,atk:0,dash:0,hurt:0,hp:100,land:0,motion:{...motionDefaults(),clock:time}})}else{if(player.inv>0&&Math.floor(player.inv*16)%2===0)ctx.globalAlpha=.55;drawCharacter(player,player.inv>0&&Math.floor(player.inv*16)%2===0?.55:1);ctx.globalAlpha=1}drawEffects();
// Foreground foliage frames the landscape, while leaving the combat area clear.
for(let i=0;i<9;i++){const x=i*206-(cam*.95%206),gy=VH-3;poly([[x-28,gy],[x-12,gy-32],[x-17,gy-52],[x+2,gy-26],[x+13,gy-38],[x+15,gy-9],[x+28,gy]],'#0a2122aa')}ctx.restore();const v=ctx.createRadialGradient(VW*.5,VH*.45,VW*.16,VW*.5,VH*.5,VW*.67);v.addColorStop(0,'#030d1000');v.addColorStop(1,'#020a0f99');ctx.fillStyle=v;ctx.fillRect(0,0,VW,VH);const shade=ctx.createLinearGradient(0,0,0,170);shade.addColorStop(0,'#04111670');shade.addColorStop(1,'#04111600');ctx.fillStyle=shade;ctx.fillRect(0,0,VW,170);expansion?.afterRender(ctx,cam,VW,VH,time)}

function resize(){const r=canvas.getBoundingClientRect();screenW=Math.max(1,r.width);screenH=Math.max(1,r.height);dpr=Math.min(window.devicePixelRatio||1,2);VH=810;scale=screenH/VH;VW=screenW/scale;canvas.width=Math.round(screenW*dpr);canvas.height=Math.round(screenH*dpr);if(player)cam=clamp(player.x-VW*.36,0,Math.max(0,WORLD-VW))}
function press(code,repeat=false){if(expansion?.key(code,repeat))return;if(state==='play'){if(code==='Space'&&!repeat){jumpBuffer=.13;player.jumpHeld=true}if(code==='KeyJ'&&!repeat)attack();if((code==='ShiftLeft'||code==='ShiftRight'||code==='KeyK')&&!repeat)dash();if(code==='KeyE'&&!repeat)interact();if(code==='KeyQ'&&!repeat)usePotion();if(/^Digit[123]$/.test(code)&&!repeat)equip(+code.slice(-1)-1)}if(repeat)return;if(code==='Escape'){if(['inventory','map','help'].includes(state))closeModal(state);else pause()}if(code==='KeyI'&&(state==='play'||state==='inventory'))openModal('inventory');if(code==='KeyM')openModal('map')}
const gameCodes=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyJ','KeyK','KeyE','KeyQ','KeyI','KeyM','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3','KeyB','KeyF','KeyR','KeyT','KeyV','KeyX'];
window.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey)return;if(gameCodes.includes(e.code)&&state==='play')e.preventDefault();keys[e.code]=true;press(e.code,e.repeat)});
window.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Space'){player.jumpHeld=false;if(player.vy<-260)player.vy=-260}});
window.addEventListener('blur',()=>{keys={};if(state==='play')pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause()});
window.addEventListener('pagehide',save);
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)/scale;pointer.y=(e.clientY-r.top)/scale;pointer.aim=true});
canvas.addEventListener('pointerdown',e=>{if(state!=='play'||e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});attack()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('[data-touch]').forEach(b=>{const code=b.dataset.touch;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[code]=true;pointer.aim=false;press(code)});const release=()=>{keys[code]=false;if(code==='Space'){player.jumpHeld=false;if(player.vy<-260)player.vy=-260}};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release)});
document.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>equip(+b.dataset.slot));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$('inventoryButton').onclick=()=>{if(state==='play'||state==='inventory')openModal('inventory')};$('potionButton').onclick=usePotion;$('harvestButton').onclick=interact;$('mapButton').onclick=()=>openModal('map');$('helpButton').onclick=()=>openModal('help');$('pauseButton').onclick=pause;$('mapHelp').onclick=()=>openModal('help');
$('soundButton').onclick=toggleAudio;
$('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('shell').requestFullscreen()}catch{say('Este navegador no permite pantalla completa. Puedes usar F11.')}};
// Keep keyboard navigation within the currently open dialog.
document.addEventListener('keydown',e=>{if(e.code!=='Tab'||!['inventory','map','help'].includes(state))return;const buttons=[...$(state).querySelectorAll('button:not(:disabled)')];const first=buttons[0],final=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();final.focus()}else if(!e.shiftKey&&document.activeElement===final){e.preventDefault();first.focus()}});
function loop(stamp){
 if(!last){last=stamp;render();requestAnimationFrame(loop);return}
 const dt=clamp((stamp-last)/1000,0,.1);last=stamp;time+=dt;
 const step=1/120;accumulator=Math.min(.1,accumulator+dt);
 const count=Math.min(12,Math.floor((accumulator+1e-9)/step));
 for(let i=0;i<count;i++)tick(step);
 accumulator=Math.max(0,accumulator-count*step);
 render();requestAnimationFrame(loop);
}
const worldAI=createWorldAlgorithms(()=>({player,boss,groundAt,difficulty,damagePlayer,sound,burst,say,updateHUD,get projectiles(){return projectiles},set projectiles(value){projectiles=value},get shake(){return shake},set shake(value){shake=value}}));
expansion=new Expansion({
 get player(){return player},get state(){return state},get kills(){return kills},get checkpoint(){return checkpoint},set checkpoint(v){checkpoint=v},
 get nodes(){return nodes},set nodes(v){nodes=v},get enemies(){return enemies},set enemies(v){enemies=v},get boss(){return boss},set boss(v){boss=v},get projectiles(){return projectiles},set projectiles(v){projectiles=v},
 say,sound,burst,save,load,showMenu,setState,pause,initAudio,updateHUD,damagePlayer,damageEnemy,damageBoss,spawnEnemy,makePlayer,resize,treeShape,drawCharacter,win,
 syncAudio:syncForestAmbience,startOnline:()=>startGame(false),
 preview(selection,target,clock){const actor={...makePlayer(),characterId:selection.characterId,appearance:selection.appearance,motion:{...motionDefaults(),clock}};drawCharacter(actor);const targetContext=target.getContext('2d');targetContext.clearRect(0,0,target.width,target.height);targetContext.imageSmoothingEnabled=false;targetContext.drawImage(sprite,0,0);}
},expansionData);
player=makePlayer();makeWorld();resize();new ResizeObserver(resize).observe($('stage'));showMenu();updateHUD();requestAnimationFrame(loop);
// Optional, read-only telemetry for diagnosing a local play session.
window.umbra={get status(){return{state,zone,checkpoint,kills,deaths,playTime,position:{x:player.x,y:player.y},velocity:{x:player.vx,y:player.vy},animation:animationState(player),grounded:player.ground,trailCount:ghosts.length,health:player.hp,stamina:player.stamina,boss:{active:boss.active,dead:boss.dead,hp:boss.hp,phase:boss.phase,mode:boss.mode},enemiesAlive:enemies.filter(e=>!e.dead).length,resources:{wood:player.wood,ore:player.ore,shard:player.shard},weapon:player.weapon,gear:{...player.gear},expansion:{characterId:expansion.progress.characterId,realm:expansion.progress.realm,inventory:{...expansion.progress.inventory},tools:{...expansion.progress.tools},armor:{...expansion.progress.armor},buffs:{...expansion.progress.buffs},worldTime:expansion.world.time,treesFelled:expansion.world.trees.filter(t=>t.fallen).length,blocksMined:expansion.world.blocks.filter(b=>!b.alive).length,connection:expansion.status,room:expansion.network.options?.room,players:expansion.remotes.size+1}}}};
})();
