import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {AddressInfo} from 'node:net';
import type {Lesson,Vocabulary,Grammar} from '../../src/data/types';
const vocabulary=JSON.parse(readFileSync('src/data/vocabulary.json','utf8')) as Vocabulary[];
const lessons=JSON.parse(readFileSync('src/data/lessons.json','utf8')) as Lesson[];
const grammar=JSON.parse(readFileSync('src/data/grammar.json','utf8')) as Grammar[];
const wordById=Object.fromEntries(vocabulary.map(w=>[w.id,w]));
import {createProfile,reviewVocabulary} from '../../src/lib/scheduler';
import {exportBackup} from '../../src/lib/backup';
import {wordExercise,grammarExercise} from '../../src/lib/exercises';
async function appReady(page:Page){await page.goto('./');await expect(page.getByRole('heading',{name:'Heute'})).toBeVisible();}
async function route(page:Page,hash:string){await page.evaluate(h=>{window.location.hash=h;},`/${hash}`);}
async function savedSetting(page:Page,key:string,value:number){await expect.poll(()=>page.evaluate(key=>new Promise<unknown>((resolve,reject)=>{const request=indexedDB.open('hsk-level-one-learning');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const read=db.transaction('profile').objectStore('profile').get('active');read.onsuccess=()=>{resolve(read.result?.settings[key]);db.close();};read.onerror=()=>{reject(read.error);db.close();};};}),key)).toBe(value);}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
async function fakeLocalVoice(page:Page){await page.addInitScript(()=>{
 const voice={voiceURI:'test-mandarin',name:'Test Mandarin (lokal)',lang:'zh-CN',localService:true,default:true};
 const speech={getVoices:()=>[voice],addEventListener:()=>{},removeEventListener:()=>{},cancel:()=>{},resume:()=>{},speak:(u:{rate:number;onend?:()=>void})=>{document.body.dataset.lastAudioRate=String(u.rate);setTimeout(()=>u.onend?.(),5)}};
 Object.defineProperty(window,'speechSynthesis',{value:speech,configurable:true});
 Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{lang='';rate=1;pitch=1;voice=null;onend=null;onerror=null;constructor(public text:string){}},configurable:true});
 });}
