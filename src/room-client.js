export class RoomClient {
  constructor(onMessage, onStatus) { this.onMessage=onMessage;this.onStatus=onStatus;this.active=false;this.sequence=0;this.retries=0; }
  connect(url, options) {
    const endpoint=new URL(url);
    if(!['ws:','wss:'].includes(endpoint.protocol)||location.protocol==='https:'&&endpoint.protocol!=='wss:')throw Error('Usa un servidor wss:// para conectar desde GitHub Pages.');
    this.leave();this.url=endpoint.href;this.options=options;this.active=true;this.open();
    if(endpoint.hostname.endsWith('.onrender.com')){const health=new URL('/health',endpoint);health.protocol=endpoint.protocol==='wss:'?'https:':'http:';fetch(health,{mode:'no-cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(90000)}).catch(()=>{});}
  }
  open() {
    if(!this.active)return;
    this.onStatus('connecting');const socket=this.socket=new WebSocket(this.url);
    const timeout=setTimeout(()=>socket.close(),90000);
    socket.onopen=()=>{clearTimeout(timeout);socket.send(JSON.stringify({type:'join',...this.options}));};
    socket.onmessage=event=>{
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.type==='welcome') {
        this.options={...this.options,room:message.room,token:message.token};this.id=message.id;
        this.sequence=Math.max(this.sequence,message.sequence||0);this.retries=0;this.onStatus('connected');
        try{sessionStorage.setItem('umbra.online.session',JSON.stringify({url:this.url,...this.options}));}catch{}
      }
      if(message.type==='error'&&message.fatal){this.active=false;socket.close();this.onStatus('error');}
      this.onMessage(message);
    };
    socket.onerror=()=>this.onStatus('error');
    socket.onclose=()=>{clearTimeout(timeout);if(this.socket!==socket)return;if(this.active){this.onStatus('reconnecting');const delay=Math.min(10000,700*2**Math.min(4,this.retries++));this.retry=setTimeout(()=>this.open(),delay);}else this.onStatus('offline');};
  }
  send(message) { if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify({...message,sequence:++this.sequence}));return true; }
  leave() { this.active=false;clearTimeout(this.retry);const socket=this.socket;this.socket=null;socket?.close();this.onStatus?.('offline'); }
}
