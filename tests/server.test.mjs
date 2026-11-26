import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server/index.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Peer {
  constructor(url){this.messages=[];this.seq=0;this.ws=new WebSocket(url);this.ws.onmessage=e=>this.messages.push(JSON.parse(e.data));}
  async ready(){for(let i=0;i<100&&this.ws.readyState!==WebSocket.OPEN;i++)await sleep(20);assert.equal(this.ws.readyState,WebSocket.OPEN);}
  send(message){this.ws.send(JSON.stringify({...message,sequence:++this.seq}));}
  async wait(predicate){for(let i=0;i<150;i++){const found=this.messages.find(predicate);if(found)return found;await sleep(20);}throw Error('Expected server event not received: '+JSON.stringify(this.messages.slice(-2)));}
}
test('Dos conexiones reales comparten sala, recursos, validación y reconexión',async t=>{
  const storage=await mkdtemp(join(tmpdir(),'umbra-server-'));
  let app=await startServer({port:0,host:'127.0.0.1',storage});const peers=[];t.after(async()=>{for(const p of peers)p.ws.close();await app.close();});
  const one=new Peer(app.url.replace('http','ws')+'/ws');peers.push(one);await one.ready();one.send({type:'join',name:'Cristian',characterId:'samurai'});const welcome=await one.wait(m=>m.type==='welcome');one.seq=welcome.sequence;
  const two=new Peer(app.url.replace('http','ws')+'/ws');peers.push(two);await two.ready();two.send({type:'join',name:'Compañero',room:welcome.room,characterId:'cleric'});const second=await two.wait(m=>m.type==='welcome');two.seq=second.sequence;
  await one.wait(m=>m.type==='snapshot'&&m.snapshot.players.length===2);
  two.send({type:'chat',text:'Prueba con dos jugadores reales'});await one.wait(m=>m.type==='chat'&&m.text==='Prueba con dos jugadores reales');
  const room=app.rooms.get(welcome.room),a=room.players.find(p=>p.id===welcome.id),b=room.players.find(p=>p.id===second.id);
  room.world.drops.push({id:'testdrop',realm:'surface',x:150,y:626,resource:'wood',amount:7});room.world.revision++;
  one.send({type:'action',action:{type:'pickup',target:'testdrop'}});two.send({type:'action',action:{type:'pickup',target:'testdrop'}});await sleep(120);
  assert.equal(a.wood+b.wood,7);assert.equal(room.world.drops.filter(d=>d.id==='testdrop').length,0);
  const before={x:a.x,hp:a.hp,wood:a.wood};one.send({type:'move',x:7500,y:572,vx:0,vy:0,hp:9999,wood:9999});await sleep(100);assert.equal(a.x,before.x);assert.equal(a.hp,before.hp);assert.equal(a.wood,before.wood);
  const sequence=one.seq;one.ws.send(JSON.stringify({type:'action',sequence,action:{type:'pickup',target:'testdrop'}}));await one.wait(m=>m.type==='error'&&m.message.includes('repetida'));assert.equal(a.wood,before.wood);
  // Both clients attempt the same one-hit original resource node.
  const node=room.realms.surface.nodes[0];node.hp=1;a.x=b.x=node.x-14;a.y=b.y=572;a.harvest=b.harvest=0;const totalOre=a.ore+b.ore;
  one.send({type:'interact'});two.send({type:'interact'});await sleep(100);assert.equal(node.alive,false);assert.equal(a.ore+b.ore,totalOre+4);
  // Construction, destruction and boss combat use the same authoritative world.
  const builder=a.wood>=5?a:b,peer=builder===a?one:two;builder.harvest=0;const totalWood=a.wood+b.wood;
  peer.send({type:'action',action:{type:'craft',recipe:'wall'}});await sleep(80);assert.equal(room.world.structures.length,1);assert.equal(a.wood+b.wood,totalWood-5);
  const structure=room.world.structures[0];builder.x=structure.x;peer.send({type:'action',action:{type:'destroy',target:structure.id}});await sleep(80);assert.equal(room.world.structures.length,0);assert.equal(a.wood+b.wood,totalWood-3);
  const boss=room.realms.surface.boss;boss.active=true;boss.hp=400;boss.phase=1;boss.mode='recover';boss.timer=10;a.x=b.x=7280;a.y=b.y=572;a.atk=0;a.stamina=100;a.hurt=0;a.dash=0;
  one.send({type:'attack',weapon:0,aim:0});await two.wait(m=>m.type==='snapshot'&&m.snapshot.boss.hp<400);assert.ok(boss.hp<400);assert.equal(boss.phase,2);
  one.ws.close();await sleep(60);const resumed=new Peer(app.url.replace('http','ws')+'/ws');peers.push(resumed);await resumed.ready();resumed.send({type:'join',room:welcome.room,token:welcome.token,name:'Otro nombre'});const recovered=await resumed.wait(m=>m.type==='welcome');assert.equal(recovered.id,welcome.id);assert.equal(recovered.snapshot.self.wood,a.wood);assert.equal(room.players.length,2);
  // The persistence file survives a real server restart.
  for(const p of peers)p.ws.close();await sleep(50);await app.close();app=await startServer({port:0,host:'127.0.0.1',storage});const restored=new Peer(app.url.replace('http','ws')+'/ws');peers.push(restored);await restored.ready();restored.send({type:'join',room:welcome.room,token:welcome.token});const stored=await restored.wait(m=>m.type==='welcome');assert.equal(stored.id,welcome.id);assert.equal(stored.snapshot.self.wood,a.wood);assert.equal(stored.snapshot.nodes.find(n=>n.id===node.id).alive,false);
});
