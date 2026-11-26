import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { geometry, createActors, createWorldAlgorithms } from '../src/world-core.js';
import { createProgress, createExpansionWorld, character, stats, applyAction, advanceWorld, advanceProgress, resourceAmount, clamp } from '../src/expansion-rules.js';
import { validateGameData } from '../src/data-schema.js';
import { validateExpansion } from '../src/expansion-rules.js';

const project=fileURLToPath(new URL('../',import.meta.url));
const gameData=validateGameData(JSON.parse(await readFile(resolve(project,'data/game-data.json'),'utf8')));
const expansionData=validateExpansion(JSON.parse(await readFile(resolve(project,'data/expansion.json'),'utf8')));
const intersect=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const groundAt=x=>geometry.ledges.find(t=>x>=t.x&&x<=t.x+t.w)?.y||626;
const safeName=s=>String(s||'Superviviente').replace(/[<>\u0000-\u001f]/g,'').slice(0,24)||'Superviviente';
const equalToken=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function realmWorld(realm) {
  const factory=createActors(gameData,realm==='surface'?groundAt:()=>626),nodes=[],enemies=[];
  if(realm==='surface') {
    const r=seeded(85931);
    for(let i=0;i<47;i++){const x=350+i*139+r()*45,type=i%3===0?'ore':i%5===0?'crystal':'wood';nodes.push({id:i,x,y:groundAt(x),type,hp:type==='ore'?3:2,alive:true,hit:0,seed:r()*30});}
    geometry.platforms.forEach((pl,i)=>nodes.push({id:60+i,x:pl.x+pl.w*.63,y:pl.y,type:i%2?'crystal':'ore',hp:2,alive:true,hit:0,seed:i}));
    gameData.enemyPlacements.forEach(([type,x],i)=>enemies.push(factory.enemy(type,x,null,i)));
  }else{const depth=Number(realm.slice(-1));enemies.push(factory.enemy('crawler',650,null,100+depth*10),factory.enemy(depth===3?'knight':'wisp',1130,null,101+depth*10));}
  return {nodes,enemies,projectiles:[],boss:{x:7340,y:502,w:80,h:124,hp:gameData.bossHealth,maxHp:gameData.bossHealth,active:false,dead:realm!=='surface',phase:1,mode:'sleep',timer:0,anim:0,hit:0,hitBy:-1,face:-1,pattern:0,attackHit:false,phasePulse:0}};
}
function createRoom(code){return {code,world:createExpansionWorld(expansionData),realms:Object.fromEntries(['surface','cave1','cave2','cave3'].map(r=>[r,realmWorld(r)])),players:[],attackCounter:1,dirty:true};}
function createPlayer(name,id,appearance) {
  const actor=createActors(gameData,groundAt).player();actor.id=randomUUID();actor.token=randomBytes(32).toString('hex');actor.name=safeName(name);actor.progress=createProgress(character(expansionData,id).id,appearance);
  actor.maxHp=character(expansionData,id).health;actor.hp=actor.maxHp;actor.connected=false;actor.sequence=0;actor.checkpoint=0;actor.lastMove=Date.now();actor.correct=true;actor.comboClock=0;actor.deadClock=0;return actor;
}
function safePlayer(p){return {id:p.id,name:p.name,x:p.x,y:p.y,vx:p.vx,vy:p.vy,face:p.face,hp:p.hp,maxHp:p.maxHp,w:p.w,h:p.h,ground:p.ground,weapon:p.weapon,gear:p.gear,atk:p.atk,atkMax:p.atkMax,combo:p.combo,dash:p.dash,hurt:p.hurt,harvest:p.harvest,inv:p.inv,deadTime:p.deadClock,characterId:p.progress.characterId,appearance:p.progress.appearance,expansionArmor:p.progress.armor,realm:p.progress.realm,skill:p.progress.skill,connected:p.connected,checkpoint:p.checkpoint};}

