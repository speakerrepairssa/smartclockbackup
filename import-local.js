#!/usr/bin/env node
'use strict';
const http = require('http'), https = require('https'), crypto = require('crypto');

const DEVICE_IP   = '192.168.0.114';
const DEVICE_USER = 'admin';
const DEVICE_PASS = 'Azam198419880001';
const BUSINESS_ID = 'biz_speaker_repairs_sa';
const MONTHS_BACK = 24;
const FB_KEY      = 'AIzaSyC6capPBwQDzIyp73i4ML0m9UwqjcfJ_WE';
const FB_PROJECT  = 'smartclock-v2-8271f';
const EMAIL       = 'info@simplewebhost.co.za';
const PASS        = 'Azam198419880001#';
const FS          = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

const md5 = s => crypto.createHash('md5').update(s).digest('hex');
let token = null;

function httpsReq(method, url, body, hdrs) {
  return new Promise((res, rej) => {
    const u = new URL(url), bs = body ? JSON.stringify(body) : null;
    const h = {'Content-Type':'application/json', ...(bs?{'Content-Length':Buffer.byteLength(bs)}:{}), ...hdrs};
    const r = https.request({hostname:u.hostname,path:u.pathname+u.search,method,headers:h}, re => {
      let d=''; re.on('data',c=>d+=c); re.on('end',()=>{ try{res({s:re.statusCode,b:JSON.parse(d)})}catch{res({s:re.statusCode,b:d})} });
    });
    r.on('error',rej); if(bs) r.write(bs); r.end();
  });
}

function devicePost(path, body) {
  return new Promise((res, rej) => {
    const bs = JSON.stringify(body);
    const r1 = http.request({host:DEVICE_IP,port:80,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(bs)}}, re1 => {
      re1.resume();
      if (re1.statusCode !== 401) { let d=''; re1.on('data',c=>d+=c); re1.on('end',()=>res(d)); return; }
      const w = re1.headers['www-authenticate']||'';
      const g = k => { const m=w.match(new RegExp(k+'="([^"]+)"'))||w.match(new RegExp(k+'=([^, ]+)')); return m?m[1]:''; };
      const realm=g('realm'),nonce=g('nonce'),qop=g('qop')||'auth',opaque=g('opaque');
      const cnonce=crypto.randomBytes(8).toString('hex'),nc='00000001';
      const ha1=md5(`${DEVICE_USER}:${realm}:${DEVICE_PASS}`),ha2=md5(`POST:${path}`);
      const response=md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
      let auth=`Digest username="${DEVICE_USER}", realm="${realm}", nonce="${nonce}", uri="${path}", nc=${nc}, cnonce="${cnonce}", qop=${qop}, response="${response}"`;
      if(opaque) auth+=`, opaque="${opaque}"`;
      const r2=http.request({host:DEVICE_IP,port:80,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(bs),'Authorization':auth}},re2=>{
        let d=''; re2.on('data',c=>d+=c); re2.on('end',()=>re2.statusCode<400?res(d):rej(new Error(`Device ${re2.statusCode}: ${d.slice(0,200)}`)));
      });
      r2.on('error',rej); r2.write(bs); r2.end();
    });
    r1.on('error',rej); r1.write(bs); r1.end();
  });
}

