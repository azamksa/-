import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Settings, Volume2, Globe, Type, Plus, Minus, Volume1 } from 'lucide-react';
import { processTextForReading, generateSpeech } from './services/gemini';

const VOICES = [
  { id: 'Kore', name: 'صوت هادئ (Kore)' },
  { id: 'Zephyr', name: 'صوت قوي (Zephyr)' },
  { id: 'Puck', name: 'صوت حيوي (Puck)' },
  { id: 'Charon', name: 'صوت عميق (Charon)' },
  { id: 'Fenrir', name: 'صوت حازم (Fenrir)' },
];

export default function App() {
  const [text, setText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  // Audio Context Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Update volume dynamically
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Update speed dynamically
  useEffect(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = speed;
    }
  }, [speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const playAudio = async (base64Audio: string) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
      gainNodeRef.current.gain.value = volume;
    }
    
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    let audioBuffer: AudioBuffer;
    
    try {
      // Try decoding as WAV/MP3
      audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
    } catch (e) {
      // Fallback to raw PCM 16-bit 24kHz
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
      }
      audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
    }
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNodeRef.current!);
    source.playbackRate.value = speed;
    
    source.onended = () => {
      setIsReading(false);
    };
    
    sourceNodeRef.current = source;
    source.start(0);
    setIsReading(true);
  };

  const handleRead = async () => {
    if (!text.trim()) return;

    handleStop(); // Stop any current playback
    setIsTranslating(true);

    try {
      // 1. Process Text (Check if Arabic, translate if not)
      const { text: finalArabicText, wasTranslated } = await processTextForReading(text);
      if (wasTranslated) {
        setTranslatedText(finalArabicText);
      } else {
        setTranslatedText(''); // Clear if it was already Arabic
      }
      
      // 2. Generate High-Quality Speech using Gemini TTS
      const base64Audio = await generateSpeech(finalArabicText, selectedVoice);
      
      // 3. Play Audio
      await playAudio(base64Audio);

    } catch (error) {
      console.error("Processing failed", error);
      alert("فشلت معالجة النص. يرجى التحقق من اتصالك والمحاولة مرة أخرى.");
      setIsReading(false);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleStop = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsReading(false);
  };

  const increaseSpeed = () => setSpeed(s => Math.min(2, s + 0.1));
  const decreaseSpeed = () => setSpeed(s => Math.max(0.5, s - 0.1));

  const increaseVolume = () => setVolume(v => Math.min(1, v + 0.1));
  const decreaseVolume = () => setVolume(v => Math.max(0, v - 0.1));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center p-4 sm:p-8 font-sans" dir="rtl">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <header className="flex justify-between items-center py-4">
          <h1 className="text-4xl font-bold flex items-center gap-4 text-emerald-400">
            <Volume2 className="w-10 h-10" />
            اقرأ
          </h1>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-4 rounded-2xl transition-colors ${showSettings ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400'}`}
            aria-label="الإعدادات"
          >
            <Settings className="w-8 h-8" />
          </button>
        </header>

        {showSettings && (
          <div className="bg-zinc-900 p-6 sm:p-8 rounded-3xl flex flex-col gap-8 shadow-xl border border-zinc-800 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-2xl font-semibold flex items-center gap-3">
              <Settings className="w-6 h-6 text-emerald-400" />
              إعدادات الصوت
            </h2>
            
            <div className="flex flex-col gap-3">
              <label className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                اختيار القارئ (مدعوم بالذكاء الاصطناعي)
              </label>
              <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-4 text-xl focus:border-emerald-500 focus:ring-0 outline-none transition-colors"
                dir="ltr"
              >
                {VOICES.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-lg font-medium text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Volume1 className="w-5 h-5" />
                  قوة الصوت
                </span>
                <span className="text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded-lg" dir="ltr">
                  {Math.round(volume * 100)}%
                </span>
              </label>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={increaseVolume}
                  className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-300 transition-colors active:scale-95"
                  aria-label="زيادة الصوت"
                >
                  <Plus className="w-6 h-6" />
                </button>
                
                <div className="flex-1 flex flex-col gap-2">
                  <input 
                    type="range" 
                    min="0" max="1" step="0.05" 
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-4 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    dir="ltr"
                  />
                </div>

                <button 
                  onClick={decreaseVolume}
                  className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-300 transition-colors active:scale-95"
                  aria-label="تقليل الصوت"
                >
                  <Minus className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <label className="text-lg font-medium text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  سرعة القراءة
                </span>
                <span className="text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded-lg" dir="ltr">
                  {speed.toFixed(1)}x
                </span>
              </label>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={increaseSpeed}
                  className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-300 transition-colors active:scale-95"
                  aria-label="زيادة السرعة"
                >
                  <Plus className="w-6 h-6" />
                </button>
                
                <div className="flex-1 flex flex-col gap-2">
                  <input 
                    type="range" 
                    min="0.5" max="2" step="0.1" 
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full h-4 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    dir="ltr"
                  />
                  <div className="flex justify-between text-sm text-zinc-500 font-medium px-1">
                    <span>أسرع</span>
                    <span>عادي</span>
                    <span>أبطأ</span>
                  </div>
                </div>

                <button 
                  onClick={decreaseSpeed}
                  className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-300 transition-colors active:scale-95"
                  aria-label="تقليل السرعة"
                >
                  <Minus className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative group">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="قم بلصق أو كتابة النص هنا لقراءته بصوت عالٍ..."
            className="w-full h-[40vh] min-h-[300px] bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 sm:p-8 text-2xl sm:text-3xl leading-relaxed focus:border-emerald-500 focus:ring-0 outline-none resize-none placeholder-zinc-600 transition-colors shadow-inner"
          />
          {!text && (
            <div className="absolute top-8 left-8 right-8 pointer-events-none flex flex-col items-center justify-center h-[calc(100%-4rem)] text-zinc-600 gap-4">
              <Type className="w-16 h-16 opacity-20" />
              <p className="text-center text-xl">انقر هنا للبدء في كتابة أو لصق النص</p>
            </div>
          )}
        </div>

        {translatedText && text !== translatedText && (
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-3xl p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-emerald-500 text-sm font-bold uppercase tracking-widest">
              <Globe className="w-4 h-4" />
              النص المترجم (لأنه لم يكن بالعربية)
            </div>
            <p className="text-2xl sm:text-3xl leading-relaxed text-zinc-200">
              {translatedText}
            </p>
          </div>
        )}

        <div className="mt-4 pb-12">
          {!isReading ? (
            <button
              onClick={handleRead}
              disabled={!text.trim() || isTranslating}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-3xl sm:text-4xl py-8 sm:py-10 rounded-[2rem] flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(16,185,129,0.2)] hover:shadow-[0_0_60px_rgba(16,185,129,0.3)]"
            >
              {isTranslating ? (
                <span className="animate-pulse flex items-center gap-4">
                  جاري المعالجة...
                </span>
              ) : (
                <>
                  <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current" />
                  استمع للنص
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full bg-red-500 hover:bg-red-400 text-white font-black text-3xl sm:text-4xl py-8 sm:py-10 rounded-[2rem] flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-[0_0_40px_rgba(239,68,68,0.2)] hover:shadow-[0_0_60px_rgba(239,68,68,0.3)]"
            >
              <Square className="w-10 h-10 sm:w-12 sm:h-12 fill-current" />
              إيقاف الاستماع
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
