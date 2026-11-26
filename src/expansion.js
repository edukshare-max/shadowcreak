import { character, createProgress, migrateProgress, createExpansionWorld, stats, catalog, resourceAmount, craftingState, applyAction, advanceWorld, advanceProgress, clamp, surface } from './expansion-rules.js';
import { RoomClient } from './room-client.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={wood:'Madera',ore:'Mineral original',shard:'Esencia',seed:'Semillas',herb:'Plantas medicinales'};
export class Expansion {
  constructor(api,data) {
    this.api=api;this.data=data;this.world=createExpansionWorld(data);this.progress=createProgress();this.selected={characterId:'wanderer',appearance:{outfit:'traveler',color:''}};this.remotes=new Map();this.messages=[];this.status='offline';this.cadence=0;this.companionClock=0;
    try{const saved=JSON.parse(localStorage.getItem('umbra.profile.v1'));if(saved){this.selected=migrateProgress(saved,data);}}catch{}
    this.panel=document.createElement('section');this.panel.id='expansion';this.panel.className='modal hidden';this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');this.panel.setAttribute('aria-label','Expansión de Umbra');document.getElementById('stage').append(this.panel);
    this.panel.addEventListener('click',e=>this.click(e));
    this.connection=document.createElement('div');this.connection.id='party-status';this.connection.hidden=true;document.getElementById('stage').append(this.connection);
    const button=document.createElement('button');button.className='secondary expansion-header';button.textContent='Diario · B';button.onclick=()=>this.open('progression');document.querySelector('.header-actions').prepend(button);
    this.network=new RoomClient(m=>this.message(m),status=>{this.status=status;if(this.online&&status!=='connected'&&this.api.state==='play')this.api.pause();this.hud();});
  }
  get online(){return this.network?.active||false;}
  get inCave(){return this.progress.realm!==surface;}
  get actor(){return this.api.player;}
  get sheet(){return stats(this.data,this.progress,this.actor);}
  get saveView(){if(!this.inCave||!this.surfaceWorld)return null;return {...this.surfaceWorld,player:{...this.actor,x:this.progress.returnX,y:this.progress.returnY}};}
  reset() {
    if(this.online)return;
    this.world=createExpansionWorld(this.data);this.progress=createProgress(this.selected.characterId,this.selected.appearance);this.surfaceWorld=null;this.decorate(true);
  }
  decorate(fresh=false){const p=this.actor,c=character(this.data,this.progress.characterId);p.characterId=c.id;p.appearance={...this.progress.appearance};p.maxHp=this.sheet.maxHp;p.hp=fresh?c.health:Math.min(p.maxHp,p.hp);}
  inventory(){const panel=document.querySelector('#inventory .modal-panel');if(!panel.querySelector('.advanced-forge-link')){const button=document.createElement('button');button.className='secondary advanced-forge-link';button.textContent='TALLER AVANZADO · PERSONAJE Y PROGRESIÓN · B';button.onclick=()=>{document.getElementById('inventory').classList.add('hidden');this.api.setState('play');this.open('progression');};panel.append(button);}}
  serialize(){if(this.inCave)this.storeCave();return {version:1,progress:this.progress,world:this.world,surfaceWorld:this.surfaceWorld};}
  restore(saved) {
    this.progress=migrateProgress(saved?.progress,this.data);this.world=createExpansionWorld(this.data);
    if(saved?.version===1&&saved.world?.version===1) for(const key of ['time','revision','trees','farms','blocks','chests','structures','drops','spirits','caves','nextId'])if(saved.world[key]!==undefined)this.world[key]=saved.world[key];
    this.surfaceWorld=saved?.surfaceWorld||null;this.decorate();if(this.inCave){const position=this.world.caves[this.progress.realm]?.position;this.activateCave(Number(this.progress.realm.slice(-1)));if(position){this.actor.x=clamp(position.x,20,1510);this.actor.y=clamp(position.y,80,572);}}this.hud();
  }
  menu() {
    const start=document.getElementById('start');if(!start)return;const original=start.onclick;start.onclick=()=>this.choose(original);
    const holder=document.createElement('div');holder.className='expansion-menu';holder.innerHTML='<button class="secondary" data-online>PARTIDA ONLINE</button><button class="secondary" data-profile>PERSONAJES Y VESTUARIO</button>';
    start.closest('.menu-content').append(holder);holder.querySelector('[data-online]').onclick=()=>this.open('online');holder.querySelector('[data-profile]').onclick=()=>this.choose();
  }
  shell(title,content,tabs=true) {
    this.panel.innerHTML=`<div class="modal-panel expansion-panel"><div class="modal-heading"><div><div class="eyebrow">UMBRA · SUPERVIVIENTES DEL UMBRAL</div><h2>${title}</h2></div><button class="icon-button" data-exp-close aria-label="Cerrar">×</button></div>${tabs?`<nav class="expansion-tabs">${[['progression','Equipo y taller'],['minerals','Minerales'],['potions','Alquimia'],['spirits','Espíritus'],['online','Online']].map(([id,name])=>`<button class="secondary ${this.tab===id?'selected':''}" data-tab="${id}">${name}</button>`).join('')}</nav>`:''}<div class="expansion-content">${content}</div><p class="expansion-notice" role="status" id="expansionNotice"></p></div>`;
    if(this.tab==='online'&&!this.previewing){const roster=document.createElement('div');roster.id='partyRoster';roster.className='sheet';this.panel.querySelector('.expansion-content').append(roster);this.renderRoster();}
  }
  renderRoster(){const roster=document.getElementById('partyRoster');if(roster)roster.innerHTML=this.online?`<b>Jugadores conectados</b><span>${esc(this.network.options?.name||'Tú')} · ${Math.ceil(this.actor.hp)}/${this.actor.maxHp}</span>`+[...this.remotes.values()].map(p=>`<span>${esc(p.name)} · ${Math.ceil(p.hp)}/${p.maxHp} · ${esc(p.realm)}</span>`).join(''):'<span>Sin jugadores conectados.</span>';}
  open(tab='progression') {if(['dying','dead','won'].includes(this.api.state))return;this.previous=this.panel.classList.contains('hidden')?this.api.state:this.previous;this.api.setState('expansion');this.panel.classList.remove('hidden');this.tab=tab;this.renderPanel();this.panel.querySelector('button')?.focus();}
  close(){this.panel.classList.add('hidden');this.confirm=null;this.previewing=null;this.api.setState(this.previous||'menu');if(this.api.state==='play')this.api.initAudio();}
  choose(confirm) {
    this.previous=this.api.state;this.confirm=confirm;this.previewing={characterId:this.selected.characterId,appearance:{...this.selected.appearance}};this.api.setState('characters');this.panel.classList.remove('hidden');this.renderCharacters();
  }
  renderCharacters() {
    const p=this.previewing,c=character(this.data,p.characterId),unlocked=this.progress.discovered.includes('hellstone')||this.api.kills>=10;
    this.shell('Elige tu superviviente',`<div class="character-layout"><div class="character-preview"><canvas id="characterPreview" width="256" height="192" aria-label="Vista previa animada"></canvas><h3>${esc(c.name)}</h3><p>${esc(c.role)}</p><p>Vida ${c.health} · Daño ×${c.damage}<br>${esc(c.skill)} · F · ${c.cooldown} s</p></div><div><div class="character-cards">${this.data.characters.map(x=>`<button class="character-card ${x.id===c.id?'selected':''}" data-character="${x.id}"><strong>${esc(x.name)}</strong><span>${esc(x.role)}</span></button>`).join('')}</div><div class="wardrobe"><label>Prenda <select id="outfit"><option value="traveler">Ropa de viaje</option><option value="veteran" ${unlocked?'':'disabled'}>Veterano ${unlocked?'':'· descubre piedra infernal o derrota 10 enemigos'}</option></select></label><label>Color de prenda <input id="costumeColor" type="color" value="${p.appearance.color||c.color}"></label></div><p>Las apariencias no cambian las estadísticas. El Errante conserva su aspecto original con su color de referencia.</p><button class="primary" data-character-confirm>${this.confirm?'ENTRAR AL MUNDO':'GUARDAR APARIENCIA'}</button></div></div>`,false);
    document.getElementById('outfit').value=p.appearance.outfit;document.getElementById('outfit').onchange=e=>p.appearance.outfit=e.target.value;document.getElementById('costumeColor').oninput=e=>p.appearance.color=e.target.value;
  }
  click(event) {
    const b=event.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-exp-close'))return this.close();
    if(b.dataset.tab)return this.open(b.dataset.tab);
    if(b.dataset.character){this.previewing.characterId=b.dataset.character;this.previewing.appearance.color='';return this.renderCharacters();}
    if(b.hasAttribute('data-character-confirm')) {this.selected=structuredClone(this.previewing);try{localStorage.setItem('umbra.profile.v1',JSON.stringify(this.selected));}catch{}const done=this.confirm;this.close();done?.();return;}
    if(b.dataset.recipe)return this.action({type:'craft',recipe:b.dataset.recipe},true);
    if(b.dataset.potion)return this.action({type:'potion',potion:b.dataset.potion},true);
    if(b.dataset.bind)return this.action({type:'bind',target:b.dataset.bind},true);
    if(b.hasAttribute('data-connect')) {
      const url=document.getElementById('serverUrl').value.trim(),name=document.getElementById('playerName').value.trim(),room=document.getElementById('roomCode').value.trim().toUpperCase();
      try{if(!url)throw Error('Escribe la dirección del servidor WebSocket para crear o unirte a una sala.');this.api.save();this.network.connect(url,{name,room,characterId:this.selected.characterId,appearance:this.selected.appearance});this.notice('Conectando al servidor…');}catch(e){this.notice(e.message);}return;
    }
    if(b.hasAttribute('data-reconnect')) {try{const saved=JSON.parse(sessionStorage.getItem('umbra.online.session'));if(!saved)throw Error('No hay una sesión en este navegador.');this.network.connect(saved.url,saved);}catch(e){this.notice(e.message);}return;}
    if(b.hasAttribute('data-leave')) {this.network.leave();this.remotes.clear();this.connection.hidden=true;this.close();this.api.load();this.api.showMenu();return;}
    if(b.hasAttribute('data-chat')) {const input=document.getElementById('chatText');if(this.network.send({type:'chat',text:input.value}))input.value='';return;}
  }
  notice(message){const el=document.getElementById('expansionNotice');if(el)el.textContent=message;this.api.say(message);}
  name(id){if(id.startsWith('bar_'))return 'Lingote de '+this.name(id.slice(4));return labels[id]||this.data.materials.find(m=>m.id===id)?.name||this.data.potions.find(p=>'potion_'+p.id===id)?.name||id;}
  renderPanel() {
    const p=this.progress,a=this.actor,s=this.sheet;
    if(this.tab==='online') {
      this.shell('Expediciones compartidas',`<p>Conecta dos navegadores al mismo servidor y al mismo código de sala. Una sala vacía crea un mundo nuevo. GitHub Pages aloja el juego; el servidor valida y guarda el mundo compartido.</p><div class="network-form"><label>Servidor WebSocket <input id="serverUrl" type="url" placeholder="wss://servidor.example/ws" value="${esc(this.network.url||this.data.serverUrl)}"></label><label>Tu nombre <input id="playerName" maxlength="24" value="${esc(this.network.options?.name||'Superviviente')}"></label><label>Sala · vacía para crear <input id="roomCode" maxlength="10" value="${esc(this.network.options?.room||'')}"></label></div><div class="expansion-actions"><button class="primary" data-connect>CREAR / UNIRSE</button><button class="secondary" data-reconnect>RECONECTAR SESIÓN</button>${this.online?'<button class="secondary" data-leave>SALIR DE LA SALA</button>':''}</div><p>Estado: ${esc(this.status)} ${this.network.options?.room?'· Sala '+esc(this.network.options.room):''}</p><div class="chat-log">${this.messages.map(m=>`<p><b>${esc(m.name)}:</b> ${esc(m.text)}</p>`).join('')}</div><div class="chat-entry"><input id="chatText" maxlength="200" aria-label="Mensaje de chat" placeholder="Mensaje para la sala"><button class="secondary" data-chat>ENVIAR</button></div><p>Sin servidor configurado puedes jugar individualmente. En la web pública se necesita wss://. Consulta docs/MULTIJUGADOR.md para ejecutar y probar el servidor.</p>`);return;
    }
    if(this.tab==='minerals') {
      this.shell('Atlas de minerales',`<p>Pico actual: nivel ${p.tools.pick} · categoría ${s.miningTier}. R para minar. Oro permite categoría 2; piedra infernal permite categoría 3.</p><div class="mineral-grid">${this.data.materials.map(m=>`<article style="--mineral:${m.color}"><span class="mineral-crystal"></span><h3>${esc(m.name)}</h3><p>${esc(m.rarity)} · Categoría ${m.tier}<br>Resistencia ${m.hardness} · ${p.discovered.includes(m.id)?'Descubierto':'Por descubrir'}</p></article>`).join('')}</div>`);return;
    }
    if(this.tab==='spirits') {
      this.shell('Espíritus del bosque',`<p>La clériga vincula espíritus a cambio de 3 de esencia. Un espíritu hostil debe ser debilitado antes. Tu compañero: ${esc(p.spirit||'ninguno')}.</p><div class="expansion-recipes">${this.world.spirits.map(spirit=>`<article><h3>${esc(spirit.id)}</h3><p>${esc(spirit.kind)} · ${spirit.hp} vida · ${esc(spirit.realm)}<br>${spirit.id==='willow'?'Regenera vida.':spirit.id==='ember'?'Dispara a tus enemigos.':'Reduce el daño recibido.'}</p><button class="secondary" data-bind="${spirit.id}" ${spirit.bound?'disabled':''}>${spirit.bound?'VINCULADO':'VINCULAR · ALCANCE 110'}</button></article>`).join('')}</div>`);return;
    }
    if(this.tab==='potions') {
      this.shell('Alquimia y efectos',`<p>Prepara pociones junto a una mesa de alquimia. La clériga potencia la curación. Seis efectos con consumo, duración y reutilización propios.</p><div class="expansion-recipes">${this.data.potions.map(r=>`<article><h3>${esc(r.name)} · ${resourceAmount(a,p,'potion_'+r.id)}</h3><p>${esc(r.effect)}<br>${r.duration}s · reutilización ${r.cooldown}s<br>${Object.entries(r.cost).map(([id,n])=>n+' '+this.name(id)).join(' · ')}</p><button class="secondary" data-recipe="potion_${r.id}">PREPARAR</button><button class="secondary" data-potion="${r.id}" ${resourceAmount(a,p,'potion_'+r.id)<1?'disabled':''}>CONSUMIR</button></article>`).join('')}</div>`);return;
    }
    this.shell('Equipo, taller y progresión',`<div class="sheet"><b>${esc(s.name)}</b><span>Vida ${Math.ceil(a.hp)}/${s.maxHp}</span><span>Daño ×${s.damage.toFixed(2)}</span><span>Defensa adicional ${Math.round(s.defense*100)}%</span><span>Minado ${s.miningTier}</span><span>Tala ×${s.logging}</span><span>Cultivo ×${s.farming}</span></div><p>La forja original sigue en I. B abre este taller. Estaciones: mesa de trabajo → horno/yunque → herramientas, armaduras y alquimia. Se construyen delante del personaje; X desmonta y recupera la mitad de los materiales.</p><div class="expansion-materials">${['wood','ore','shard',...Object.keys(p.inventory)].map(id=>`<span>${esc(this.name(id))} <b>${resourceAmount(a,p,id)}</b></span>`).join('')}</div><label>Recetas <select id="recipeFilter"><option value="stations">Estaciones y construcción</option><option value="bars">Lingotes</option><option value="tools">Herramientas y armas</option><option value="armor">Armaduras</option><option value="accessories">Accesorios</option></select></label><div id="advancedRecipes" class="expansion-recipes"></div>`);
    const filter=document.getElementById('recipeFilter');filter.value=this.filter||'stations';filter.onchange=()=>{this.filter=filter.value;this.renderRecipes();};this.renderRecipes();
  }
  renderRecipes() {
    const el=document.getElementById('advancedRecipes');if(!el)return;const filter=this.filter||'stations';
    el.innerHTML=catalog(this.data).filter(r=>filter==='stations'?['station','building'].includes(r.kind):filter==='bars'?r.kind==='bar':filter==='tools'?['pick','axe','hoe','sword','bow'].includes(r.kind):filter==='armor'?['helmet','chest','greaves'].includes(r.kind):r.kind==='accessory').map(r=>{const status=craftingState(this.data,this.world,this.actor,this.progress,r);return `<article><h3>${esc(r.name)}</h3><p>${esc(r.description)}<br>Estación: ${r.station}<br>${Object.entries(r.cost).map(([id,n])=>n+' '+this.name(id)).join(' · ')}</p><button class="secondary" data-recipe="${r.id}" ${status.owned||!status.unlocked?'disabled':''}>${status.owned?'EQUIPADO':!status.unlocked?'DESCUBRE EL MINERAL':'FABRICAR'}</button></article>`;}).join('');
  }
  action(action,refresh=false) {
    if(this.online){if(!this.network.send({type:'action',action}))this.notice('Esperando reconexión.');return;}
    const result=applyAction(this.data,this.world,this.actor,this.progress,action);this.notice(result.message);
    if(result.ok){this.actor.harvest=.24;this.actor.toolAction=action.type;this.api.sound(action.type==='potion'?'heal':'harvest');this.api.burst(this.actor.x+14,this.actor.y+25,action.type==='mine'?'#c9d2c1':'#a6c38c',12,110);this.api.save();this.api.updateHUD();}
    if(refresh)this.renderPanel();return result.ok;
  }
  nearest(list,range=80){return list.filter(o=>o.realm===this.progress.realm&&Math.abs(o.x-this.actor.x)<range).sort((a,b)=>Math.abs(a.x-this.actor.x)-Math.abs(b.x-this.actor.x))[0];}
  interactionTarget() {
    const p=this.actor,point=(x,label,key='E',portal=false)=>({type:'extension',x,y:626,label,key,portal});
    if(this.inCave&&p.x<135)return point(84,'Volver al bosque');
    if(!this.inCave){const depth=[430,3100,5600].findIndex(x=>Math.abs(x-p.x)<42);if(depth>=0)return point([430,3100,5600][depth],'Descender a caverna '+(depth+1),'E',true);}
    const chest=this.nearest(this.world.chests.filter(c=>!c.opened),75);if(chest)return point(chest.x,'Abrir cofre');
    const farm=this.nearest(this.world.farms,33);if(farm)return point(farm.x,farm.stage==='wild'?'Preparar terreno':farm.stage==='prepared'?'Plantar semilla':farm.readyAt<=this.world.time?'Cosechar plantas':'Cultivo · '+Math.ceil(farm.readyAt-this.world.time)+' s');
    const tree=this.nearest(this.world.trees.filter(t=>!t.fallen&&!t.fall),60);if(tree)return point(tree.x,'Talar árbol');
    const spirit=this.nearest(this.world.spirits.filter(s=>!s.bound),50);if(spirit)return point(spirit.x,'Vincular espíritu');
    return null;
  }
  interact() {
    const p=this.actor;
    if(this.online){this.network.send({type:'interact'});return true;}
    if(p.harvest>0||p.atk>0||p.dash>0)return false;
    if(!this.inCave){const entrance=[430,3100,5600].findIndex(x=>Math.abs(x-p.x)<42);if(entrance>=0){this.enterCave(entrance+1);return true;}}
    else if(p.x<135){this.exitCave();return true;}
    // Los nodos y refugios originales conservan prioridad hasta despejar el terreno.
    if(!this.inCave&&([180,2850,5520].some(x=>Math.abs(x-p.x)<78)||this.api.nodes.some(n=>n.alive&&Math.abs(n.x-p.x-14)<75&&Math.abs(n.y-p.y-54)<55)))return false;
    const chest=this.nearest(this.world.chests.filter(x=>!x.opened));if(chest)return this.action({type:'chest',target:chest.id})||true;
    const farm=this.nearest(this.world.farms,33);if(farm)return this.action({type:'farm',target:farm.id})||true;
    const spirit=this.nearest(this.world.spirits.filter(s=>!s.bound),50);if(spirit){this.action({type:'bind',target:spirit.id});return true;}
    const tree=this.nearest(this.world.trees.filter(t=>!t.fallen&&!t.fall),60);if(tree){this.action({type:'chop',target:tree.id});return true;}
    return false;
  }
  mine(){const candidates=this.world.blocks.filter(b=>b.alive&&b.realm===this.progress.realm&&Math.abs(b.x+18-(this.actor.x+14))<82&&Math.abs(b.y+18-(this.actor.y+35))<85);candidates.sort((a,b)=>Math.hypot(a.x-this.actor.x,a.y-this.actor.y)-Math.hypot(b.x-this.actor.x,b.y-this.actor.y));if(candidates[0])this.action({type:'mine',target:candidates[0].id});else this.api.say('Acércate a un bloque de la caverna · E junto a una entrada.');}
  key(code,repeat) {
    if(code==='Escape'&&!this.panel.classList.contains('hidden')){this.close();return true;}
    if(repeat)return false;
    if(code==='KeyB'){this.panel.classList.contains('hidden')?this.open('progression'):this.close();return true;}
    if(code==='KeyT'){this.open('online');return true;}
    if(this.api.state!=='play')return false;
    if(code==='KeyR'){this.mine();return true;}if(code==='KeyF'){this.skill();return true;}if(code==='KeyV'){this.open('progression');return true;}
    if(code==='KeyX'){const building=this.nearest(this.world.structures);if(building)this.action({type:'destroy',target:building.id});return true;}
    return false;
  }
  skill() {
    if(this.online){this.network.send({type:'skill'});return;}
    const p=this.progress,a=this.actor,c=character(this.data,p.characterId);if(p.skillCooldown>0){this.api.say(c.skill+' · '+Math.ceil(p.skillCooldown)+' s');return;}
    p.skillCooldown=c.cooldown;p.skill={time:0,hit:false};this.api.sound('craft');this.api.save();
  }
  onAttack(){
    if(this.online){this.network.send({type:'attack',weapon:this.actor.weapon,face:this.actor.face,aim:this.actor.aimAngle||0});return;}
    const spirit=this.nearest(this.world.spirits.filter(s=>!s.bound&&s.kind==='hostile'),100);if(spirit){spirit.hp=Math.max(1,spirit.hp-10);this.world.revision++;}
  }
  tick(dt) {
    if(this.online) {
      this.world.time+=dt;
      for(const tree of this.world.trees)if(tree.fall>0)tree.fall=Math.max(.001,tree.fall-dt);
      if(this.progress.skill){this.progress.skill.time+=dt;if(this.progress.skill.time>1.15)this.progress.skill=null;}
      this.cadence+=dt;if(this.cadence>.05){this.cadence=0;if(this.api.state==='play')this.network.send({type:'move',x:this.actor.x,y:this.actor.y,face:this.actor.face,weapon:this.actor.weapon,ground:this.actor.ground,vx:this.actor.vx,vy:this.actor.vy});}
      for(const remote of this.remotes.values()){remote.x+=(remote.targetX-remote.x)*Math.min(1,dt*14);remote.y+=(remote.targetY-remote.y)*Math.min(1,dt*14);remote.motion.clock+=dt;remote.motion.gait+=Math.abs(remote.vx||0)*dt/60;remote.atk=Math.max(0,remote.atk-dt);}
      for(const enemy of this.api.enemies)if(Number.isFinite(enemy.targetX)){enemy.x+=(enemy.targetX-enemy.x)*Math.min(1,dt*16);enemy.y+=(enemy.targetY-enemy.y)*Math.min(1,dt*16);}
      return;
    }
    if(this.api.state!=='play')return;
    advanceWorld(this.world,dt);advanceProgress(this.data,this.world,this.actor,this.progress,dt);
    if(this.inCave)this.actor.x=clamp(this.actor.x,20,1510);
    for(const drop of [...this.world.drops])if(drop.realm===this.progress.realm&&Math.abs(drop.x-this.actor.x)<55)this.action({type:'pickup',target:drop.id});
    this.companionClock+=dt;
    if(this.companionClock>=1){this.companionClock=0;if(this.inCave&&this.progress.realm==='cave3'&&this.actor.x>1000&&!this.progress.buffs.gills&&!this.sheet.fireResist&&!this.progress.buffs.obsidianSkin)this.api.damagePlayer(3,this.actor.x-10);if(this.progress.spirit==='ember'){const enemy=this.api.enemies.find(e=>!e.dead&&Math.abs(e.x-this.actor.x)<300);if(enemy)this.api.damageEnemy(enemy,8,this.actor.face,-this.world.time);}for(const s of this.world.spirits)if(!s.bound&&s.kind==='hostile'&&s.realm===this.progress.realm&&Math.abs(s.x-this.actor.x)<130)this.api.damagePlayer(5,s.x);}
    const skill=this.progress.skill;
    if(skill){skill.time+=dt;if(skill.time>=.42&&!skill.hit){skill.hit=true;const id=this.progress.characterId,a=this.actor;this.api.burst(a.x+14,a.y+20,id==='samurai'?'#ed8b76':'#acd5b2',40,220);if(id==='samurai'||id==='lumberjack'){for(const e of this.api.enemies)if(!e.dead&&Math.abs(e.x-a.x)<(id==='samurai'?180:125))this.api.damageEnemy(e,id==='samurai'?65:36,a.face,-this.world.time);if(Math.abs(this.api.boss.x-a.x)<180)this.api.damageBoss(65,-this.world.time);}if(id==='farmer'){for(const plot of this.world.farms)if(Math.abs(plot.x-a.x)<200&&plot.stage==='growing')plot.readyAt=Math.min(plot.readyAt,this.world.time+1);a.hp=Math.min(a.maxHp,a.hp+20);}if(id==='cleric'){const s=this.nearest(this.world.spirits.filter(s=>!s.bound),100);if(s)this.action({type:'bind',target:s.id});else a.hp=Math.min(a.maxHp,a.hp+35*this.sheet.healing);}if(id==='wanderer')a.stamina=Math.min(100,a.stamina+40);if(id==='lumberjack'){for(const t of this.world.trees.filter(t=>!t.fallen&&!t.fall&&Math.abs(t.x-a.x)<130)){t.hp=Math.max(1,t.hp-3);this.world.revision++;}}this.api.save();}if(skill.time>1.15)this.progress.skill=null;}
  }
  damageMultiplier(){return this.sheet.damage;}
  defenseMultiplier(){return Math.max(.2,(1-this.sheet.defense)*(this.progress.buffs.obsidianSkin>0?.75:this.progress.buffs.ironSkin>0?.85:1)*(this.progress.spirit==='warden'?.9:1)*(this.progress.accessories.includes('stone')?.96:1));}
  solids(){const result=this.world.structures.filter(s=>s.realm===this.progress.realm&&s.kind==='wall').map(s=>({x:s.x-16,y:578,w:32,h:48}));if(this.inCave)result.push(...this.world.blocks.filter(b=>b.realm===this.progress.realm&&b.alive));return result;}
  storeCave(){if(this.inCave)this.world.caves[this.progress.realm]={enemies:structuredClone(this.api.enemies),position:{x:this.actor.x,y:this.actor.y}};}
  activateCave(depth) {
    const realm='cave'+depth;this.progress.realm=realm;document.getElementById('zone-banner').classList.remove('visible');this.api.nodes=[];this.api.enemies=this.world.caves[realm]?.enemies||[this.api.spawnEnemy('crawler',650,null,100+depth*10),this.api.spawnEnemy(depth===3?'knight':'wisp',1130,null,101+depth*10)];this.api.boss={...this.api.boss,dead:true,active:false,x:7340};this.actor.x=90;this.actor.y=572;this.actor.vx=this.actor.vy=0;this.actor.inv=1;this.api.resize();this.api.syncAudio();
  }
  enterCave(depth){this.surfaceWorld=structuredClone({nodes:this.api.nodes,enemies:this.api.enemies,boss:this.api.boss,checkpoint:this.api.checkpoint});this.progress.returnX=this.actor.x;this.progress.returnY=this.actor.y;this.activateCave(depth);this.api.say('Caverna · profundidad '+depth+' · R minar · E junto a la salida');this.api.save();}
  exitCave(){this.storeCave();const world=this.surfaceWorld;this.progress.realm=surface;if(world){this.api.nodes=world.nodes;this.api.enemies=world.enemies;this.api.boss=world.boss;this.api.checkpoint=world.checkpoint;}this.actor.x=this.progress.returnX;this.actor.y=this.progress.returnY;this.actor.vx=this.actor.vy=0;this.surfaceWorld=null;this.api.resize();this.api.syncAudio();this.api.save();}
  hud() {
    if(!this.actor)return;
    this.renderRoster();
    const label=document.querySelector('.vital-label>span');if(label)label.textContent=character(this.data,this.progress.characterId).name.toUpperCase();
    if(this.inCave){document.getElementById('zoneNumber').textContent='UMBRA · SUBSUELO';document.getElementById('zoneName').textContent='Caverna · profundidad '+this.progress.realm.slice(-1);document.getElementById('zoneWeather').textContent=this.progress.realm==='cave3'?'AIRE TÓXICO · PREPARA AGALLAS':'R · MINAR · E · SALIR CERCA DE LA ESCALERA';document.getElementById('quest-title').textContent='Bajo las raíces';document.getElementById('quest-text').textContent='Extrae materiales, abre el cofre y vuelve al bosque para forjar equipo.';document.getElementById('quest-progress').textContent='PICO · CATEGORÍA '+this.sheet.miningTier;}
    this.connection.hidden=!this.online;if(this.online)this.connection.textContent='Sala '+(this.network.options?.room||'…')+' · '+this.status+' · '+(this.remotes.size+1)+' jugadores · T chat';
  }
  drawCave(ctx,cam,width,height,time) {
    ctx.fillStyle='#0a101b';ctx.fillRect(0,0,width,height);const depth=Number(this.progress.realm.slice(-1));
    for(let i=0;i<60;i++){const x=i*37-cam;ctx.fillStyle=['#1d2431','#232c39','#303140'][i%3];ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+33,0);ctx.lineTo(x+18,85+(i*31%120));ctx.closePath();ctx.fill();}
    for(let i=0;i<26;i++){const x=i*70-cam;ctx.fillStyle=i%2?'#32403f':'#293236';ctx.beginPath();ctx.moveTo(x,626);ctx.lineTo(x+7,613-(i%3)*5);ctx.lineTo(x+17,626);ctx.fill();if(i%5===0){ctx.fillStyle=depth===3?'#c47764':'#78abac';ctx.beginPath();ctx.ellipse(x+12,614,7,3,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(x+11,614,2,10);}}
    ctx.fillStyle='#263337';ctx.fillRect(0,626,width,height-626);ctx.strokeStyle='#798f78';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(76-cam,625);ctx.lineTo(76-cam,475);ctx.moveTo(91-cam,625);ctx.lineTo(91-cam,475);for(let i=0;i<10;i++){ctx.moveTo(76-cam,480+i*15);ctx.lineTo(91-cam,480+i*15);}ctx.stroke();
  }
  drawWorld(ctx,cam,width,height,time) {
    const realm=this.progress.realm;
    for(const t of this.world.trees)if(t.realm===realm&&!t.fallen&&t.x-cam>-200&&t.x-cam<width+200){ctx.save();ctx.translate(t.x-cam,t.y);if(t.fall)ctx.rotate((1-t.fall/1.2)*1.5);if(t.hp<t.maxHp&&!t.fall)ctx.translate(Math.sin(time*30)*1.2,0);this.api.treeShape(ctx,0,0,t.h,11+(t.h-100)/15,['#53624a','#475a48','#627052'][Math.floor(t.h)%3],Math.floor(t.x),true);ctx.restore();}
    for(const plot of this.world.farms)if(plot.realm===realm){const x=plot.x-cam;ctx.fillStyle=plot.stage==='wild'?'#3b4935':'#6c5039';ctx.beginPath();ctx.ellipse(x,624,18,5,0,0,Math.PI*2);ctx.fill();if(plot.stage==='growing'){const growth=clamp(1-(plot.readyAt-this.world.time)/40,.1,1);ctx.strokeStyle='#8aaa70';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,624);ctx.lineTo(x,624-25*growth);ctx.moveTo(x,617);ctx.quadraticCurveTo(x-18*growth,604,x-7*growth,606);ctx.moveTo(x,614);ctx.quadraticCurveTo(x+17*growth,600,x+8*growth,603);ctx.stroke();if(this.world.time>=plot.readyAt){ctx.fillStyle='#d5c39b';ctx.beginPath();ctx.arc(x,599,4,0,Math.PI*2);ctx.fill();}}}
    if(!this.inCave)for(const [i,entry]of [430,3100,5600].entries()){const x=entry-cam;ctx.fillStyle='#131c25';ctx.beginPath();ctx.ellipse(x,617,31,20,0,Math.PI,0);ctx.fill();ctx.strokeStyle='#69766b';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#c8c09c';ctx.font='11px Segoe UI';ctx.textAlign='center';ctx.fillText('E · CAVERNA '+(i+1),x,583);ctx.textAlign='left';}
    for(const b of this.world.blocks)if(b.alive&&b.realm===realm&&b.x-cam>-40&&b.x-cam<width+40){const m=this.data.materials.find(m=>m.id===b.material),x=b.x-cam,y=b.y;ctx.fillStyle='#3c464b';ctx.beginPath();ctx.moveTo(x,y+4);ctx.lineTo(x+28,y);ctx.lineTo(x+36,y+14);ctx.lineTo(x+32,y+36);ctx.lineTo(x+4,y+34);ctx.closePath();ctx.fill();ctx.fillStyle=m.color;for(let j=0;j<5;j++){const xx=x+6+j*5,yy=y+8+(j*7%19);ctx.beginPath();ctx.moveTo(xx,yy-4);ctx.lineTo(xx+4,yy);ctx.lineTo(xx+1,yy+6);ctx.lineTo(xx-3,yy+1);ctx.fill();}if(b.hp<b.maxHp){ctx.strokeStyle='#0a171d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+18,y);ctx.lineTo(x+12,y+14);ctx.lineTo(x+21,y+22);ctx.lineTo(x+15,y+36);ctx.stroke();}}
    for(const s of this.world.structures)if(s.realm===realm){const x=s.x-cam;ctx.fillStyle=s.kind==='forge'?'#7e8171':'#725539';if(s.kind==='torch'){ctx.fillRect(x-2,591,4,35);this.light(ctx,x,587,80,'#edb45d');}else{ctx.fillRect(x-19,603,38,6);ctx.fillRect(x-16,609,5,17);ctx.fillRect(x+11,609,5,17);if(s.kind==='wall'){for(let j=0;j<5;j++){ctx.beginPath();ctx.moveTo(x-16+j*7,626);ctx.lineTo(x-16+j*7,588);ctx.lineTo(x-13+j*7,578);ctx.lineTo(x-10+j*7,588);ctx.lineTo(x-10+j*7,626);ctx.fill();}}if(s.kind==='forge'){ctx.fillStyle='#4e5755';ctx.beginPath();ctx.arc(x,607,19,Math.PI,0);ctx.fill();this.light(ctx,x,605,30,'#e8a267');}if(s.kind==='alchemy'){ctx.fillStyle='#9fc3ac';ctx.beginPath();ctx.ellipse(x,594,7,10,0,0,Math.PI*2);ctx.fill();ctx.fillRect(x-3,579,6,9);}}}
    for(const chest of this.world.chests)if(chest.realm===realm){ctx.fillStyle=chest.opened?'#42382c':'#94734a';ctx.fillRect(chest.x-cam-15,607,30,19);ctx.strokeStyle='#d0b77f';ctx.strokeRect(chest.x-cam-15,607,30,19);ctx.fillStyle='#d2bd85';ctx.fillRect(chest.x-cam-2,611,4,7);}
    for(const drop of this.world.drops)if(drop.realm===realm){ctx.save();ctx.translate(drop.x-cam,drop.y-8+Math.sin(time*3)*2);ctx.rotate(-.3);ctx.fillStyle='#af8d59';ctx.fillRect(-9,-3,18,7);ctx.fillStyle='#d7c18c';ctx.fillRect(5,-3,3,7);ctx.restore();}
    for(const s of this.world.spirits)if(!s.bound&&s.realm===realm)this.drawSpirit(ctx,s.x-cam,s.y+Math.sin(time*2)*5,s.kind==='hostile'?'#df927d':'#9ad3bf',time);
    if(this.progress.spirit)this.drawSpirit(ctx,this.actor.x-cam-30*this.actor.face,this.actor.y+10+Math.sin(time*3)*6,this.progress.spirit==='ember'?'#e9a276':'#b3dbcc',time);
    if(this.progress.consume>0)this.light(ctx,this.actor.x+14-cam,this.actor.y+25,60,'#a6d6a5');
    for(const remote of this.remotes.values())if(remote.realm===realm){this.api.drawCharacter(remote);ctx.fillStyle='#e1dbbd';ctx.font='12px Segoe UI';ctx.textAlign='center';ctx.fillText(remote.name,remote.x+14-cam,remote.y-18);ctx.fillStyle='#253b38';ctx.fillRect(remote.x-6-cam,remote.y-10,40,3);ctx.fillStyle='#9cbf9d';ctx.fillRect(remote.x-6-cam,remote.y-10,40*remote.hp/remote.maxHp,3);ctx.textAlign='left';}
    if(this.progress.skill){const t=this.progress.skill.time,actor=this.actor;ctx.save();ctx.translate(actor.x+14-cam,actor.y+25);ctx.scale(actor.face,1);ctx.strokeStyle=this.progress.characterId==='samurai'?'#f6b4a0':'#b5e0bb';ctx.lineWidth=t<.42?2:7;ctx.globalAlpha=Math.max(0,1-t/1.15);ctx.beginPath();ctx.arc(0,0,t<.42?28:120,(t-.4)*4-1.5,(t-.4)*4+.7);ctx.stroke();ctx.restore();}
  }
  light(ctx,x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color+'55');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  drawSpirit(ctx,x,y,color,time){this.light(ctx,x,y,43,color);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-16);ctx.bezierCurveTo(x+19,y-8,x+11,y+9,x+7,y+13);ctx.lineTo(x,y+8);ctx.lineTo(x-7,y+13);ctx.bezierCurveTo(x-13,y+5,x-16,y-8,x,y-16);ctx.fill();ctx.fillStyle='#263e41';ctx.fillRect(x-6,y-4,3,3);ctx.fillRect(x+3,y-4,3,3);}
  afterRender(ctx,cam,width,height,time) {
    if(this.inCave){const radius=this.progress.accessories.includes('coal')?400:280;const x=this.actor.x+14-cam,y=this.actor.y+25;const darkness=ctx.createRadialGradient(x,y,35,x,y,radius);darkness.addColorStop(0,'#01050a00');darkness.addColorStop(1,'#01050ac9');ctx.fillStyle=darkness;ctx.fillRect(0,0,width,height);}
    if(this.previewing){const target=document.getElementById('characterPreview');if(target)this.api.preview(this.previewing,target,time);}
  }
  drawCostume(g,p,pose,breathe) {
    const id=p.characterId||'wanderer',color=p.appearance?.color||character(this.data,id).color;
    if(id==='wanderer'&&!p.appearance?.color&&!Object.values(this.progress.armor).some(n=>n>0))return;
    g.save();
    if(id!=='wanderer'||p.appearance?.color){g.fillStyle=color;g.fillRect(-9,-39+breathe,18,17);g.fillStyle='#222a28';g.fillRect(-2,-38+breathe,3,17);g.fillStyle='#c2ae7c';g.fillRect(-9,-23,18,2);}
    if(id==='farmer'){g.fillStyle='#baa16a';g.fillRect(-17,-59,36,4);g.fillRect(-9,-68,20,9);g.fillStyle='#66503c';g.fillRect(-9,-62,20,3);g.fillStyle='#cabda0';g.fillRect(-7,-36,12,14);g.fillStyle='#6c5943';g.fillRect(-3,-30,7,6);}
    if(id==='samurai'){g.fillStyle='#923d3d';for(let i=0;i<4;i++)g.fillRect(-12,-41+i*6,24,4);g.fillRect(-16,-43,9,9);g.fillRect(9,-43,9,9);g.fillStyle='#c6ad75';for(let i=0;i<3;i++)g.fillRect(-9,-39+i*6,19,1);g.fillStyle='#8b3d3d';g.fillRect(-13,-63,28,5);g.fillStyle='#d5b47e';g.beginPath();g.moveTo(-12,-62);g.lineTo(-20,-69);g.lineTo(-16,-55);g.lineTo(-12,-58);g.moveTo(12,-62);g.lineTo(20,-69);g.lineTo(16,-55);g.lineTo(12,-58);g.fill();}
    if(id==='lumberjack'){g.fillStyle='#b8a787';for(let i=0;i<4;i++)g.fillRect(-9,-39+i*5,18,1);g.fillRect(-5,-39,2,16);g.fillRect(4,-39,2,16);g.fillStyle='#7d4d32';g.fillRect(-15,-55,5,26);g.fillRect(-17,-35,5,10);g.fillStyle='#b4865c';g.fillRect(-13,-52,2,22);}
    if(id==='cleric'){g.fillStyle=color;g.beginPath();g.moveTo(-9,-37);g.lineTo(-17,-6);g.lineTo(17,-6);g.lineTo(8,-37);g.closePath();g.fill();g.fillStyle='#d4c6a2';g.fillRect(-2,-39,4,30);g.fillRect(-9,-57,20,4);g.fillRect(-12,-55,4,23);g.fillStyle='#706e91';g.fillRect(-13,-62,28,5);g.fillStyle='#dbcb99';g.fillRect(-3,-61,6,9);}
    if(p.appearance?.outfit==='veteran'){g.fillStyle='#c6b478';g.fillRect(-12,-39,3,13);g.fillRect(10,-39,3,13);}
    const armor=p===this.actor?this.progress.armor:p.expansionArmor||{};const top=Math.max(armor.helmet||0,armor.chest||0,armor.greaves||0);const material=this.data.materials.find(m=>m.rank===top);
    if(material){g.fillStyle=material.color;if(armor.helmet){g.fillRect(-11,-61,24,5);g.fillRect(-13,-57,5,13);g.fillRect(11,-57,4,10);}if(armor.chest){for(let i=0;i<3;i++)g.fillRect(-12,-38+i*5,25,3);g.fillRect(-17,-42,8,8);g.fillRect(10,-42,8,8);}if(armor.greaves){g.fillRect(-10,-18,8,12);g.fillRect(4,-18,8,12);}}
    g.restore();
  }
  drawTool(g,p,pose,hand) {
    const id=p.harvest>0&&p.toolAction==='farm'?'farmer':p.harvest>0&&p.toolAction==='chop'?'lumberjack':p.characterId||'wanderer';
    if(p.harvest>0&&p.toolAction==='mine'){g.save();g.translate(hand.x,hand.y);g.rotate(-1.6+(1-p.harvest/.24)*2.4);g.strokeStyle='#9b7954';g.lineWidth=4;g.beginPath();g.moveTo(-8,0);g.lineTo(40,0);g.stroke();g.strokeStyle='#c5d2d2';g.lineWidth=4;g.beginPath();g.moveTo(31,-17);g.quadraticCurveTo(46,-6,43,17);g.stroke();g.restore();return true;}
    if(id==='wanderer'||p.weapon!==0||['death','hurt','dash'].includes(pose.kind))return false;
    g.save();g.translate(hand.x,hand.y);const active=['sword','harvest'].includes(pose.kind),skill=p===this.actor?this.progress.skill:p.skill;g.rotate(skill?(skill.time<.42?-2.2:-1.2+clamp((skill.time-.42)/.3,0,1)*2.8):active?(pose.kind==='harvest'?-1.8+(1-p.harvest/.24)*2.6:pose.a.angle):-.9);
    const material=this.data.materials.find(m=>m.rank===(p===this.actor?this.progress.tools.sword:0)),steel=material?.color||'#d9dfd0';g.strokeStyle='#3b342b';g.lineWidth=6;g.beginPath();g.moveTo(-8,0);g.lineTo(id==='samurai'?66:43,0);g.stroke();g.strokeStyle=steel;g.lineWidth=3;g.stroke();
    if(id==='samurai'){g.strokeStyle=steel;g.lineWidth=5;g.beginPath();g.moveTo(8,0);g.quadraticCurveTo(40,-1,76,-7);g.stroke();g.strokeStyle='#ad864e';g.lineWidth=3;g.beginPath();g.moveTo(8,-7);g.lineTo(8,7);g.stroke();}
    if(id==='farmer'){g.fillStyle='#9baca1';g.beginPath();g.moveTo(34,-2);g.lineTo(47,-2);g.lineTo(43,15);g.lineTo(35,19);g.closePath();g.fill();}
    if(id==='lumberjack'){g.fillStyle=steel;g.beginPath();g.moveTo(30,-4);g.lineTo(39,-15);g.lineTo(52,-12);g.quadraticCurveTo(61,0,52,13);g.lineTo(39,15);g.lineTo(30,5);g.fill();g.strokeStyle='#eef2d4';g.lineWidth=1;g.beginPath();g.moveTo(52,-12);g.quadraticCurveTo(59,0,52,13);g.stroke();}
    if(id==='cleric'){g.strokeStyle='#d2b67d';g.lineWidth=3;g.beginPath();g.arc(45,0,10,0,Math.PI*2);g.stroke();g.fillStyle='#acddd6';g.beginPath();g.moveTo(45,-8);g.lineTo(50,0);g.lineTo(45,8);g.lineTo(40,0);g.fill();}
    g.restore();return true;
  }
  requestSave(){if(this.online)this.network.send({type:'save'});}
  legacy(type,fields={}){if(!this.online)return false;this.network.send({type,...fields});return true;}
  message(m) {
    if(m.type==='error'){this.notice(m.message);return;}
    if(m.type==='chat'){this.messages.push({name:m.name,text:m.text});if(this.messages.length>40)this.messages.shift();if(this.tab==='online'&&!this.panel.classList.contains('hidden'))this.renderPanel();return;}
    if(m.type==='welcome'){this.previous='play';this.panel.classList.add('hidden');this.api.startOnline();}
    if(m.type==='welcome'||m.type==='snapshot') {
      const snapshot=m.snapshot;if(!snapshot)return;
      if(snapshot.world)this.world=snapshot.world;
      if(snapshot.self){const a=snapshot.self,realm=this.progress.realm;this.progress=migrateProgress(a.progress,this.data);const position={x:this.actor.x,y:this.actor.y};for(const key of ['hp','maxHp','wood','ore','shard','potions','arrows','weapon','gear','stamina'])if(a[key]!==undefined)this.actor[key]=a[key];this.decorate();if(m.type==='welcome'||realm!==this.progress.realm||a.correct){this.actor.x=a.x;this.actor.y=a.y;this.actor.vx=this.actor.vy=0;this.api.resize();}else Object.assign(this.actor,position);if(a.hp<=0&&this.api.state==='play'){this.actor.deadTime=0;this.api.setState('dying');}if(a.hp>0&&['dead','dying'].includes(this.api.state)){document.getElementById('overlay').classList.add('hidden');this.api.setState('play');}if(a.won&&this.api.state!=='won')this.api.win();}
      if(snapshot.self?.checkpoint!==undefined)this.api.checkpoint=snapshot.self.checkpoint;
      if(snapshot.enemies){const previous=new Map(this.api.enemies.map(e=>[e.id,e]));this.api.enemies=snapshot.enemies.map(e=>{const old=previous.get(e.id);if(old&&e.hp<old.hp)this.api.burst(e.x+e.w/2,e.y+20,'#d7bd94',7,100);return {...e,targetX:e.x,targetY:e.y,x:old?.x??e.x,y:old?.y??e.y};});}
      if(snapshot.nodes)this.api.nodes=snapshot.nodes;
      if(snapshot.projectiles)this.api.projectiles=snapshot.projectiles.map(q=>({...q,owner:q.kind==='arrow'?'player':'enemy'}));
      if(snapshot.boss)this.api.boss=snapshot.boss;
      const live=new Set();for(const p of snapshot.players||[])if(p.id!==this.network.id&&p.connected){live.add(p.id);let remote=this.remotes.get(p.id);if(!remote){remote={...this.api.makePlayer(),...p,motion:{clock:0,gait:0,move:0,run:0,lean:0,state:'idle',stateTime:0,trailClock:0}};this.remotes.set(p.id,remote);}Object.assign(remote,{...p,targetX:p.x,targetY:p.y,x:remote.x,y:remote.y,motion:remote.motion,characterId:p.characterId,appearance:p.appearance});remote.motion.move=Math.abs(p.vx||0)>10?1:0;}
      for(const id of this.remotes.keys())if(!live.has(id))this.remotes.delete(id);this.api.updateHUD();this.api.syncAudio();
    }
    if(m.type==='result'){this.notice(m.message);if(!this.panel.classList.contains('hidden'))this.renderPanel();}
  }
}
