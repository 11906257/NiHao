import { afterEach, expect, it, vi } from 'vitest';
import { AUDIO_RATES, setAudioRate, speakChinese, stopAudio } from '../src/lib/audio';
afterEach(()=>{stopAudio();setAudioRate(AUDIO_RATES.normal);vi.unstubAllGlobals();});
it('uses the global tempo for every playback and applies changes immediately',async()=>{
 const rates:number[]=[];
 vi.stubGlobal('window',{speechSynthesis:{getVoices:()=>[{lang:'zh-CN',localService:true,name:'Mandarin'}],cancel:()=>{},resume:()=>{},speak:(u:{rate:number;onend:()=>void})=>{rates.push(u.rate);u.onend();}}});
 vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(public text:string){}});
 for(const rate of [AUDIO_RATES.slow,AUDIO_RATES.normal,AUDIO_RATES.fast]){
   setAudioRate(rate);await speakChinese('你好');await speakChinese('我在学习汉语。');
 }
 expect(rates).toEqual([0.1,0.1,0.9,0.9,1.2,1.2]);
});
