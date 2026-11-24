const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const html=fs.readFileSync(path.join(__dirname,'index.html'));
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif'};
const srv=http.createServer((q,r)=>{let u='';try{u=decodeURIComponent(q.url.split('?')[0])}catch(e){}
if(u.startsWith('/img/')){const f=path.join(__dirname,'img',path.basename(u));
fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':mime[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'public,max-age=3600'});r.end(d)});return}
r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html)});
const wss=new WebSocketServer({server:srv});
const rooms=new Map(),L='ABCDEFGHJKLMNPQRSTUVWXYZ',HEROES=['dex','key','kach','boss'];
let nid=1;
const tx=(w,o)=>{if(w.readyState==1)w.send(JSON.stringify(o))};
const code=()=>{let c;do{c=Array.from({length:4},()=>L[Math.random()*L.length|0]).join('')}while(rooms.has(c));return c};
const pub=r=>{const ps=r.players.map(p=>({id:p.id,name:p.name,team:p.team,hero:p.hero}));
r.players.forEach(p=>tx(p.ws,{t:'room',code:r.code,name:r.name,open:r.open,size:r.size,host:r.host,you:p.id,started:r.started,players:ps}))};
function leave(w){const r=w.room;if(!r)return;w.room=null;r.players=r.players.filter(p=>p.ws!==w);
if(!r.players.length){rooms.delete(r.code);return}
if(r.started){if(r.host==w.id){r.players.forEach(p=>{tx(p.ws,{t:'closed'});p.ws.room=null});rooms.delete(r.code)}else{const hh=r.players.find(p=>p.id==r.host);if(hh)tx(hh.ws,{t:'inp',from:w.id,left:1})}}
else{if(r.host==w.id)r.host=r.players[0].id;pub(r)}}
wss.on('connection',w=>{w.id=nid++;w.room=null;w.alive=true;w.on('pong',()=>{w.alive=true});
w.on('message',d=>{let m;try{m=JSON.parse(d)}catch(e){return}
const r=w.room,me=r&&r.players.find(p=>p.ws===w);
if(m.t=='list')tx(w,{t:'list',rooms:[...rooms.values()].filter(x=>x.open).map(x=>({code:x.code,name:x.name,n:x.players.length,size:x.size,st:x.started}))});
else if(m.t=='create'||m.t=='join'){leave(w);let x;
if(m.t=='create'){x={code:code(),name:String(m.nick||'Игрок').slice(0,12)+': лобби',open:!!m.open,host:w.id,players:[],started:false,size:[1,2,3].includes(+m.size)?+m.size:3};rooms.set(x.code,x)}
else{x=rooms.get(String(m.code||'').toUpperCase());if(!x||x.started)return tx(w,{t:'err',m:'Лобби не найдено'});if(x.players.length>=x.size*2)return tx(w,{t:'err',m:'Лобби заполнено'})}
const n0=x.players.filter(p=>p.team==0).length;
x.players.push({id:w.id,ws:w,name:String(m.nick||'Игрок').slice(0,12),team:n0<=x.players.length-n0?0:1,hero:HEROES.includes(m.hero)?m.hero:'dex'});w.room=x;pub(x)}
else if(!r||!me)return;
else if(m.t=='team'){const t=m.team==1?1:0;if(!r.started&&r.players.filter(p=>p.team==t).length<r.size){me.team=t;pub(r)}else tx(w,{t:'err',m:'Команда заполнена'})}
else if(m.t=='hero'&&HEROES.includes(m.hero)){me.hero=m.hero;pub(r)}
else if(m.t=='start'&&r.host==w.id&&!r.started){r.started=true;r.players.forEach(p=>tx(p.ws,{t:'start'}));pub(r)}
else if(m.t=='leave')leave(w);
else if(m.t=='snap'&&r.host==w.id)r.players.forEach(p=>{if(p.ws!==w)tx(p.ws,m)});
else if(m.t=='inp'&&r.host!=w.id){m.from=w.id;const h=r.players.find(p=>p.id==r.host);if(h)tx(h.ws,m)}});
w.on('close',()=>leave(w))});
setInterval(()=>wss.clients.forEach(w=>{if(!w.alive)return w.terminate();w.alive=false;w.ping()}),25000);
srv.listen(process.env.PORT||3000);
