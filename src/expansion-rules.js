// Reglas compartidas: no dependen del navegador ni de la red.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const surface = 'surface';
export function validateExpansion(data) {
  if (data?.version !== 1 || data.characters?.length !== 5 || data.materials?.length !== 13 || data.potions?.length !== 6) throw Error('Catálogo de expansión incompleto.');
  if(!['wanderer','farmer','samurai','lumberjack','cleric'].every(id=>data.characters.some(c=>c.id===id)))throw Error('Conserva los identificadores de los cinco personajes.');
  const tiers={stone:1,coal:1,copper:1,iron:1,silver:1,gold:1,platinum:1,tungsten:2,diamond:2,hellstone:2,palladium:3,adamantite:3,titanium:3};
  if(!Object.entries(tiers).every(([id,tier])=>data.materials.some(m=>m.id===id&&m.tier===tier)))throw Error('No se pueden reducir las categorías obligatorias de minería.');
  for (const list of [data.characters, data.materials, data.potions]) {
    if (new Set(list.map(x => x.id)).size !== list.length) throw Error('Identificadores duplicados.');
    for (const item of list) if (!/^[a-zA-Z]+$/.test(item.id) || !/^#[a-f\d]{6}$/i.test(item.color || '#ffffff')) throw Error('Dato de expansión no válido.');
  }
  for (const c of data.characters) for (const stat of ['health','damage','speed','mining','logging','farming','healing','cooldown']) if (!Number.isFinite(c[stat]) || c[stat] <= 0 || c[stat] > 200) throw Error('Estadística no válida.');
  for (const m of data.materials) if (![1,2,3].includes(m.tier) || !Number.isInteger(m.hardness) || m.hardness < 1 || m.hardness > 100 || m.rank !== undefined && (!Number.isInteger(m.rank) || m.rank < 1 || m.rank > 10)) throw Error('Mineral no válido.');
  for (const p of data.potions) if (![p.duration,p.cooldown].every(x => Number.isFinite(x) && x >= 0) || !p.cost || !Object.values(p.cost).every(x => Number.isInteger(x) && x > 0)) throw Error('Poción no válida.');
  if (typeof data.serverUrl !== 'string' || data.serverUrl && !/^wss?:\/\//.test(data.serverUrl)) throw Error('Servidor no válido.');
  return data;
}
export const character = (data, id) => data.characters.find(c => c.id === id) || data.characters[0];
export function createProgress(id = 'wanderer', appearance = {}) {
  return { characterId: id, appearance: { outfit:'traveler', color: '', ...appearance }, inventory:{seed:6}, discovered:[], tools:{pick:1,axe:0,hoe:0,sword:0,bow:0}, armor:{helmet:0,chest:0,greaves:0}, accessories:[], buffs:{}, potionCooldown:0, skillCooldown:0, actionCooldown:0, skill:null, spirit:null, realm:surface, returnX:430, returnY:572 };
}
export function migrateProgress(value, data) {
  const p = createProgress(character(data, value?.characterId).id);
  if (!value || typeof value !== 'object') return p;
  for (const key of ['inventory','tools','armor','buffs']) for (const [id,n] of Object.entries(value[key] || {})) if (/^[a-zA-Z_]+$/.test(id) && Number.isFinite(n) && n >= 0 && n < 1e9) p[key][id] = n;
  p.discovered = [...new Set((value.discovered || []).filter(id => data.materials.some(m => m.id === id)))];
  p.appearance = {outfit:['traveler','veteran'].includes(value.appearance?.outfit) ? value.appearance.outfit : 'traveler', color:/^#[\da-f]{6}$/i.test(value.appearance?.color || '') ? value.appearance.color : ''};
  for (const key of ['skillCooldown','potionCooldown','actionCooldown','consume']) p[key] = clamp(Number(value[key]) || 0, 0, 600);
  if(value.skill&&Number.isFinite(value.skill.time))p.skill={time:clamp(value.skill.time,0,1.15),hit:!!value.skill.hit};
  p.spirit = ['willow','ember','warden'].includes(value.spirit) ? value.spirit : null;
  p.accessories = (value.accessories || []).filter(x => ['diamond','stone','coal'].includes(x));
  p.realm = /^cave[123]$/.test(value.realm) ? value.realm : surface;
  p.returnX = clamp(Number(value.returnX) || 430, 20, 7800);p.returnY = clamp(Number(value.returnY) || 572,100,572);
  return p;
}
export function createExpansionWorld(data) {
  const trees = Array.from({length:22}, (_,i) => ({id:'tree'+i,realm:surface,x:520+i*290,y:626,h:105+i%4*28,hp:4+i%4,maxHp:4+i%4,fall:0,fallen:false}));
  const farms = Array.from({length:5},(_,i) => ({id:'farm'+i,realm:surface,x:275+i*43,y:626,stage:'wild',readyAt:0}));
  const blocks = [], chests=[];
  for (let depth=1; depth<=3; depth++) {
    const minerals=data.materials.filter(m=>m.tier===depth);
    for (let i=0;i<42;i++) {
      const m=i%4===0?data.materials[0]:minerals[(i*5+Math.floor(i/7))%minerals.length];
      blocks.push({id:`block${depth}_${i}`,realm:'cave'+depth,x:270+Math.floor(i/3)*76,y:626-(i%3+1)*36,w:36,h:36,material:m.id,hp:m.hardness,maxHp:m.hardness,alive:true});
    }
    chests.push({id:'chest'+depth,realm:'cave'+depth,x:1430,y:626,opened:false});
  }
  return {version:1,time:0,revision:0,trees,farms,blocks,chests,structures:[],drops:[],spirits:[{id:'willow',realm:surface,x:820,y:570,hp:30,kind:'neutral',bound:false},{id:'ember',realm:'cave2',x:1180,y:550,hp:35,kind:'hostile',bound:false},{id:'warden',realm:'cave3',x:1380,y:550,hp:50,kind:'tameable',bound:false}],caves:{},nextId:1};
}
export function stats(data, progress, actor) {
  const c=character(data,progress.characterId), pieces=Object.values(progress.armor), complete=pieces.every(n=>n>0 && n===pieces[0]), rank=complete?pieces[0]:0;
  const defense=Math.min(.64,pieces.reduce((a,b)=>a+b,0)*.012+(complete?.025:0)+(rank===5?.025:0));
  const weaponRank=Math.max(progress.tools.sword,c.id==='lumberjack'?progress.tools.axe:0,c.id==='farmer'?progress.tools.hoe:0);
  return {...c, damage:c.damage*(1+weaponRank*.055)*(rank===9?1.08:1), attackSpeed:(c.attackSpeed||1)*(1+weaponRank*.015), defense, fullSet:rank, regeneration:rank===8?1.4:0, fireResist:rank===7||rank===10, maxHp:c.health+(actor?.gear?.armor?25:0), bowDamage:1+progress.tools.bow*.065, moveSpeed:c.speed, miningPower:1+progress.tools.pick*.15, miningTier:progress.tools.pick>=7?3:progress.tools.pick>=4?2:1};
}
export function catalog(data) {
  const result=[{id:'workbench',name:'Mesa de trabajo',kind:'station',station:'camp',cost:{wood:8},description:'Fabrica herramientas y equipo.'},{id:'forge',name:'Horno y yunque',kind:'station',station:'workbench',cost:{wood:10,stone:12,coal:3},description:'Refina minerales y forja metales.'},{id:'alchemy',name:'Mesa de alquimia',kind:'station',station:'workbench',cost:{wood:10,silver:3,herb:3},description:'Prepara seis clases de pociones.'},{id:'wall',name:'Empalizada',kind:'building',station:'any',cost:{wood:5},description:'Bloque sólido desmontable con X.'},{id:'torch',name:'Antorcha',kind:'building',station:'any',cost:{wood:1,coal:1},description:'Ilumina las cavernas.'}];
  for (const m of data.materials.filter(m=>m.rank)) {
    result.push({id:'bar_'+m.id,name:'Lingote de '+m.name,kind:'bar',material:m.id,rank:m.rank,station:'forge',cost:{[m.id]:3,coal:1},description:'Componente para forjar herramientas y armaduras.'});
    for (const kind of ['pick','axe','hoe','sword','bow','helmet','chest','greaves']) result.push({id:kind+'_'+m.id,name:({pick:'Pico',axe:'Hacha',hoe:'Azada',sword:'Espada / katana',bow:'Arco',helmet:'Casco',chest:'Pechera',greaves:'Grebas'})[kind]+' de '+m.name,kind,material:m.id,rank:m.rank,station:'forge',cost:{['bar_'+m.id]:kind==='chest'?6:kind==='helmet'||kind==='greaves'?4:3,wood:kind==='bow'?5:2},description:`Nivel ${m.rank} · ${m.rarity} · ${kind==='pick'?'Categoría de minería '+(m.rank>=7?3:m.rank>=4?2:1):'Mejora permanente'}`});
  }
  for (const p of data.potions) result.push({...p,id:'potion_'+p.id,potion:p.id,kind:'potion',station:'alchemy',description:p.effect});
  for (const [material,name,cost] of [['stone','Amuleto de piedra',{stone:10,shard:2}],['coal','Brasa de explorador',{coal:6,wood:2}],['diamond','Prisma de diamante',{diamond:3,shard:4}]]) result.push({id:'accessory_'+material,name,kind:'accessory',material,station:'workbench',cost,description:material==='diamond'?'Mejora la recuperación de resistencia.':material==='coal'?'Amplía el radio de luz en cavernas.':'Añade protección contra golpes.'});
  return result;
}
export function resourceAmount(actor, progress, id) { return ['wood','ore','shard'].includes(id) ? actor[id] || 0 : progress.inventory[id] || 0; }
export function addResource(actor, progress, id, amount) {
  if (['wood','ore','shard'].includes(id)) actor[id]=(actor[id]||0)+amount;
  else progress.inventory[id]=(progress.inventory[id]||0)+amount;
  if (!progress.discovered.includes(id)) progress.discovered.push(id);
}
export const affordable = (actor,p,cost) => Object.entries(cost).every(([id,n])=>resourceAmount(actor,p,id)>=n);
function charge(actor,p,cost) { for(const [id,n] of Object.entries(cost)) addResource(actor,p,id,-n); }
export function nearbyStation(world,actor,p,station) {
  if(station==='any')return true;
  if(station==='camp')return p.realm===surface&&[180,2850,5520].some(x=>Math.abs(actor.x-x)<110);
  return world.structures.some(s=>s.kind===station&&s.realm===p.realm&&Math.abs(s.x-actor.x)<125);
}
export function craftingState(data,world,actor,p,r) {
  let owned=false;
  if (p.tools[r.kind]!==undefined) owned=p.tools[r.kind]>=r.rank;
  if (p.armor[r.kind]!==undefined) owned=p.armor[r.kind]>=r.rank;
  if(r.kind==='accessory') owned=p.accessories.includes(r.material);
  const unlocked=!r.material||p.discovered.includes(r.material)||r.material==='copper'&&r.rank===1;
  return {owned,unlocked,station:nearbyStation(world,actor,p,r.station),affordable:affordable(actor,p,r.cost)};
}
export function applyAction(data,world,actor,p,action) {
  const fail=message=>({ok:false,message});
  if (!action || typeof action.type!=='string' || actor.hp<=0) return fail('Acción no disponible.');
  const c=stats(data,p,actor),near=(entity,range=80)=>entity&&entity.realm===p.realm&&Math.abs(entity.x-(actor.x+14))<range&&Math.abs((entity.y||626)-(actor.y+54))<100;
  let message='';
  if(action.type==='craft') {
    const r=catalog(data).find(r=>r.id===action.recipe);if(!r)return fail('Receta desconocida.');
    const state=craftingState(data,world,actor,p,r);
    if(state.owned)return fail('Ya tienes una mejora igual o superior.');
    if(!state.unlocked)return fail('Descubre primero este mineral.');
    if(!state.station)return fail('Acércate a la estación: '+r.station+'.');
    if(!state.affordable)return fail('Faltan materiales.');
    if(['station','building'].includes(r.kind)&&world.structures.length>=150)return fail('Límite de construcciones alcanzado.');
    if(['station','building'].includes(r.kind)&&world.structures.some(s=>s.realm===p.realm&&Math.abs(s.x-(actor.x+actor.face*65))<40))return fail('Ese lugar ya está ocupado.');
    charge(actor,p,r.cost);
    if(r.kind==='bar')addResource(actor,p,'bar_'+r.material,1);
    else if(p.tools[r.kind]!==undefined)p.tools[r.kind]=r.rank;
    else if(p.armor[r.kind]!==undefined)p.armor[r.kind]=r.rank;
    else if(r.kind==='potion')addResource(actor,p,r.id,1);
    else if(r.kind==='accessory')p.accessories.push(r.material);
    else world.structures.push({id:'structure'+world.nextId++,realm:p.realm,x:clamp(actor.x+actor.face*65,40,p.realm===surface?7800:1510),y:626,kind:r.id,cost:r.cost});
    message=r.name+' fabricado.';
  } else if(action.type==='mine') {
    const block=world.blocks.find(b=>b.id===action.target&&b.alive);if(!near(block))return fail('Acércate al bloque.');
    const m=data.materials.find(m=>m.id===block.material);if(c.miningTier<m.tier)return fail('Requiere pico '+(m.tier===2?'de oro':'de piedra infernal')+'.');
    if(p.actionCooldown>0)return fail('El pico se está recuperando.');
    p.actionCooldown=.34/(c.mining*(1+p.tools.pick*.06));block.hp-=c.miningPower;
    if(block.hp<=0){block.alive=false;addResource(actor,p,m.id,2+(p.tools.pick>=8?1:0)+(c.fullSet===4?1:0));if(m.id==='iron')addResource(actor,p,'ore',1);message='+ '+m.name;}else message=m.name+' · '+Math.ceil(block.hp)+' resistencia';
  } else if(action.type==='chop') {
    const tree=world.trees.find(t=>t.id===action.target&&!t.fallen&&t.fall===0);if(!near(tree))return fail('Acércate al árbol.');
    if(p.actionCooldown>0)return fail('El hacha se está recuperando.');
    p.actionCooldown=.4/(c.logging*(1+p.tools.axe*.08));tree.hp-=1+p.tools.axe*.2;
    if(tree.hp<=0){tree.fall=1.2;tree.owner=actor.id||'local';tree.yieldBonus=p.characterId==='lumberjack'?4:0;message='El árbol está cayendo.';}else message='Árbol · '+Math.ceil(tree.hp)+' resistencia';
  } else if(action.type==='farm') {
    const plot=world.farms.find(f=>f.id===action.target);if(!near(plot,60))return fail('Acércate al terreno.');
    if(p.actionCooldown>0)return fail('La azada se está recuperando.');
    p.actionCooldown=.7/c.farming;
    if(plot.stage==='wild'){plot.stage='prepared';message='Terreno preparado. E para plantar.';}
    else if(plot.stage==='prepared') {if(resourceAmount(actor,p,'seed')<1)return fail('Necesitas semillas.');charge(actor,p,{seed:1});plot.stage='growing';plot.readyAt=world.time+40/(c.farming*(1+p.tools.hoe*.1));message='Semilla plantada.';}
    else if(world.time>=plot.readyAt){plot.stage='prepared';addResource(actor,p,'herb',3);addResource(actor,p,'seed',2);message='+3 plantas medicinales · +2 semillas.';}
    else return fail('Crece en '+Math.ceil(plot.readyAt-world.time)+' segundos.');
  } else if(action.type==='chest') {
    const chest=world.chests.find(c=>c.id===action.target&&!c.opened);if(!near(chest))return fail('Cofre no disponible.');
    chest.opened=true;addResource(actor,p,'shard',5);addResource(actor,p,'seed',3);addResource(actor,p,'herb',3);message='Cofre abierto · esencia, semillas y hierbas.';
  } else if(action.type==='pickup') {
    const i=world.drops.findIndex(d=>d.id===action.target&&near(d,60));if(i<0)return fail('Objeto no disponible.');
    const [drop]=world.drops.splice(i,1);addResource(actor,p,drop.resource,drop.amount);message='+'+drop.amount+' '+drop.resource;
  } else if(action.type==='destroy') {
    const i=world.structures.findIndex(s=>s.id===action.target&&near(s));if(i<0)return fail('Construcción fuera de alcance.');
    const [s]=world.structures.splice(i,1);for(const [id,n] of Object.entries(s.cost))addResource(actor,p,id,Math.floor(n/2));message='Construcción desmontada.';
  } else if(action.type==='potion') {
    const r=data.potions.find(r=>r.id===action.potion);if(!r||resourceAmount(actor,p,'potion_'+r.id)<1)return fail('No tienes esta poción.');
    if(p.potionCooldown>0)return fail('Espera '+Math.ceil(p.potionCooldown)+' segundos.');
    charge(actor,p,{['potion_'+r.id]:1});p.potionCooldown=r.cooldown;
    if(r.id==='healing')actor.hp=Math.min(c.maxHp,actor.hp+65*c.healing);else p.buffs[r.id]=r.duration;
    p.consume=1;message=r.name+' activa.';
  } else if(action.type==='bind') {
    const spirit=world.spirits.find(s=>s.id===action.target&&!s.bound);if(p.characterId!=='cleric')return fail('La clériga puede vincular espíritus.');
    if(!near(spirit,110))return fail('Acércate al espíritu.');
    if(spirit.kind==='hostile'&&spirit.hp>15)return fail('Debilita al espíritu hostil antes de vincularlo.');
    if(!affordable(actor,p,{shard:3}))return fail('Necesitas 3 de esencia.');
    charge(actor,p,{shard:3});spirit.bound=true;p.spirit=spirit.id;message='Vínculo con '+spirit.id+' establecido.';
  } else return fail('Acción desconocida.');
  world.revision++;return {ok:true,message};
}
export function advanceWorld(world,dt) {
  world.time+=dt;
  for(const tree of world.trees)if(tree.fall>0){tree.fall=Math.max(0,tree.fall-dt);if(tree.fall===0){tree.fallen=true;world.drops.push({id:'drop'+world.nextId++,realm:tree.realm,x:tree.x,y:626,resource:'wood',amount:8+Math.floor(tree.h/50)+(tree.yieldBonus||0)});world.revision++;}}
}
export function advanceProgress(data,world,actor,p,dt) {
  for(const field of ['skillCooldown','potionCooldown','actionCooldown','consume'])p[field]=Math.max(0,(p[field]||0)-dt);
  for(const id of Object.keys(p.buffs))p.buffs[id]=Math.max(0,p.buffs[id]-dt);
  const s=stats(data,p,actor);actor.maxHp=s.maxHp;
  if(actor.hp>0){actor.hp=Math.min(actor.maxHp,actor.hp+(s.regeneration+(p.buffs.regeneration>0?2*s.healing:0)+(p.spirit==='willow'?.7:0))*dt);if(p.buffs.endurance>0||p.accessories.includes('diamond')||s.fullSet===6)actor.stamina=Math.min(100,actor.stamina+12*dt);}
}