export async function startServer(options={}) {
  const rooms=new Map(),loading=new Map(),sockets=new Map(),versions=new WeakMap();
  const storage=resolve(options.storage||process.env.SAVE_DIR||resolve(project,'server/saves'));
  await mkdir(storage,{recursive:true});let writing=Promise.resolve();
  const staticRoot=resolve(project,'dist');
  const allowed=(options.origins||process.env.ALLOWED_ORIGINS||'https://edukshare-max.github.io').split(',').map(s=>s.trim());
  const send=(socket,message)=>{if(socket.readyState===WebSocket.OPEN&&socket.bufferedAmount<512000)socket.send(JSON.stringify(message));};
  const fail=(socket,message,fatal=false)=>send(socket,{type:'error',message,fatal});
  const server=http.createServer(async(req,res)=>{
    if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
    try{const path=new URL(req.url,'http://local').pathname;const file=resolve(staticRoot,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(staticRoot+'/')&&!file.startsWith(staticRoot+'\\'))throw Error('Path');const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  server.on('upgrade',(request,socket,head)=>{
    const origin=request.headers.origin;
    if(request.url!=='/ws'||origin&&!allowed.includes(origin)&&origin!=='http://'+request.headers.host&&origin!=='https://'+request.headers.host){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
  });
  function persist(room){
    const data=JSON.stringify({version:1,code:room.code,world:room.world,realms:room.realms,players:room.players.map(p=>({...p,connected:false,activeAttack:null,inv:0})),attackCounter:room.attackCounter});
    const target=resolve(storage,room.code+'.json');
    if(dirname(target)!==storage)throw Error('Invalid room path');
    writing=writing.catch(()=>{}).then(async()=>{await writeFile(target+'.tmp',data,{mode:0o600});await rename(target+'.tmp',target);}).catch(error=>{console.error('No se pudo guardar la sala',room.code,error.code);room.dirty=true;});room.dirty=false;return writing;
  }
  async function getRoom(code){
    if(rooms.has(code))return rooms.get(code);
    if(loading.has(code))return loading.get(code);
    const job=(async()=>{try{const saved=JSON.parse(await readFile(resolve(storage,code+'.json'),'utf8'));if(saved.version!==1||saved.code!==code)return null;const room={...saved,dirty:false};for(const p of room.players){p.connected=false;p.inv=0;p.activeAttack=null;p.lastMove=Date.now();}rooms.set(code,room);return room;}catch{return null;}})();loading.set(code,job);try{return await job;}finally{loading.delete(code);}
  }
  function snapshot(room,actor,socket,full=false){
    const realm=room.realms[actor.progress.realm],previous=versions.get(socket);
    const update=full||previous?.revision!==room.world.revision||previous?.realm!==actor.progress.realm;
    versions.set(socket,{revision:room.world.revision,realm:actor.progress.realm});
    const result={self:{...safePlayer(actor),progress:actor.progress,wood:actor.wood,ore:actor.ore,shard:actor.shard,potions:actor.potions,arrows:actor.arrows,stamina:actor.stamina,correct:actor.correct,won:actor.won},players:room.players.filter(p=>p.connected).map(safePlayer),enemies:realm.enemies.filter(e=>Math.abs(e.x-actor.x)<1500),boss:realm.boss,nodes:realm.nodes,projectiles:realm.projectiles};
    if(update)result.world=room.world;actor.correct=false;return result;
  }
  function broadcast(room,message){for(const p of room.players){const socket=sockets.get(p.id);if(socket)send(socket,message);}}
  function damagePlayer(actor,amount,source){
    if(actor.hp<=0||actor.inv>0)return false;const sheet=stats(expansionData,actor.progress,actor),buffs=actor.progress.buffs;
    const reduction=(actor.gear.armor?.72:1)*(1-sheet.defense)*(buffs.obsidianSkin>0?.75:buffs.ironSkin>0?.85:1)*(actor.progress.spirit==='warden'?.9:1)*(actor.progress.accessories.includes('stone')?.96:1);
    actor.hp=Math.max(0,actor.hp-Math.max(1,Math.round(amount*reduction)));actor.inv=.82;actor.hurt=.34;if(actor.hp===0)actor.deadClock=0;return true;
  }
  function damageEnemy(room,actor,enemy,amount){if(enemy.dead)return;enemy.hp=Math.max(0,enemy.hp-amount*stats(expansionData,actor.progress,actor).damage);enemy.hit=.16;enemy.stun=.15;if(enemy.hp===0){enemy.dead=true;enemy.death=0;actor.shard+=enemy.type==='knight'?4:2;room.dirty=true;}}
  function damageBoss(room,actor,boss,amount){if(boss.dead||!boss.active||boss.mode==='phase')return;boss.hp=Math.max(0,boss.hp-amount*stats(expansionData,actor.progress,actor).damage);boss.hit=.15;if(boss.hp===0){boss.dead=true;boss.mode='dead';actor.shard+=20;room.dirty=true;}}
  function equip(actor,weapon){if(![0,1,2].includes(weapon)||weapon===1&&!actor.gear.spear||weapon===2&&!actor.gear.bow)return false;actor.weapon=weapon;return true;}
  function attack(room,actor,message){
    if(actor.hp<=0||actor.atk>0||actor.dash>0||actor.hurt>.17||!equip(actor,message.weapon))return;
    const cost=actor.weapon===1?20:actor.weapon===2?16:14;if(actor.stamina<cost||actor.weapon===2&&actor.arrows<1)return;
    actor.stamina-=cost;actor.staminaDelay=.4;actor.combo=actor.comboClock>0?(actor.combo+1)%3:0;actor.comboClock=.85;actor.atkMax=actor.weapon===1?.45:actor.weapon===2?.5:actor.combo===2?.43:.34;actor.atkMax/=stats(expansionData,actor.progress,actor).attackSpeed;actor.atk=actor.atkMax;
    actor.activeAttack={time:0,id:room.attackCounter++,hits:[],weapon:actor.weapon,angle:Number.isFinite(message.aim)?clamp(message.aim,-Math.PI,Math.PI):0};room.dirty=true;
  }
  function legacyCraft(room,actor,id){const recipe=gameData.recipes.find(r=>r.id===id);if(!recipe||recipe.once&&actor.gear[id]||!Object.entries(recipe.cost).every(([key,n])=>actor[key]>=n))return false;for(const [key,n]of Object.entries(recipe.cost))actor[key]-=n;if(recipe.once)actor.gear[id]=true;if(id==='armor'){actor.maxHp+=25;actor.hp=Math.min(actor.maxHp,actor.hp+25);}if(id==='bow'||id==='arrows')actor.arrows+=20;if(id==='potion')actor.potions++;room.dirty=true;return true;}
  function interact(room,actor){
    if(actor.hp<=0||actor.harvest>0||actor.atk>0||actor.dash>0)return;
    const p=actor.progress,world=room.world,realm=room.realms[p.realm],near=list=>list.filter(e=>e.realm===p.realm&&Math.abs(e.x-actor.x)<55).sort((a,b)=>Math.abs(a.x-actor.x)-Math.abs(b.x-actor.x))[0];
    if(p.realm==='surface'){
      const depth=[430,3100,5600].findIndex(x=>Math.abs(actor.x-x)<42);
      if(depth>=0){p.returnX=actor.x;p.returnY=actor.y;p.realm='cave'+(depth+1);actor.x=90;actor.y=572;actor.correct=true;actor.inv=1;room.dirty=true;return;}
    }else if(actor.x<135){p.realm='surface';actor.x=p.returnX;actor.y=p.returnY;actor.correct=true;actor.inv=1;room.dirty=true;return;}
    if(p.realm==='surface') {
      const camp=geometry.camps.findIndex(c=>Math.abs(c.x-actor.x)<78&&Math.abs(actor.y+54-626)<40);
      if(camp>=0){actor.checkpoint=camp;actor.hp=actor.maxHp;actor.stamina=100;actor.potions=Math.max(actor.potions,2);actor.harvest=.3;room.dirty=true;return;}
      const node=realm.nodes.filter(n=>n.alive&&Math.abs(n.x-actor.x-14)<75&&Math.abs(n.y-actor.y-54)<55).sort((a,b)=>Math.abs(a.x-actor.x)-Math.abs(b.x-actor.x))[0];
      if(node){actor.harvest=.24;node.hp--;node.hit=.18;if(node.hp<=0){node.alive=false;const key=node.type==='wood'?'wood':node.type==='ore'?'ore':'shard';actor[key]+=key==='wood'?5:key==='ore'?4:3;}room.dirty=true;return;}
    }
    const chest=near(world.chests.filter(c=>!c.opened)),farm=near(world.farms),spirit=near(world.spirits.filter(s=>!s.bound)),tree=near(world.trees.filter(t=>!t.fallen&&!t.fall));
    if(chest||farm||spirit||tree){const action=chest?{type:'chest',target:chest.id}:farm?{type:'farm',target:farm.id}:spirit?{type:'bind',target:spirit.id}:{type:'chop',target:tree.id};const result=applyAction(expansionData,world,actor,p,action);actor.harvest=.24;send(sockets.get(actor.id),{type:'result',...result});room.dirty=true;return;}
    if(p.realm!=='surface')return;
    const camp=geometry.camps.findIndex(c=>Math.abs(c.x-actor.x)<78&&Math.abs(actor.y+54-626)<40);
    if(camp>=0){actor.checkpoint=camp;actor.hp=actor.maxHp;actor.stamina=100;actor.potions=Math.max(actor.potions,2);actor.harvest=.3;room.dirty=true;return;}
    if(realm.boss.dead&&actor.x>7640){room.world.sealed=true;room.world.revision++;for(const player of room.players)player.won=true;room.dirty=true;return;}
    const node=realm.nodes.filter(n=>n.alive&&Math.abs(n.x-actor.x-14)<75&&Math.abs(n.y-actor.y-54)<55).sort((a,b)=>Math.abs(a.x-actor.x)-Math.abs(b.x-actor.x))[0];
    if(node){actor.harvest=.24;node.hp--;node.hit=.18;if(node.hp<=0){node.alive=false;const key=node.type==='wood'?'wood':node.type==='ore'?'ore':'shard';actor[key]+=key==='wood'?5:key==='ore'?4:3;}room.dirty=true;}
  }
  async function join(socket,message){
    if(socket.actor||socket.joining)return;socket.joining=true;
    try{
      let code=String(message.room||'').toUpperCase(),room;
      if(code&&!/^[A-F0-9]{6}$/.test(code))return fail(socket,'El código de sala debe tener seis caracteres.',true);
      if(code){room=await getRoom(code);if(!room)return fail(socket,'La sala no existe.',true);}else{if(rooms.size>=32)return fail(socket,'El servidor alcanzó su límite de salas.',true);do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));room=createRoom(code);rooms.set(code,room);}
      let actor;if(message.token){actor=room.players.find(p=>equalToken(p.token,message.token));if(!actor)return fail(socket,'No se pudo recuperar esta sesión.',true);}
      else{if(room.players.length>=32||room.players.filter(p=>p.connected).length>=8)return fail(socket,'Sala llena.',true);const appearance={outfit:message.appearance?.outfit==='veteran'?'veteran':'traveler',color:/^#[\da-f]{6}$/i.test(message.appearance?.color||'')?message.appearance.color:''};actor=createPlayer(message.name,message.characterId,appearance);room.players.push(actor);}
      if(socket.readyState!==WebSocket.OPEN)return;
      const old=sockets.get(actor.id);if(old&&old!==socket){old.actor=null;old.close(4001,'Sesión reconectada');}
      actor.connected=true;actor.lastMove=Date.now();actor.correct=true;socket.actor=actor;socket.room=room;sockets.set(actor.id,socket);
      send(socket,{type:'welcome',id:actor.id,token:actor.token,room:code,sequence:actor.sequence,snapshot:snapshot(room,actor,socket,true)});broadcast(room,{type:'chat',name:'UMBRA',text:actor.name+' se unió a la sala.'});room.dirty=true;
    }finally{socket.joining=false;}
  }
  wss.on('connection',socket=>{
    socket.isAlive=true;socket.on('pong',()=>socket.isAlive=true);socket.window=Date.now();socket.count=0;
    socket.on('error',()=>{});
    socket.on('message',raw=>{
      const now=Date.now();if(now-socket.window>1000){socket.window=now;socket.count=0;}if(++socket.count>80){socket.close(1008,'Demasiados mensajes');return;}
      let message;try{message=JSON.parse(raw.toString());}catch{fail(socket,'Mensaje no válido.');return;}
      if(!message||typeof message!=='object')return;
      if(message.type==='join'){join(socket,message).catch(()=>fail(socket,'No se pudo abrir la sala.',true));return;}
      const actor=socket.actor,room=socket.room;if(!actor||!room)return fail(socket,'Primero debes unirte a una sala.');
      if(!Number.isSafeInteger(message.sequence)||message.sequence<=actor.sequence)return fail(socket,'Acción repetida o fuera de orden.');actor.sequence=message.sequence;
      if(message.type==='chat'){const text=String(message.text||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,200);if(text&&now-(actor.chatAt||0)>700){actor.chatAt=now;broadcast(room,{type:'chat',name:actor.name,text});}return;}
      if(message.type==='save'){room.dirty=true;return;}
      if(message.type==='respawn'){if(actor.hp>0||actor.deadClock<1.3)return;actor.progress.realm='surface';actor.x=geometry.camps[actor.checkpoint].x+30;actor.y=572;actor.hp=actor.maxHp;actor.shard=Math.floor(actor.shard*.8);actor.stamina=100;actor.potions=Math.max(2,actor.potions);actor.correct=true;actor.inv=1.5;actor.activeAttack=null;room.dirty=true;return;}
      if(actor.hp<=0)return;
      if(message.type==='move'){
        if(![message.x,message.y,message.vx,message.vy].every(Number.isFinite))return fail(socket,'Movimiento no válido.');
        const elapsed=clamp((now-actor.lastMove)/1000,.02,.3),maxSpeed=actor.dash>0?720:380;
        const solids=room.world.blocks.filter(b=>b.alive&&b.realm===actor.progress.realm).concat(room.world.structures.filter(s=>s.kind==='wall'&&s.realm===actor.progress.realm).map(s=>({x:s.x-16,y:578,w:32,h:48})));
        const blocked=solids.some(b=>intersect({x:message.x,y:message.y,w:28,h:54},b)&&!intersect(actor,b));
        if(Math.abs(message.x-actor.x)>maxSpeed*elapsed+15||Math.abs(message.y-actor.y)>1050*elapsed+25||message.x<15||message.x>(actor.progress.realm==='surface'?7875:1510)||message.y<80||message.y>572||blocked){actor.correct=true;return;}
        actor.vx=clamp(message.vx,-720,720);actor.vy=clamp(message.vy,-750,1000);actor.x=message.x;actor.y=message.y;actor.face=message.face===-1?-1:1;actor.ground=!!message.ground;actor.lastMove=now;room.dirty=true;return;
      }
      if(message.type==='equip'){equip(actor,message.weapon);return;}
      if(message.type==='dash'){if(actor.dashCd>0||actor.stamina<28)return;actor.stamina-=28;actor.dash=.19;actor.dashCd=.64;actor.inv=actor.progress.characterId==='samurai'?.34:.24;return;}
      if(message.type==='attack'){attack(room,actor,message);return;}
      if(message.type==='interact'){interact(room,actor);return;}
      if(message.type==='legacyCraft'){const ok=legacyCraft(room,actor,message.recipe);send(socket,{type:'result',ok,message:ok?'Equipo fabricado.':'Faltan recursos o el equipo ya existe.'});return;}
      if(message.type==='legacyPotion'){if(actor.potions>0&&actor.hp<actor.maxHp){actor.potions--;actor.hp=Math.min(actor.maxHp,actor.hp+55);room.dirty=true;}return;}
      if(message.type==='action'){const result=applyAction(expansionData,room.world,actor,actor.progress,message.action);if(result.ok){actor.harvest=.24;room.dirty=true;}send(socket,{type:'result',...result});return;}
      if(message.type==='skill'){if(actor.progress.skillCooldown<=0){actor.progress.skillCooldown=character(expansionData,actor.progress.characterId).cooldown;actor.progress.skill={time:0,hit:false};room.dirty=true;}return;}
    });
    socket.on('close',()=>{const actor=socket.actor;if(actor&&sockets.get(actor.id)===socket){sockets.delete(actor.id);actor.connected=false;socket.room.dirty=true;persist(socket.room);}});
  });
  function simulate(room,dt){
    const alive=room.players.filter(p=>p.connected&&p.hp>0);advanceWorld(room.world,dt);
    for(const actor of room.players.filter(p=>p.connected)){
      for(const k of ['inv','hurt','dash','dashCd','atk','harvest','staminaDelay','comboClock'])actor[k]=Math.max(0,(actor[k]||0)-dt);
      if(actor.hp<=0){actor.deadClock+=dt;continue;}
      advanceProgress(expansionData,room.world,actor,actor.progress,dt);
      actor.environmentClock=(actor.environmentClock||0)+dt;
      if(actor.environmentClock>=1){actor.environmentClock=0;const p=actor.progress,sheet=stats(expansionData,p,actor),realm=room.realms[p.realm];if(p.realm==='cave3'&&actor.x>1000&&!p.buffs.gills&&!p.buffs.obsidianSkin&&!sheet.fireResist)damagePlayer(actor,3,actor.x-10);if(p.spirit==='ember'){const enemy=realm.enemies.find(e=>!e.dead&&Math.abs(e.x-actor.x)<300);if(enemy)damageEnemy(room,actor,enemy,8);}for(const spirit of room.world.spirits)if(!spirit.bound&&spirit.kind==='hostile'&&spirit.realm===p.realm&&Math.abs(spirit.x-actor.x)<130)damagePlayer(actor,5,spirit.x);}
      if(actor.staminaDelay===0&&actor.atk===0&&actor.dash===0)actor.stamina=Math.min(100,actor.stamina+31*dt);
      if(Math.abs(actor.vx)>245&&actor.dash===0)actor.stamina=Math.max(0,actor.stamina-17*dt);
      for(const drop of [...room.world.drops])if(drop.realm===actor.progress.realm&&Math.abs(drop.x-actor.x)<55)applyAction(expansionData,room.world,actor,actor.progress,{type:'pickup',target:drop.id});
      if(actor.activeAttack){
        const a=actor.activeAttack;a.time+=dt;const t=a.time/actor.atkMax,realm=room.realms[actor.progress.realm];
        if(a.weapon===2&&t>=.42&&!a.shot){a.shot=true;actor.arrows--;const damage=(actor.gear.sword?34:28)*stats(expansionData,actor.progress,actor).bowDamage;realm.projectiles.push({x:actor.x+14,y:actor.y+23,vx:Math.cos(a.angle)*actor.face*790,vy:Math.sin(a.angle)*790,w:16,h:5,life:2,kind:'arrow',damage,owner:actor.id});}
        if(a.weapon!==2&&t>=.32&&t<=.78){const range=a.weapon===1?115:actor.combo===2?83:actor.gear.sword?72:61,box={x:actor.face>0?actor.x+9:actor.x+19-range,y:actor.y-4,w:range,h:61},damage=a.weapon===1?27:(actor.gear.sword?26.4:16)*(actor.combo===2?1.55:1);
          for(const e of realm.enemies)if(!e.dead&&!a.hits.includes(e.id)&&intersect(box,e)){a.hits.push(e.id);damageEnemy(room,actor,e,damage);}
          if(!a.hits.includes('boss')&&intersect(box,realm.boss)){a.hits.push('boss');damageBoss(room,actor,realm.boss,damage);}
          for(const spirit of room.world.spirits)if(!spirit.bound&&spirit.kind==='hostile'&&spirit.realm===actor.progress.realm&&Math.abs(spirit.x-actor.x)<100&&!a.hits.includes(spirit.id)){a.hits.push(spirit.id);spirit.hp=Math.max(1,spirit.hp-10);room.world.revision++;}
        }
        if(t>=1)actor.activeAttack=null;
      }
      const skill=actor.progress.skill;if(skill){skill.time+=dt;if(skill.time>.42&&!skill.hit){skill.hit=true;const id=actor.progress.characterId,realm=room.realms[actor.progress.realm];if(['samurai','lumberjack'].includes(id)){for(const e of realm.enemies)if(Math.abs(e.x-actor.x)<180)damageEnemy(room,actor,e,id==='samurai'?65:36);if(Math.abs(realm.boss.x-actor.x)<180)damageBoss(room,actor,realm.boss,65);}if(id==='farmer'){for(const plot of room.world.farms)if(Math.abs(plot.x-actor.x)<200&&plot.stage==='growing')plot.readyAt=Math.min(plot.readyAt,room.world.time+1);actor.hp=Math.min(actor.maxHp,actor.hp+20);}if(id==='cleric'){const spirit=room.world.spirits.find(s=>!s.bound&&s.realm===actor.progress.realm&&Math.abs(s.x-actor.x)<100);if(spirit)applyAction(expansionData,room.world,actor,actor.progress,{type:'bind',target:spirit.id});else actor.hp=Math.min(actor.maxHp,actor.hp+35*stats(expansionData,actor.progress,actor).healing);}if(id==='wanderer')actor.stamina=Math.min(100,actor.stamina+40);}if(skill.time>1.15)actor.progress.skill=null;}
    }
    for(const [name,realm]of Object.entries(room.realms)){
      const targets=alive.filter(p=>p.progress.realm===name);if(!targets.length)continue;
      let target=targets[0];const ai=createWorldAlgorithms(()=>({player:target,boss:realm.boss,groundAt:name==='surface'?groundAt:()=>626,get projectiles(){return realm.projectiles},set projectiles(v){realm.projectiles=v},damagePlayer:(n,x)=>damagePlayer(target,n,x)}));
      for(const enemy of realm.enemies){target=targets.reduce((a,b)=>Math.abs(a.x-enemy.x)<Math.abs(b.x-enemy.x)?a:b);const oldX=enemy.x,oldMode=enemy.mode;ai.enemy(enemy,dt);enemy.motionClock=(enemy.motionClock||0)+dt;enemy.modeElapsed=oldMode===enemy.mode?(enemy.modeElapsed||0)+dt:0;if(oldMode!==enemy.mode)enemy.modeDuration=Math.max(.01,enemy.timer);enemy.moveBlend=Math.abs(enemy.x-oldX)>1?1:0;enemy.gait=(enemy.gait||0)+Math.abs(enemy.x-oldX)/60*Math.PI*2;}
      if(name==='surface'){target=targets.reduce((a,b)=>Math.abs(a.x-realm.boss.x)<Math.abs(b.x-realm.boss.x)?a:b);const old=realm.boss.mode;ai.boss(dt);realm.boss.modeElapsed=old===realm.boss.mode?(realm.boss.modeElapsed||0)+dt:0;realm.boss.modeDuration=Math.max(.01,realm.boss.timer);realm.boss.motionClock=(realm.boss.motionClock||0)+dt;if(realm.boss.dead)realm.boss.death=(realm.boss.death||0)+dt;}
      for(const q of realm.projectiles){const oldX=q.x,oldY=q.y;q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;if(q.kind==='arrow')q.vy+=170*dt;const box={x:Math.min(oldX,q.x)-q.w/2,y:Math.min(oldY,q.y)-q.h/2,w:Math.abs(q.x-oldX)+q.w,h:Math.abs(q.y-oldY)+q.h};if(q.owner==='enemy'){for(const p of targets)if(intersect(box,p)&&damagePlayer(p,q.damage,q.x)){q.life=0;break;}}else{const owner=room.players.find(p=>p.id===q.owner);if(owner){for(const e of realm.enemies)if(!e.dead&&intersect(box,e)){damageEnemy(room,owner,e,q.damage);q.life=0;break;}if(q.life>0&&intersect(box,realm.boss)){damageBoss(room,owner,realm.boss,q.damage);q.life=0;}}}if(q.kind!=='wave'&&q.y>(name==='surface'?groundAt(q.x):626))q.life=0;}
      realm.projectiles=realm.projectiles.filter(q=>q.life>0);
    }
  }
  let frames=0;const interval=setInterval(()=>{for(const room of rooms.values()){if(!room.players.some(p=>p.connected))continue;simulate(room,.05);if(frames%2===0)for(const actor of room.players.filter(p=>p.connected)){const socket=sockets.get(actor.id);if(socket)send(socket,{type:'snapshot',snapshot:snapshot(room,actor,socket)});}}frames++;},50);
  const saves=setInterval(()=>{for(const room of rooms.values())if(room.dirty)persist(room);},2000);
  const heartbeat=setInterval(()=>{for(const socket of wss.clients){if(!socket.isAlive){socket.terminate();continue;}socket.isAlive=false;socket.ping();}},20000);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port??Number(process.env.PORT||8080),options.host||process.env.HOST||'0.0.0.0',resolve);});
  return {server,rooms,url:'http://127.0.0.1:'+server.address().port,async close(){clearInterval(interval);clearInterval(saves);clearInterval(heartbeat);for(const room of rooms.values())persist(room);for(const socket of wss.clients)socket.terminate();await writing;await new Promise(resolve=>server.close(resolve));wss.close();}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=await startServer();console.log('UMBRA: '+app.url+' · WebSocket /ws');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
