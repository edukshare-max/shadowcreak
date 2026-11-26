// Geometria, fabricas y patrones del juego original, compartidos por cliente y servidor.
export const geometry={
  "width": 7920,
  "ground": 626,
  "camps": [
    {
      "x": 180,
      "name": "Refugio de las cenizas"
    },
    {
      "x": 2850,
      "name": "Vigilia de los caídos"
    },
    {
      "x": 5520,
      "name": "La última llama"
    }
  ],
  "platforms": [
    {
      "x": 570,
      "y": 510,
      "w": 170
    },
    {
      "x": 990,
      "y": 443,
      "w": 140
    },
    {
      "x": 1410,
      "y": 515,
      "w": 195
    },
    {
      "x": 1770,
      "y": 450,
      "w": 160
    },
    {
      "x": 2200,
      "y": 492,
      "w": 190
    },
    {
      "x": 3060,
      "y": 510,
      "w": 170
    },
    {
      "x": 3400,
      "y": 423,
      "w": 160
    },
    {
      "x": 3790,
      "y": 500,
      "w": 200
    },
    {
      "x": 4140,
      "y": 427,
      "w": 150
    },
    {
      "x": 4550,
      "y": 506,
      "w": 180
    },
    {
      "x": 4910,
      "y": 446,
      "w": 170
    },
    {
      "x": 5800,
      "y": 510,
      "w": 170
    },
    {
      "x": 6160,
      "y": 448,
      "w": 180
    },
    {
      "x": 6570,
      "y": 500,
      "w": 170
    }
  ],
  "ledges": [
    {
      "x": 790,
      "y": 578,
      "w": 210
    },
    {
      "x": 1880,
      "y": 574,
      "w": 220
    },
    {
      "x": 3200,
      "y": 571,
      "w": 180
    },
    {
      "x": 4330,
      "y": 575,
      "w": 210
    },
    {
      "x": 5990,
      "y": 577,
      "w": 200
    }
  ]
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sign=v=>v<0?-1:1,rand=(a,b)=>a+Math.random()*(b-a);
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const rectHit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const motionDefaults=()=>({clock:0,gait:0,move:0,run:0,lean:0,state:'idle',stateTime:0,trailClock:0});
export function createActors(gameData,groundAt){const GROUND=geometry.ground;
function makePlayer(){return{x:150,y:GROUND-54,w:28,h:54,vx:0,vy:0,face:1,hp:100,maxHp:100,stamina:100,ground:true,motion:motionDefaults(),pendingShot:null,aimAngle:0,jumpHeld:false,coyote:0,inv:0,hurt:0,deadTime:0,dash:0,dashCd:0,atk:0,atkMax:0,attackId:0,combo:0,comboTime:0,queueAttack:false,staminaDelay:0,anim:0,land:0,harvest:0,potions:2,wood:0,ore:0,shard:0,arrows:0,weapon:0,gear:{sword:false,spear:false,bow:false,armor:false}}}
function spawnEnemy(type,x,y,id){let elite=type==='knight';return{id,type,x,y:y??groundAt(x)-(elite?60:type==='wolf'?32:34),w:elite?34:type==='wolf'?48:32,h:elite?60:type==='wolf'?32:34,hp:gameData.enemyHealth[type],maxHp:gameData.enemyHealth[type],vx:0,vy:0,face:-1,mode:'idle',timer:rand(.6,1.8),anim:rand(0,5),hit:0,dead:false,death:0,home:x,hitBy:-1,stun:0,attackHit:false,cool:0}}
return{player:makePlayer,enemy:spawnEnemy};}
export function createWorldAlgorithms(getContext){
const GROUND=geometry.ground,noop=()=>{};let context,player,boss,projectiles,shake,difficulty,damagePlayer,sound,burst,say,updateHUD,groundAt;
function pull(){context=getContext();({player,boss,projectiles,groundAt}=context);shake=context.shake||0;difficulty=context.difficulty||'veteran';damagePlayer=context.damagePlayer;sound=context.sound||noop;burst=context.burst||noop;say=context.say||noop;updateHUD=context.updateHUD||noop;}
function flush(){context.projectiles=projectiles;context.shake=shake;}
function updateEnemyLogic(e,dt){e.hit=Math.max(0,e.hit-dt);e.anim+=dt;if(e.dead){e.death+=dt;return}if(Math.abs(e.x-player.x)>1200)return;e.stun=Math.max(0,e.stun-dt);e.timer-=dt;const dx=player.x+14-(e.x+e.w/2),distance=Math.abs(dx),height=Math.abs(player.y+player.h-e.y-e.h);if(e.stun>0){e.x+=e.vx*dt;e.vx*=Math.pow(.002,dt);return}if(e.type==='wisp'){e.y=GROUND-125+Math.sin(e.anim*2.2)*24;if(e.mode==='idle'){e.x+=Math.sin(e.anim)*17*dt;if(distance<480){e.face=sign(dx);if(e.timer<=0){e.mode='windup';e.timer=.7}}}else if(e.mode==='windup'&&e.timer<=0){const dy=player.y+20-(e.y+15),len=Math.hypot(dx,dy);projectiles.push({x:e.x+16,y:e.y+16,vx:dx/len*235,vy:dy/len*235,life:3,w:13,h:13,kind:'wisp',owner:'enemy',damage:18});e.mode='recover';e.timer=1.5;sound('shot')}else if(e.mode==='recover'&&e.timer<=0){e.mode='idle';e.timer=.5}return}if(e.mode==='idle'){if(distance<430){e.face=sign(dx);e.x+=e.face*(e.type==='wolf'?72:e.type==='knight'?48:62)*dt;if(distance<(e.type==='knight'?112:e.type==='wolf'?205:150)&&height<90&&e.timer<=0){e.mode='windup';e.timer=e.type==='wolf'?.65:e.type==='knight'?.72:.5;e.attackHit=false}}else e.x+=Math.sin(e.anim)*12*dt}else if(e.mode==='windup'){if(e.timer<=0){e.mode='attack';e.timer=e.type==='knight'?.23:.42;e.vx=e.face*(e.type==='wolf'?390:e.type==='knight'?230:280);if(e.type==='crawler')e.vy=-225;sound('swing')}}else if(e.mode==='attack'){e.x+=e.vx*dt;if(e.type==='knight'){const box=enemyStrikeBox(e);if((e.modeElapsed||0)>=.13&&!e.attackHit&&rectHit(box,player)){damagePlayer(25,e.x);e.attackHit=true}}else if(!e.attackHit&&rectHit(e,player)){damagePlayer(e.type==='wolf'?23:17,e.x);e.attackHit=true}if(e.timer<=0){e.mode='recover';e.timer=e.type==='knight'?1.05:.85;e.vx=0}}else if(e.mode==='recover'&&e.timer<=0){e.mode='idle';e.timer=.35}if(e.mode!=='attack'&&distance<25&&height<45&&e.mode==='idle'){e.x-=e.face*70*dt}e.vy+=1000*dt;e.y+=e.vy*dt;const gy=groundAt(e.x+e.w/2);if(e.y+e.h>=gy){e.y=gy-e.h;e.vy=0}e.x=clamp(e.x,e.home-520,e.home+520)}
function updateBossLogic(dt){const b=boss;if(b.dead){b.anim+=dt;return}b.hit=Math.max(0,b.hit-dt);b.anim+=dt;if(!b.active){if(player.x>6910){b.active=true;b.mode='recover';b.timer=1.6;say('VHAL · El santuario se cierra. Lee sus señales y guarda resistencia.');sound('boss');updateHUD()}return}b.timer-=dt;if(b.hp<=b.maxHp*.5&&b.phase===1){b.phase=2;b.mode='phase';b.timer=2.1;b.phasePulse=2.1;projectiles=projectiles.filter(q=>q.owner==='player');burst(b.x+40,b.y+60,'#d58971',55,270);shake=12;sound('boss');updateHUD()}if(b.mode==='phase'){b.phasePulse=Math.max(0,b.phasePulse-dt);if(b.timer<=0){b.mode='recover';b.timer=.5}return}if(b.mode==='recover'){if(b.timer<=0){b.mode='approach';b.timer=b.phase===2?.5:.8;b.pattern=(b.pattern+1)%3}}else if(b.mode==='approach'){b.face=sign(player.x-b.x);const dx=Math.abs(player.x-b.x);if(dx>150)b.x+=b.face*(b.phase===2?135:90)*dt;if(b.timer<=0){b.mode='windup';b.timer=(b.phase===2?.63:.9)*(difficulty==='relentless'?.85:1);b.face=sign(player.x-b.x);updateHUD()}}else if(b.mode==='windup'){if(b.timer<=0)bossAttack()}else if(b.mode==='attack'){if(b.pattern%3===0){b.x+=b.face*(b.phase===2?420:315)*dt;const box=enemyStrikeBox(b);if((b.modeElapsed||0)>=.14&&!b.attackHit&&rectHit(box,player)){damagePlayer(34,b.x+40);b.attackHit=true}}if(b.timer<=0){b.mode='recover';b.timer=b.phase===2?.72:1.1;updateHUD()}}b.x=clamp(b.x,6920,7630)}
function bossAttack(){const b=boss;b.mode='attack';b.timer=b.pattern%3===0?.32:.48;b.attackHit=false;sound('boss');if(b.pattern%3===1){for(const direction of [-1,1])projectiles.push({x:b.x+40,y:GROUND-20,w:33,h:29,vx:direction*(b.phase===2?360:285),vy:0,life:3.7,owner:'enemy',kind:'wave',damage:29});shake=10;burst(b.x+40,GROUND,'#cd956c',36,260)}if(b.pattern%3===2){const center=Math.atan2(player.y+20-(b.y+30),player.x+14-(b.x+40)),count=b.phase===2?5:3;for(let i=0;i<count;i++){const a=center+(i-(count-1)/2)*.22;projectiles.push({x:b.x+40,y:b.y+30,vx:Math.cos(a)*260,vy:Math.sin(a)*260,w:16,h:16,life:4,owner:'enemy',kind:'ember',damage:22})}}}
function enemyStrikeBox(e){
 const large=e===boss,angle=enemyWeaponAngle(e),length=large?104:43,padding=large?14:8;
 const handX=e.x+e.w/2+e.face*(large?36:13),handY=(large?GROUND:e.y+e.h)-(large?78:34);
 const tipX=handX+e.face*Math.sin(angle)*length,tipY=handY-Math.cos(angle)*length;
 return{x:Math.min(handX,tipX)-padding,y:Math.min(handY,tipY)-padding,w:Math.abs(tipX-handX)+padding*2,h:Math.abs(tipY-handY)+padding*2};
}
function enemyWeaponAngle(e){
 if(e.mode==='windup')return lerp(.3,-1.45,enemyCharge(e));
 if(e.mode==='attack')return lerp(-1.45,2.05,ease((e.modeElapsed||0)/.18));
 if(e.mode==='recover')return lerp(2.05,.3,ease((e.modeElapsed||0)/.55));
 return .3;
}
function enemyCharge(e){return e.mode==='windup'?ease((e.modeElapsed||0)/(e.modeDuration||1)):0}
return{enemy(e,dt){pull();try{return updateEnemyLogic(e,dt)}finally{flush()}},boss(dt){pull();try{return updateBossLogic(dt)}finally{flush()}},strike(e){pull();return enemyStrikeBox(e)},angle(e){pull();return enemyWeaponAngle(e)},charge(e){return enemyCharge(e)}};
}
