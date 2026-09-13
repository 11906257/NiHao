import topics from '../src/data/topics.json';
import official from '../src/data/official.json';
import assert from 'node:assert/strict';
import { vocabulary, hanzi, grammar, lessons, tasks } from '../src/data/curriculum';
import { grammarExercise, taskExercise, wordExercise } from '../src/lib/exercises';
const ids=new Set<string>();
function unique(id:string){assert(id&&typeof id==='string', 'Fehlende ID');assert(!ids.has(id),`Doppelte ID: ${id}`);ids.add(id);}
function fields(item:object,names:string[]){for(const key of names)assert(typeof (item as Record<string,unknown>)[key]==='string'&&String((item as Record<string,unknown>)[key]).trim(),`Leeres Feld ${key} in ${JSON.stringify(item).slice(0,100)}`);}
function example(e:{id:string;zh:string;pinyin:string;de:string}){unique(e.id);fields(e,['zh','pinyin','de']);assert(/[\u4e00-\u9fff]/.test(e.zh));assert(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜa-z]/i.test(e.pinyin),'Pinyin fehlt');assert(!/\bTODO\b|PLACEHOLDER/.test(e.de));}
function exact<T,U>(actual:T[],reference:U[],key:(v:T)=>string,ref:(v:U)=>string,name:string){const a=actual.map(key).sort(),b=reference.map(ref).sort();assert.deepEqual(a,b,`${name}: fehlende, zusätzliche oder veränderte offizielle Elemente`);}
assert.equal(vocabulary.length,official.counts.vocabulary);assert.equal(hanzi.length,official.counts.recognitionHanzi);assert.equal(grammar.length,official.counts.grammarRows);assert.equal(topics.length,official.counts.topicLeaves);assert.equal(tasks.length,official.counts.taskCompetences);
exact(vocabulary,official.vocabulary,w=>`${w.sourceIndex}|${w.hanzi}|${w.pinyin}`,w=>`${w.id}|${w.hanzi}|${w.pinyin}`,'Wortliste/Pinyin');
exact(hanzi,official.hanzi,h=>h.char,h=>h.hanzi,'Erkennungszeichen');
exact(grammar,official.grammar,g=>`${g.id}|${g.sourceLabel}`,g=>`${g.id}|${g.sourceLabel}`,'Grammatik');
exact(topics,official.topics,t=>`${t.id}|${t.sourceLabel}`,t=>`${t.id}|${t.sourceLabel}`,'Themen');
exact(tasks,official.tasks,t=>`${t.id}|${t.sourceLabel}`,t=>`${t.id}|${t.sourceLabel}`,'Teilkompetenzen');
const words=new Map(vocabulary.map(w=>[w.id,w])),lessonSet=new Set(lessons.map(l=>l.id));
for(const w of vocabulary){unique(w.id);fields(w,['hanzi','pinyin','meaning','lessonId']);assert.equal(w.id,`v${String(w.sourceIndex).padStart(3,'0')}`);assert(lessonSet.has(w.lessonId));example(w.example);assert(w.example.zh.includes(w.hanzi),`${w.id}: Zielwort fehlt im Kontext`);for(const skill of ['meaning','production','pinyin','listening','context'] as const){const e=wordExercise(w,skill,vocabulary);unique(e.id);assert(e.answer&&e.explanation);assert.equal(e.vocabularyId,w.id);if(e.options){assert(e.options.length>=2,`${w.id} zu wenige sinnvolle Optionen`);assert.equal(new Set(e.options).size,e.options.length);assert(e.options.includes(e.answer));}}}
for(const h of hanzi){unique(h.id);fields(h,['char','pinyin','meaning']);assert(h.wordIds.length);for(const id of h.wordIds)assert(words.get(id)?.hanzi.includes(h.char),`${h.id}: kaputter Wortbezug ${id}`);}
for(const g of grammar){unique(g.id);fields(g,['sourceLabel','title','explanation','pattern','lessonId']);assert(lessonSet.has(g.lessonId));example(g.example);unique(g.exercise.id);assert(g.exercise.options.includes(g.exercise.answer));assert(new Set(g.exercise.options).size===g.exercise.options.length);assert.equal(grammarExercise(g).practiceId,g.id);}
for(const t of topics){unique(t.id);fields(t,['sourceLabel','title','description']);}
for(const t of tasks){unique(t.id);fields(t,['sourceLabel','title','description']);example(t.example);unique(taskExercise(t).id);}
for(const l of lessons){unique(l.id);fields(l,['title','description']);assert(l.wordIds.length>0);for(const id of l.wordIds)assert.equal(words.get(id)?.lessonId,l.id);for(const [refs,items] of [[l.grammarIds,grammar],[l.topicIds,topics],[l.taskIds,tasks]] as const)for(const id of refs)assert(items.some(item=>item.id===id),`${l.id}: kaputte Referenz ${id}`);}
exact(lessons.flatMap(l=>l.wordIds),vocabulary,x=>x,w=>w.id,'Lektionsabdeckung Wörter');
for(const [refs,items,name] of [[lessons.flatMap(l=>l.grammarIds),grammar,'Grammatik'],[lessons.flatMap(l=>l.topicIds),topics,'Themen'],[lessons.flatMap(l=>l.taskIds),tasks,'Aufgaben']] as const){for(const item of items)assert(refs.includes(item.id),`${name}: ${item.id} keiner Lektion zugeordnet`);}
console.log(`Curriculum gültig: ${vocabulary.length} Wörter, ${hanzi.length} Hanzi, ${grammar.length} Grammatikpunkte, ${topics.length} Themen, ${tasks.length} Kompetenzen, ${lessons.length} Lektionen; ${ids.size} eindeutige IDs.`);
