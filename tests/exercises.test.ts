import {describe,it,expect} from 'vitest';
import {normalizePinyin,checkAnswer,wordExercise,grammarExercise,hanziExercise,taskExercise} from '../src/lib/exercises';
import {vocabulary,grammar,hanzi,tasks} from '../src/data/curriculum';
describe('Aktives Erinnern',()=>{
 it('akzeptiert Tonziffern, aber nicht falsche Töne',()=>{expect(normalizePinyin('ni3 hao3')).toBe(normalizePinyin('nǐ hǎo'));expect(normalizePinyin('lü4')).toBe('lǜ');expect(normalizePinyin('nu:3')).toBe('nǚ');expect(normalizePinyin('shui3')).toBe('shuǐ');expect(normalizePinyin('nǐ')).not.toBe(normalizePinyin('ní'));});
 it('akzeptiert synonyme Pflichtwörter bei produktivem Abruf',()=>{const w=vocabulary.find(w=>w.hanzi==='哪里')!;expect(checkAnswer(wordExercise(w,'production',vocabulary),'哪儿')).toBe(true);});
 it('akzeptiert kontextlose Homophone bei reinen Hörwörtern',()=>{const w=vocabulary.find(w=>w.hanzi==='他')!;const e=wordExercise(w,'listening',vocabulary);expect(checkAnswer(e,'sie')).toBe(true);expect(checkAnswer(e,'es')).toBe(true);});
 it('erzeugt keine doppelten Optionen und nicht immer A als Grammatiklösung',()=>{for(const w of vocabulary){const e=wordExercise(w,'context',vocabulary);expect(new Set(e.options).size).toBe(e.options!.length);}expect(new Set(grammar.map(g=>{const e=grammarExercise(g);return e.options!.indexOf(e.answer);})).size).toBeGreaterThan(1);});
 it('macht jede Hanzi-Lesung und jede kommunikative Teilkompetenz übbbar',()=>{for(const h of hanzi)expect(hanziExercise(h).answer).toBeTruthy();for(const t of tasks)expect(taskExercise(t).practiceId).toBe(t.id);});
});
import {createProfile,recordPractice} from '../src/lib/scheduler';
import {exportBackup,parseBackup} from '../src/lib/backup';
import {validIds,validLessonIds,validPracticeIds} from '../src/data/curriculum';
it('übernimmt keine fremden Übungsreferenzen in eine Sicherung',()=>{const p=recordPractice(createProfile(),'not-in-curriculum',true);expect(()=>parseBackup(exportBackup(p),validIds,validLessonIds,validPracticeIds)).toThrow('Unbekannte Übung');});
