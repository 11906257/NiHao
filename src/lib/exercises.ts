import type { Vocabulary, Grammar, Hanzi, Task } from '../data/types';
import type { Skill } from './scheduler';
export interface Exercise {
  id: string; kind: 'text'|'choice'|'order'|'self'; skill: Skill; prompt: string;
  zh?: string; pinyin?: string; audio?: string; answer: string; accepted?: string[];
  options?: string[]; tokens?: string[]; explanation: string;
  vocabularyId?: string; practiceId?: string;
}
const tones:Record<string,string[]>={a:['ā','á','ǎ','à'],e:['ē','é','ě','è'],i:['ī','í','ǐ','ì'],o:['ō','ó','ǒ','ò'],u:['ū','ú','ǔ','ù'],'ü':['ǖ','ǘ','ǚ','ǜ']};
export function normalizePinyin(text:string):string {
  const expanded=text.toLowerCase().replace(/u:|v/g,'ü').replace(/([a-zü]+)([1-5])/g,(_,syllable:string,tone:string)=>{
    if(tone==='5')return syllable;
    const index=syllable.includes('a')?syllable.indexOf('a'):syllable.includes('e')?syllable.indexOf('e'):syllable.includes('ou')?syllable.indexOf('o'):Math.max(...['i','o','u','ü'].map(v=>syllable.lastIndexOf(v)));
    if(index<0)return syllable;
    return syllable.slice(0,index)+(tones[syllable[index]]?.[Number(tone)-1]??syllable[index])+syllable.slice(index+1);
  });
  return expanded.normalize('NFC').replace(/[\s'’.,!?，。！？·]/g,'');
}
export const normalizeText=(s:string)=>s.toLocaleLowerCase('de').normalize('NFC').trim().replace(/[.,!?，。！？]/g,'').replace(/\s+/g,' ');
export function checkAnswer(exercise:Exercise,answer:string):boolean {
  const candidates=[exercise.answer,...exercise.accepted??[]].flatMap(x=>x.split('/'));
  if(exercise.skill==='pinyin'||exercise.skill==='production')return candidates.some(x=>normalizePinyin(x)===normalizePinyin(answer));
  return candidates.some(x=>normalizeText(x)===normalizeText(answer));
}
export function wordExercise(word:Vocabulary,skill:Skill,all:Vocabulary[]):Exercise {
  const base={id:`e-${word.id}-${skill}`,skill,vocabularyId:word.id,answer:word.meaning,explanation:`${word.hanzi} (${word.pinyin}) bedeutet „${word.meaning}“. ${word.note??''}`,accepted:[...(word.accepted??[]),...word.meaning.split(/[;|,]/).map(x=>x.trim())]};
  if(skill==='production')return {...base,kind:'text',prompt:`Wie sagst du „${word.meaning}“ auf Chinesisch?`,answer:word.hanzi,accepted:all.filter(w=>normalizeText(w.meaning)===normalizeText(word.meaning)).flatMap(w=>[w.hanzi,...w.pinyin.split('/')]),explanation:`${word.hanzi} · ${word.pinyin}\n${word.example.zh}\n${word.example.de}`};
  if(skill==='pinyin')return {...base,kind:'text',prompt:'Schreibe das Pinyin mit Tönen.',zh:word.hanzi,answer:word.pinyin,accepted:word.pinyin.split('/'),explanation:`${word.hanzi} → ${word.pinyin}. Tonziffern wie ni3 hao3 werden ebenfalls erkannt.`};
  if(skill==='listening'){const homophones=all.filter(w=>w.pinyin.split('/').some(p=>word.pinyin.split('/').some(t=>normalizePinyin(p)===normalizePinyin(t))));return {...base,kind:'text',prompt:'Höre zu. Nenne eine passende Bedeutung.',audio:word.hanzi,accepted:homophones.flatMap(w=>[w.meaning,...w.accepted??[],...w.meaning.split(/[;|,]/).map(s=>s.trim())]),explanation:`Gehört: ${word.hanzi} · ${word.pinyin}\n${word.meaning}${homophones.length>1?'\nGleich klingende Wörter: '+homophones.map(w=>w.hanzi+' ('+w.meaning+')').join(', ')+'. Ohne Kontext sind mehrere Bedeutungen möglich.':''}`};}
  if(skill==='context'){
    const options=[word.meaning,...Array.from(new Set(all.filter(w=>w.lessonId===word.lessonId&&w.id!==word.id&&normalizeText(w.meaning)!==normalizeText(word.meaning)&&!(w.accepted??[]).some(a=>(word.accepted??[]).map(normalizeText).includes(normalizeText(a)))).map(w=>w.meaning))).slice(0,3)];
    return {...base,kind:'choice',prompt:`Was bedeutet „${word.hanzi}“ in diesem Satz?`,zh:word.example.zh,pinyin:word.example.pinyin,options:mix(options,word.sourceIndex),explanation:`${word.example.de}\n${word.hanzi} heißt hier „${word.meaning}“.`};
  }
  return {...base,kind:'text',prompt:'Was bedeutet dieses Wort?',zh:word.hanzi};
}
export function grammarExercise(g:Grammar):Exercise{return {id:g.exercise.id,kind:'choice',skill:'context',prompt:g.exercise.prompt,answer:g.exercise.answer,options:mix(g.exercise.options,Number(g.id.replace(/\D/g,''))*137),explanation:g.exercise.explanation,practiceId:g.id};}
export function hanziExercise(h:Hanzi):Exercise{return {id:`e-${h.id}`,kind:'text',skill:'pinyin',prompt:'Wie spricht man dieses Zeichen aus?',zh:h.char,answer:h.pinyin,accepted:h.pinyin.split(/[,;/、]/).map(s=>s.trim()),explanation:`${h.char} · ${h.pinyin}\n${h.meaning}`,practiceId:h.id};}
export function taskExercise(task:Task):Exercise{
 const listening=task.title.includes('Verstehen');const reading=task.title.includes('Lesen');
 return {id:`e-${task.id}`,kind:'self',skill:listening?'listening':reading?'context':'production',prompt:listening?'Höre zu und notiere die wichtigsten Informationen auf Deutsch.':reading?'Lies den Satz. Was erfährst du? Antworte auf Deutsch.':`Formuliere auf Chinesisch: ${task.example.de}`,zh:reading?task.example.zh:undefined,audio:listening?task.example.zh:undefined,pinyin:reading?task.example.pinyin:undefined,answer:reading||listening?task.example.de:task.example.zh,explanation:`Ein mögliches Beispiel:\n${task.example.zh}\n${task.example.pinyin}\n${task.example.de}`,practiceId:task.id};
}
export function orderExercise(word:Vocabulary):Exercise{
  const tokens=word.example.zh.replace(/[。！？!?]/g,'').match(/[\u4e00-\u9fff]|[0-9]+|[^\s]/g)??[];
  return {id:`e-order-${word.id}`,kind:'order',skill:'context',prompt:'Bringe die Zeichen in die richtige Reihenfolge.',pinyin:word.example.de,answer:tokens.join(''),tokens:mix(tokens,word.sourceIndex),explanation:`${word.example.zh}\n${word.example.pinyin}\n${word.example.de}`,vocabularyId:word.id};
}
export function mix<T>(values:T[],seed:number):T[]{const copy=[...values];for(let i=copy.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
