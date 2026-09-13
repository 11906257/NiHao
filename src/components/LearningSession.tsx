import { useEffect, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { wordById, vocabulary, grammarById } from '../data/curriculum';
import type { Grammar } from '../data/types';
import { grammarExercise, wordExercise, type Exercise } from '../lib/exercises';
import type { ReviewRating } from '../lib/scheduler';
import { AudioButton, ExampleTranslation, ProgressBar } from './ui';
import { ExerciseRunner } from './ExerciseRunner';
export function LearningSession({ids,grammarIds=[],title,onResult,onComplete,onClose}:{ids:string[];grammarIds?:string[];title:string;onResult:(e:Exercise,r:ReviewRating)=>void;onComplete:()=>void;onClose:()=>void}){
 const [step,setStep]=useState(0);useEffect(()=>{window.scrollTo(0,0);},[step]);const points=grammarIds.map(id=>grammarById[id]).filter((g):g is Grammar=>!!g);const total=ids.length+points.length;
 const exercises=[...ids.map(id=>wordExercise(wordById[id],'meaning',vocabulary)),...points.map(grammarExercise),...ids.map((id,i)=>wordExercise(wordById[id],i%2?'context':'production',vocabulary))];
 if(step>=total)return <ExerciseRunner exercises={exercises} title={title} onResult={onResult} onComplete={onComplete} onClose={onClose}/>;
 const word=step<ids.length?wordById[ids[step]]:undefined;const point=points[step-ids.length];
 return <div className="study-shell"><div className="study-top"><span>{title}</span><button className="icon-button" onClick={onClose} aria-label="Lerneinheit schließen"><X/></button></div><ProgressBar value={step} max={total} label="Kennenlernen"/><article className="intro-card"><span className="eyebrow">{word?'Ein neues Wort':'Ein Satzmuster'} · {step+1} / {total}</span>{word?<><h1 lang="zh-CN" className="chinese intro-hanzi">{word.hanzi}</h1><p className="intro-pinyin">{word.pinyin}</p><h2>{word.meaning}</h2><div className="listen-area"><AudioButton text={word.hanzi} label="Anhören"/></div>{word.note&&<p className="note">{word.note}</p>}<ExampleTranslation example={word.example}/></>:<><h1>{point.title}</h1><p>{point.explanation}</p><div className="pattern">{point.pattern}</div><ExampleTranslation example={point.example}/></>}<button className="button primary full" onClick={()=>setStep(step+1)}>{step===total-1?'Jetzt aktiv erinnern':'Weiter'} {step===total-1?<Check size={18}/>:<ArrowRight size={18}/>}</button></article></div>;
}