async function main() {
  console.log('\nSmartClock Historical Import');
  console.log('============================');

  // Sign in
  process.stdout.write('Signing in to Firebase... ');
  const ar = await httpsReq('POST',`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`,{email:EMAIL,password:PASS,returnSecureToken:true});
  if (!ar.b.idToken) { console.error('FAILED:', ar.b.error?.message||JSON.stringify(ar.b)); process.exit(1); }
  token = ar.b.idToken;
  console.log('OK');

  // Load staff
  process.stdout.write('Loading staff from Firestore... ');
  const sg = await httpsReq('GET',`${FS}/businesses/${BUSINESS_ID}/staff?pageSize=500`,null,{Authorization:`Bearer ${token}`});
  const byBadge={}, byName={};
  (sg.b.documents||[]).forEach(doc => {
    const f=doc.fields||{}, id=doc.name.split('/').pop();
    const name=f.employeeName?.stringValue||f.name?.stringValue||`Slot ${id}`;
    const e={id,name};
    const badge=f.badgeNumber?.stringValue||f.badgeNumber?.integerValue||f.employeeId?.stringValue||'';
    if(badge) byBadge[String(badge)]=e;
    byName[name.toLowerCase().trim()]=e;
  });
  console.log(`OK — ${(sg.b.documents||[]).length} staff | badges: [${Object.keys(byBadge).join(', ')}] | names: [${Object.keys(byName).join(', ')}]`);

  // Fetch events from device
  const now=new Date(), start=new Date(); start.setMonth(start.getMonth()-MONTHS_BACK);
  const fmt=d=>d.toISOString().split('.')[0];
  console.log(`\nFetching events from device (${MONTHS_BACK} months: ${start.toDateString()} to ${now.toDateString()})`);
  const all=[];
  let pos=0, pg=1;
  while(true) {
    process.stdout.write(`  Page ${pg} (offset ${pos})... `);
    const raw = await devicePost('/ISAPI/AccessControl/AcsEvent?format=json',{
      AcsEventCond:{searchID:`i${Date.now()}`,searchResultPosition:pos,maxResults:100,major:5,minor:0,startTime:fmt(start),endTime:fmt(now)}
    });
    const data=JSON.parse(raw);
    if(!data.AcsEvent){console.log('no AcsEvent in response'); break;}
    const list=Array.isArray(data.AcsEvent.InfoList)?data.AcsEvent.InfoList:(data.AcsEvent.InfoList?[data.AcsEvent.InfoList]:[]);
    all.push(...list);
    console.log(`${list.length} events (running total: ${all.length} / ${data.AcsEvent.totalMatches||'?'})`);
    if(!list.length||data.AcsEvent.responseStatusStrg==='OK'||data.AcsEvent.responseStatusStrg==='NO MATCH') break;
    pos+=list.length; pg++;
  }
  console.log(`\nTotal fetched: ${all.length}`);

  // Filter to events with employee info
  const relevant=all.filter(e=>parseInt(e.minor||0)===75&&(e.name||e.employeeNoString));
  console.log(`Employee events (minor=75): ${relevant.length}`);

  if(!relevant.length){ console.log('No importable events found.'); process.exit(0); }

  // Write to Firestore one by one
  console.log('\nWriting to Firestore...');
  let imported=0, skipped=0;
  const unmapped=new Set();

  for(const evt of relevant) {
    const badge=String(evt.employeeNoString||evt.employeeNo||'');
    const ename=(evt.name||'').toLowerCase().trim();
    const staff=byBadge[badge]||byName[ename];
    if(!staff){ unmapped.add(evt.name||`badge:${badge}`); skipped++; continue; }

    const ts=new Date(evt.time);
    if(isNaN(ts)){ skipped++; continue; }
    const dateStr=ts.toISOString().split('T')[0];
    const timeStr=ts.toTimeString().split(' ')[0];
    const sl=(evt.attendanceStatus||'').toLowerCase();
    const minor=parseInt(evt.minor||0);
    const isIn=sl==='checkin'?true:sl==='checkout'?false:(minor===75||minor===8||minor===1);

    const path=`businesses/${BUSINESS_ID}/attendance_events/${dateStr}/${staff.id}/hist_${ts.getTime()}`;
    const fields={
      employeeId:{stringValue:staff.id}, employeeName:{stringValue:staff.name},
      time:{stringValue:timeStr}, timestamp:{stringValue:ts.toISOString()},
      type:{stringValue:isIn?'clock-in':'clock-out'}, attendanceStatus:{stringValue:isIn?'in':'out'},
      deviceId:{stringValue:DEVICE_IP}, source:{stringValue:'historical-import'},
      originalName:{stringValue:evt.name||''}, originalBadge:{stringValue:badge},
      recordedAt:{stringValue:new Date().toISOString()}
    };
    const r=await httpsReq('PATCH',`${FS}/${path}`,{fields},{Authorization:`Bearer ${token}`});
    if(r.s>=400){ console.error(`\nWrite error ${r.s}:`, String(r.b).slice(0,150)); skipped++; }
    else { imported++; if(imported%25===0) process.stdout.write(`\r  Saved ${imported}/${relevant.length}...`); }
  }

  console.log(`\n\nDone!`);
  console.log(`  Imported : ${imported}`);
  console.log(`  Skipped  : ${skipped}`);
  if(unmapped.size){ console.log(`  Unmatched names (${unmapped.size}): ${[...unmapped].slice(0,10).join(', ')}`); }
  process.exit(0);
}
main().catch(e=>{ console.error('Fatal:', e.message); process.exit(1); });