test('mobiler Lernpfad, Abruf, Speicherung und Backup',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await appReady(page);await noOverflow(page);await page.screenshot({path:`work/screens/today-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Nächste Lektion starten',exact:true}).click();
 const lesson=lessons[0];const gs=grammar.filter(g=>g.lessonId===lesson.id);
 for(let i=0;i<lesson.wordIds.length+gs.length;i++)await page.getByRole('button',{name:i===lesson.wordIds.length+gs.length-1?'Jetzt aktiv erinnern':'Weiter',exact:true}).click();
 await page.screenshot({path:`work/screens/exercise-${test.info().project.name}.png`,fullPage:true});
 const exercises=[...lesson.wordIds.map(id=>wordExercise(wordById[id],'meaning',vocabulary)),...gs.map(grammarExercise),...lesson.wordIds.map((id,i)=>wordExercise(wordById[id],i%2?'context':'production',vocabulary))];
 for(const e of exercises){await expect(page.getByRole('heading',{name:e.prompt,exact:true})).toBeVisible();if(e.kind==='choice')await page.getByRole('button',{name:new RegExp(e.answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();else await page.getByLabel('Deine Antwort auf').fill(e.answer);await page.getByRole('button',{name:'Antwort prüfen',exact:true}).click();await expect(page.getByRole('heading',{name:'Richtig erinnert.'})).toBeVisible();await page.getByRole('button',{name:'Gewusst',exact:false}).click();}
 await expect(page.getByRole('heading',{name:'Gut für heute.'})).toBeVisible();await page.getByRole('button',{name:'Zur Übersicht'}).click();await route(page,'progress');await expect(page.getByText('1 / 49',{exact:false})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Fortschritt'})).toBeVisible();
 await route(page,'settings');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Lernstand exportieren',exact:true}).click();const download=await downloadPromise;const backupPath=await download.path();expect(backupPath).toBeTruthy();await page.getByLabel('Sicherung importieren', {exact:true}).setInputFiles(backupPath!);await expect(page.getByRole('heading',{name:'Lernstand ersetzen?'})).toBeVisible();await page.getByRole('button',{name:'Lernstand ersetzen',exact:true}).click();await expect(page.getByText('Deine Sicherung wurde vollständig wiederhergestellt.')).toBeVisible();await noOverflow(page);expect(errors).toEqual([]);
});
test('GitHub-Pages-Unterpfad, PWA, Reload und echte Offline-Nutzung',async({page,context,browserName})=>{
 // WebKit's emulated offline flag can reject before service-worker dispatch.
 // Stop a dedicated no-store server instead: the cache is the only remaining source.
 const mime:Record<string,string>={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',png:'image/png',svg:'image/svg+xml'};
 const server=createServer(async(req,res)=>{try{const path=(req.url??'').split('?')[0].replace(/^\/chinese\//,'')||'index.html';if(path.includes('..'))throw new Error('bad path');const data=await readFile(resolve('dist',path));res.writeHead(200,{'Content-Type':mime[path.split('.').pop()!]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('not found');}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}/chinese/`;
 try{
 await page.goto(origin);await expect(page.getByRole('heading',{name:'Heute'})).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const manifest=await page.request.get(new URL('manifest.webmanifest',origin).href);expect(manifest.ok()).toBe(true);const data=await manifest.json();expect(data.scope).toBe('/chinese/');expect(data.start_url).toBe('/chinese/');expect(data.display).toBe('standalone');
 server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 if(browserName==='chromium')await context.setOffline(true);
 expect(await page.evaluate(async()=>{try{await fetch('/network-check-never-cached');return false;}catch{return true;}})).toBe(true);
 await route(page,'words');await page.reload();await expect(page.getByRole('heading',{name:'Wortschatz'})).toBeVisible();await page.getByPlaceholder('Wort, Pinyin oder Bedeutung suchen').fill('你好');await page.locator('.word-card').click();await expect(page.locator('dialog').getByText('nǐ hǎo',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Zur Lektion',exact:true}).click();await page.getByRole('button',{name:'Lektion starten',exact:true}).click();await expect(page.getByText('Kennenlernen',{exact:true})).toBeVisible();await noOverflow(page);
 }finally{if(server.listening){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}}
});
test('Navigation, kleine Breite, Dark Mode und fehlerhafter Import',async({page})=>{
 await appReady(page);await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Grammatik',exact:true}).click();await expect(page.getByRole('heading',{name:'Grammatik'})).toBeVisible();await page.locator('.grammar-card').first().click();await page.getByRole('button',{name:'Jetzt anwenden'}).click();await noOverflow(page);page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Einstellungen',exact:true}).click();await page.getByRole('group',{name:'Darstellung',exact:true}).getByRole('button',{name:'Dunkel',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.getByLabel('Sicherung importieren',{exact:true}).setInputFiles({name:'kaputt.json',mimeType:'application/json',buffer:Buffer.from('{"broken":true}')});await expect(page.getByText(/Die Sicherung ist ungültig/)).toBeVisible();await page.setViewportSize({width:320,height:740});await noOverflow(page);await route(page,'today');await noOverflow(page);await page.getByRole('button',{name:'Meldung schließen'}).click();await page.screenshot({path:`work/screens/mobile-dark-${test.info().project.name}.png`,fullPage:true});
});

test('globales Audiotempo auf Wortschatz, Hanzi, Grammatik, Training und Lektionen',async({page})=>{
 await fakeLocalVoice(page);await appReady(page);page.on('dialog',d=>d.accept());
 const play=async()=>{await page.locator('.audio-wrap button').first().click();await expect(page.locator('body')).toHaveAttribute('data-last-audio-rate','0.1');};
 await route(page,'settings');await page.getByRole('group',{name:'Sprechtempo',exact:true}).getByRole('button',{name:'Langsam',exact:true}).click();await savedSetting(page,'audioRate',0.1);await page.reload();await play();
 for(const [routeName,selector] of [['words','.word-card'],['hanzi','.hanzi-tile'],['grammar','.grammar-card']]){
  await route(page,routeName);await page.locator(selector).first().click();await play();await page.getByRole('button',{name:'Schließen',exact:true}).click();
 }
 await route(page,'training');await page.locator('.training-card').first().click();await play();
 await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Einstellungen',exact:true}).click();
 await route(page,'learn/l01');await page.getByRole('button',{name:'Lektion starten',exact:true}).click();await play();
 await page.getByRole('button',{name:'Lerneinheit schließen',exact:true}).click();
 await route(page,'settings');await page.getByRole('group',{name:'Sprechtempo',exact:true}).getByRole('button',{name:'Schnell',exact:true}).click();await page.locator('.audio-wrap button').first().click();await expect(page.locator('body')).toHaveAttribute('data-last-audio-rate','1.2');
 await route(page,'words');await page.locator('.word-card').first().click();await page.locator('.audio-wrap button').first().click();await expect(page.locator('body')).toHaveAttribute('data-last-audio-rate','1.2');
 await expect(page.getByRole('button',{name:'Dieses Wort üben',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Schließen',exact:true}).click();await route(page,'settings');
 const old = new Date(Date.now()-90*86400000);
 let profile=createProfile(old);
 profile=reviewVocabulary(profile,'v001','meaning','good',old);
 profile=reviewVocabulary(profile,'v001','pinyin','good',new Date(old.getTime()+60000));
 profile.settings.audioRate=0.1;
 await page.getByLabel('Sicherung importieren',{exact:true}).setInputFiles({name:'learning.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(profile))});
 await page.getByRole('button',{name:'Lernstand ersetzen',exact:true}).click();
 await route(page,'review');await page.getByRole('button',{name:'Bis zu 20 Wörter wiederholen',exact:false}).click();await play();

});

test('Einstellungsbuttons, linkes Menü und Gedächtnis-Overlay',async({page})=>{
 await appReady(page);await expect(page.locator('.bottom-nav')).toHaveCount(0);
 await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCSS('left','0px');
 await page.getByRole('dialog').getByRole('button',{name:'Einstellungen',exact:true}).click();
 await expect(page.getByRole('group',{name:'Neue Wörter pro Tag',exact:true})).toHaveCount(0);
 await expect(page.locator('.settings-stack select')).toHaveCount(0);
 await noOverflow(page);await page.setViewportSize({width:320,height:740});await noOverflow(page);
 await page.screenshot({path:`work/screens/settings-toggles-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();
 await page.screenshot({path:`work/screens/drawer-${test.info().project.name}.png`});
 await page.getByRole('dialog').getByRole('button',{name:'Fortschritt',exact:true}).click();
 await expect(page.getByText('FSRS-Stabilität ≥ 14 Tage und Abruf in mindestens zwei Richtungen.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Info zur Gedächtnisstabilität',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('FSRS-Stabilität ≥ 14 Tage und Abruf in mindestens zwei Richtungen.',{exact:true})).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Schließen',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.curriculum-progress')).toHaveCSS('margin-top','28px');
});
