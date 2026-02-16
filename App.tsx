
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VideoAccent, ProductData, GenerationStatus, BulkVoiceOver, VoiceGender, VoiceName, CaptionStyle, TransitionType, ProductNiche, CaptionPosition, GenerationMode, STANDARD_ANGLES, CaptionSettings } from './types';
import { generateBulkScripts, regenerateSingleScript, generateAudio, generateVisualsForScript, regenerateSingleImage, decode, decodeAudioData, createAudioDownloadUrl } from './services/geminiService';
import { auth } from './services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

const VOICES = {
  [VoiceGender.FEMALE]: [VoiceName.KORE, VoiceName.PUCK, VoiceName.DESPINA, VoiceName.AUTONOE, VoiceName.AOEDE, VoiceName.LEDA],
  [VoiceGender.MALE]: [VoiceName.ZEPHYR, VoiceName.FENRIR, VoiceName.CHARON]
};

const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  style: CaptionStyle.TIKTOK_NATIVE,
  position: CaptionPosition.BOTTOM,
  size: 52,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  showCaptions: true
};

const RECIPIENTS = ['Wife', 'Mother', 'Sister', 'Fiancée', 'Friend', 'Self'];
const OCCASIONS = ['Eid', 'Birthday', 'Anniversary', 'Wedding', 'Reward'];

const HOLIDAY_LISTS: Record<string, string[]> = {
  'Arabic': ['Ramadan', 'Eid al-Fitr', 'Eid al-Adha', 'National Day', 'Islamic New Year', 'Mawlid an-Nabi'],
  'Spanish': ['Christmas', 'New Year', 'Semana Santa', 'Independence Day', 'Three Kings Day', 'Dia de los Muertos']
};

export default function App() {
  const [view, setView] = useState<'landing' | 'signin' | 'signup' | 'config' | 'studio' | 'settings'>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // API Key state
  const [inputApiKey, setInputApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  const [product, setProduct] = useState<ProductData>({
    title: '',
    description: '',
    image: '',
    insideImage: '',
    accent: VideoAccent.MOROCCAN_DARIJA,
    gender: VoiceGender.FEMALE,
    voice: VoiceName.KORE,
    niche: ProductNiche.AUTO,
    mode: GenerationMode.ALL_ANGLES,
    targetAngle: 'Hook', 
    variantCount: 4,
    recipient: 'Wife',
    occasion: 'Eid',
    holiday: '',
  });

  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [bulkProgress, setBulkProgress] = useState<number>(0);
  const [bulkResults, setBulkResults] = useState<BulkVoiceOver[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  
  const [playingAudioIdx, setPlayingAudioIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const audioRefs = useRef<{ [key: number]: HTMLAudioElement }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        // In this BYOK architecture, we check if they have a key via the proxy
        try {
          const idToken = await user.getIdToken();
          const check = await fetch('/.netlify/functions/check-key', {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          const { exists } = await check.json();
          setHasApiKey(exists);
        } catch (e) {
          setHasApiKey(false);
        }
        
        if (view === 'landing' || view === 'signin' || view === 'signup') {
          setView('config');
        }
      } else if (!user && view !== 'landing' && view !== 'signin' && view !== 'signup') {
        setView('landing');
      }
    });
    return unsubscribe;
  }, [view]);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputApiKey.trim()) return;
    
    setIsSavingKey(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");
      
      const idToken = await user.getIdToken();
      const response = await fetch('/.netlify/functions/save-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ apiKey: inputApiKey })
      });

      if (!response.ok) throw new Error("Failed to save key");
      
      setHasApiKey(true);
      setInputApiKey('');
      alert("API Key saved securely!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (view === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (view === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setView('landing');
  };

  const detectedHolidays = useMemo(() => {
    const isArabic = [
      VideoAccent.MOROCCAN_DARIJA, VideoAccent.SAUDI, VideoAccent.EGYPTIAN, 
      VideoAccent.LEBANESE, VideoAccent.EMIRATI, VideoAccent.ALGERIAN, VideoAccent.TUNISIAN
    ].includes(product.accent);
    return isArabic ? HOLIDAY_LISTS['Arabic'] : HOLIDAY_LISTS['Spanish'];
  }, [product.accent]);

  useEffect(() => {
    if (product.targetAngle === 'Holiday' && (!product.holiday || !detectedHolidays.includes(product.holiday))) {
      setProduct(p => ({ ...p, holiday: detectedHolidays[0] }));
    }
  }, [product.targetAngle, detectedHolidays]);

  useEffect(() => {
    if (!VOICES[product.gender].includes(product.voice)) {
      setProduct(p => ({ ...p, voice: VOICES[product.gender][0] }));
    }
  }, [product.gender]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'insideImage' = 'image') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProduct(prev => ({ ...prev, [field]: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const startBulkGeneration = async () => {
    if (!product.title || !product.description || !product.image) {
      alert("Please upload product image and fill name/details.");
      return;
    }
    
    if (!hasApiKey) {
      alert("Please enter your Gemini API Key in Settings first.");
      setView('settings');
      return;
    }

    try {
      setStatus('generating_bulk');
      setBulkProgress(5);
      const scripts = await generateBulkScripts(product);
      setBulkProgress(20);
      const enriched: BulkVoiceOver[] = [];
      
      for (let i = 0; i < scripts.length; i++) {
        const item = scripts[i];
        let audio: string | undefined;
        try { 
          audio = await generateAudio(item.script, product.accent, product.voice); 
        } catch (e: any) { 
          console.error(`Audio error for variant ${i+1}:`, e);
        }
        
        enriched[i] = { 
          ...item, 
          audioBase64: audio,
          transitionType: TransitionType.FADE,
          captionSettings: { ...DEFAULT_CAPTION_SETTINGS },
          sceneHistory: {} 
        };
        
        const currentProgress = 20 + Math.floor(((i + 1) / scripts.length) * 80);
        setBulkProgress(currentProgress);
      }
      
      setBulkResults(enriched);
      setStatus('complete');
      setTimeout(() => setBulkProgress(0), 1000);
    } catch (error: any) { 
      setStatus('error');
      alert(error.message || "Generation failed.");
    }
  };

  const generateVisualsForCard = async (idx: number) => {
    if (!product.image) {
      alert("Please upload product image first.");
      return;
    }
    const card = bulkResults[idx];
    if (!card) return;

    try {
      setStatus('generating_visuals');
      const { images, viewTypes } = await generateVisualsForScript(
        product.title,
        card.script,
        product.image,
        product.insideImage,
        product.niche,
        product.accent
      );
      const copy = [...bulkResults];
      const initialHistory: { [key: number]: string[] } = {};
      images.forEach((img, i) => { initialHistory[i] = [img]; });
      
      copy[idx] = { ...card, images, sceneViewTypes: viewTypes, sceneHistory: initialHistory };
      setBulkResults(copy);
      setStatus('complete');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      alert("Visual generation failed.");
    }
  };

  const handlePlayAudio = (idx: number) => {
    if (playingAudioIdx === idx) {
      audioRefs.current[idx]?.pause();
      setPlayingAudioIdx(null);
      return;
    }
    if (playingAudioIdx !== null) audioRefs.current[playingAudioIdx]?.pause();
    const card = bulkResults[idx];
    if (!card?.audioBase64) return;
    if (!audioRefs.current[idx]) {
      const url = createAudioDownloadUrl(card.audioBase64);
      audioRefs.current[idx] = new Audio(url);
      audioRefs.current[idx].onended = () => setPlayingAudioIdx(null);
    }
    audioRefs.current[idx].play();
    setPlayingAudioIdx(idx);
  };

  const handleRegenerateScript = async (idx: number) => {
    const card = bulkResults[idx];
    if (!card) return;
    try {
      setStatus('generating_bulk');
      const newScript = await regenerateSingleScript(product, card.angle);
      const newAudio = await generateAudio(newScript, product.accent, product.voice);
      const copy = [...bulkResults];
      copy[idx] = { ...card, script: newScript, audioBase64: newAudio };
      setBulkResults(copy);
      if (audioRefs.current[idx]) {
        audioRefs.current[idx].pause();
        delete audioRefs.current[idx];
      }
      setStatus('complete');
    } catch (e) {
      setStatus('error');
      alert("Error regenerating script");
    }
  };

  const handleVoiceSync = async (idx: number) => {
    const card = bulkResults[idx];
    if (!card) return;
    try {
      setStatus('generating_bulk');
      const newAudio = await generateAudio(card.script, product.accent, product.voice);
      const copy = [...bulkResults];
      copy[idx] = { ...card, audioBase64: newAudio };
      setBulkResults(copy);
      if (audioRefs.current[idx]) {
        audioRefs.current[idx].pause();
        delete audioRefs.current[idx];
      }
      setStatus('complete');
    } catch (e) {
      setStatus('error');
      alert("Error syncing voice");
    }
  };

  const handleDownloadAudio = (idx: number) => {
    const card = bulkResults[idx];
    if (!card?.audioBase64) return;
    const url = createAudioDownloadUrl(card.audioBase64);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audio-concept-${idx + 1}.wav`;
    a.click();
  };

  const updateCardScript = (idx: number, newScript: string) => {
    const copy = [...bulkResults];
    copy[idx].script = newScript;
    setBulkResults(copy);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#020617] text-white font-sans overflow-hidden flex flex-col relative selection:bg-indigo-500/30">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full animate-pulse delay-700 pointer-events-none" />

        <nav className="p-8 px-12 flex justify-between items-center z-10 border-b border-white/5 backdrop-blur-md bg-black/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black italic">A</div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Creative Assembly</h1>
          </div>
          <div className="flex gap-4 md:gap-8 items-center">
            <button onClick={() => setView('signin')} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Sign In</button>
            <button onClick={() => setView('signup')} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">Sign Up</button>
          </div>
        </nav>

        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
          <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="space-y-4">
              <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.6em] block animate-pulse">Next-Gen UGC Studio</span>
              <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-[0.9] text-white">
                Transform Your Product <br className="hidden md:block" />
                Into <span className="text-indigo-500">Viral Masterpieces</span>
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed">
                The world's first AI-driven UGC studio with deep cultural grounding. 
                Native Arabic and Spanish accents meeting high-fidelity visual consistency.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
              <button onClick={() => setView('signup')} className="group px-12 py-7 bg-indigo-600 rounded-[2.5rem] text-white font-black text-xs uppercase tracking-[0.4em] shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:scale-105 hover:bg-indigo-500 active:scale-95 transition-all">
                Get Access Now <span className="inline-block transition-transform group-hover:translate-x-1 ml-2">→</span>
              </button>
              <button onClick={() => document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' })} className="px-12 py-7 bg-white/5 border border-white/10 rounded-[2.5rem] text-white font-black text-xs uppercase tracking-[0.4em] hover:bg-white/10 transition-all">
                Learn More
              </button>
            </div>

            <div id="benefits" className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 pt-12">
              {[
                { icon: '🌍', title: 'Cultural Dialects', desc: 'Arabic & Spanish native accents.' },
                { icon: '🔍', title: 'Double Ref Logic', desc: 'Inside & outside consistency.' },
                { icon: '🎬', title: 'High-Fidelity AI', desc: '9:16 vertical studio scenes.' },
                { icon: '⚡', title: 'Instant Export', desc: '1080P viral masters.' },
              ].map((benefit, i) => (
                <div key={i} className="bg-white/5 border border-white/5 p-6 rounded-3xl space-y-3 hover:bg-white/10 transition-all cursor-default group">
                  <div className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity">{benefit.icon}</div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{benefit.title}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-tight">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="p-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 border-t border-white/5">
          © 2025 Creative Assembly Andromeda • Built for Viral Success
        </footer>
      </div>
    );
  }

  if (view === 'signin' || view === 'signup') {
    const isSignIn = view === 'signin';
    return (
      <div className="min-h-screen bg-[#020617] text-white font-sans flex items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-600/10 blur-[180px] rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-500/10 blur-[180px] rounded-full animate-pulse delay-700 pointer-events-none" />
        
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[3rem] p-12 space-y-10 z-10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center space-y-4">
            <button onClick={() => setView('landing')} className="text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">← Back to Home</button>
            <h2 className="text-5xl font-black italic tracking-tighter uppercase text-white">{isSignIn ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-slate-500 text-sm font-medium">{isSignIn ? 'Securely access your Andromeda studio' : 'Join the future of high-conversion UGC'}</p>
          </div>

          <div className="space-y-6">
            <form onSubmit={handleAuthSubmit} className="space-y-6">
              {authError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center">
                  {authError}
                </div>
              )}
              {!isSignIn && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    className="w-full bg-black/40 border border-white/5 text-white rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 placeholder:opacity-20"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Email Address</label>
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  required
                  className="w-full bg-black/40 border border-white/5 text-white rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 placeholder:opacity-20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-4 mr-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                  {isSignIn && <button type="button" className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white">Forgot?</button>}
                </div>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required
                  className="w-full bg-black/40 border border-white/5 text-white rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 placeholder:opacity-20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="w-full py-5 bg-indigo-600 rounded-2xl text-white font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-500 transition-all active:scale-95 mt-4">
                {isSignIn ? 'Sign Into Studio' : 'Start Creating'}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-4">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">OR</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <button 
              type="button" 
              onClick={handleGoogleSignIn}
              className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="text-center pt-4">
            <button onClick={() => { setView(isSignIn ? 'signup' : 'signin'); setAuthError(null); }} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
              {isSignIn ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans p-8 md:p-12 xl:p-20 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-600/5 blur-[180px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto space-y-16 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <header className="flex justify-between items-end">
            <div className="space-y-4">
              <button onClick={() => setView('config')} className="text-indigo-500 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 hover:-translate-x-1 transition-transform mb-4">
                <span>←</span> Back to Studio
              </button>
              <h2 className="text-7xl xl:text-8xl font-black italic tracking-tighter uppercase text-white leading-none">Settings</h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Account & API Management</p>
            </div>
            <button onClick={handleSignOut} className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Sign Out</button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#060a18] border border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">User Profile</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-6 p-6 bg-slate-950/50 rounded-3xl border border-white/5">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black italic">
                    {currentUser?.email?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h4 className="text-white font-black text-lg truncate max-w-[150px]">{currentUser?.displayName || 'Studio Creator'}</h4>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Premium Creator</p>
                  </div>
                </div>
                <div className="space-y-2 px-4">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Email Address</label>
                  <p className="text-slate-300 text-sm truncate">{currentUser?.email}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#060a18] border border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Gemini API Key</h3>
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${hasApiKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                  {hasApiKey ? 'Connected' : 'Missing Key'}
                </span>
              </div>
              <div className="space-y-6">
                <p className="text-slate-400 text-xs leading-relaxed font-medium">
                  Connect your personal Gemini API key to unlock high-fidelity generation. 
                  Your key is stored securely in your private account and is never shared.
                </p>
                <form onSubmit={handleSaveApiKey} className="p-6 bg-slate-950 rounded-3xl border border-white/5 space-y-4">
                  <input 
                    type="password" 
                    placeholder="Paste Gemini API Key..." 
                    className="w-full bg-black/40 border border-white/5 text-white rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500 placeholder:opacity-20"
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                  />
                  <button 
                    disabled={isSavingKey}
                    className="w-full py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isSavingKey ? 'Saving...' : (hasApiKey ? 'Update API Key' : 'Save Securely')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'studio' && bulkResults[activePreviewIndex]) {
    return (
      <HybridStudio 
        card={bulkResults[activePreviewIndex]} 
        product={product}
        onClose={() => setView('config')}
        onUpdateCard={(updated: BulkVoiceOver) => {
          const copy = [...bulkResults];
          copy[activePreviewIndex] = updated;
          setBulkResults(copy);
        }}
        onRegenerateImage={async (i: number, instr?: string, instrImg?: string) => {
          const currentCard = bulkResults[activePreviewIndex];
          const isInside = currentCard.sceneViewTypes?.[i] === 'inside';
          const ref = isInside && product.insideImage ? product.insideImage : product.image;
          const res = await regenerateSingleImage(product.title, currentCard.script, i, ref, instr, instrImg, product.accent);
          
          const copy = [...bulkResults];
          const cardCopy = { ...copy[activePreviewIndex] };
          const history = { ...cardCopy.sceneHistory };
          if (!history[i]) history[i] = [currentCard.images![i]];
          history[i] = [...history[i], res];
          cardCopy.sceneHistory = history;
          cardCopy.images![i] = res; 
          copy[activePreviewIndex] = cardCopy;
          setBulkResults(copy);
          return res;
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      {(status === 'generating_bulk' || status === 'generating_visuals') && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="w-full max-w-md p-14 bg-slate-900 rounded-[4rem] border border-slate-800 text-center space-y-12 shadow-2xl">
              <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">AI Sync Engine</h3>
              <div className="space-y-4">
                <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${status === 'generating_visuals' ? 50 : bulkProgress}%` }} />
                </div>
                <span className="text-7xl font-black text-white">{status === 'generating_visuals' ? '50' : bulkProgress}%</span>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">
                {status === 'generating_visuals' ? 'Constructing Virtual Scenes...' : 'Synchronizing Cultural Dialects...'}
              </p>
           </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        <aside className="lg:col-span-3 xl:col-span-3 border-r border-white/5 bg-[#020617]/50 p-8 xl:p-12 space-y-10 overflow-y-auto max-h-screen custom-scrollbar">
          <div className="space-y-6 flex flex-col items-start">
            <div className="flex justify-between items-start w-full">
              <div className="space-y-1">
                <span className="text-indigo-500 text-[10px] font-black uppercase tracking-[0.4em] block">UGC Studio</span>
                <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Config</h1>
              </div>
              <button 
                onClick={() => setView('settings')}
                className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                ⚙️
              </button>
            </div>
          </div>

          {!hasApiKey && (
            <div className="p-6 bg-orange-500/10 border border-orange-500/20 rounded-[2rem] space-y-2 animate-in fade-in slide-in-from-top-4">
              <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest">Missing API Key</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase leading-tight">Connect your Gemini key in Settings to enable AI generation.</p>
              <button onClick={() => setView('settings')} className="text-white text-[10px] font-black underline mt-2 block">Connect Now</button>
            </div>
          )}

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Strategy Mode</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-white/5">
                {Object.values(GenerationMode).map(m => (
                  <button key={m} onClick={() => setProduct({...product, mode: m})} className={`py-3.5 text-[9px] font-black rounded-xl transition-all ${product.mode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {product.mode === GenerationMode.SPECIFIC_ANGLE && (
              <div className="space-y-4 p-5 bg-indigo-500/5 rounded-3xl border border-indigo-500/10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Target Angle</label>
                  <select value={product.targetAngle} onChange={(e) => setProduct({...product, targetAngle: e.target.value})} className="w-full bg-slate-950 border border-white/10 text-white rounded-xl px-4 py-3 text-xs appearance-none focus:border-indigo-500">
                    {STANDARD_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                {product.targetAngle === 'Holiday' && (
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Target Holiday</label>
                    <select value={product.holiday} onChange={(e) => setProduct({...product, holiday: e.target.value})} className="w-full bg-slate-950 border border-emerald-500/20 text-white rounded-xl px-4 py-3 text-xs appearance-none focus:border-emerald-500">
                      {detectedHolidays.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product Niche</label>
              <select value={product.niche} onChange={(e) => setProduct({...product, niche: e.target.value as ProductNiche})} className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-5 py-4 text-xs appearance-none focus:border-indigo-500">
                {Object.values(ProductNiche).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {product.niche === ProductNiche.GIFT && (
              <div className="space-y-4 p-5 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 animate-in fade-in slide-in-from-top-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Recipient (Who is it for?)</label>
                  <select 
                    value={product.recipient} 
                    onChange={(e) => setProduct({...product, recipient: e.target.value})} 
                    className="w-full bg-slate-950 border border-white/10 text-white rounded-xl px-4 py-3 text-xs appearance-none focus:border-indigo-500"
                  >
                    {RECIPIENTS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Occasion (What's the event?)</label>
                  <select 
                    value={product.occasion} 
                    onChange={(e) => setProduct({...product, occasion: e.target.value})} 
                    className="w-full bg-slate-950 border border-white/10 text-white rounded-xl px-4 py-3 text-xs appearance-none focus:border-indigo-500"
                  >
                    {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Variants Quantity</label>
                <span className="text-indigo-400 font-black text-sm">{product.variantCount}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={product.variantCount} 
                onChange={(e) => setProduct({...product, variantCount: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accent</label>
                <select value={product.accent} onChange={(e) => setProduct({...product, accent: e.target.value as VideoAccent})} className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-5 py-4 text-xs appearance-none">
                  {Object.values(VideoAccent).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-white/5">
                {Object.values(VoiceGender).map(g => (
                  <button key={g} onClick={() => setProduct({...product, gender: g})} className={`py-3.5 text-[9px] font-black rounded-xl transition-all ${product.gender === g ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
                    {g.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Main Reference (Outside)</label>
                {product.image ? (
                  <div className="relative group rounded-3xl overflow-hidden h-40 border border-white/5 shadow-2xl">
                    <img src={product.image} className="w-full h-full object-cover" />
                    <button onClick={() => setProduct({...product, image: ''})} className="absolute top-4 right-4 bg-red-500/90 backdrop-blur-md p-2 rounded-full text-white z-10 text-xs hover:bg-red-600 transition-colors">✕</button>
                  </div>
                ) : (
                  <label className="h-40 w-full border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-[10px] uppercase font-black text-slate-600 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
                    <span className="text-xl mb-2 opacity-50">📁</span> Main Photo
                    <input type="file" className="hidden" onChange={(e) => handleImageChange(e, 'image')} accept="image/*" />
                  </label>
                )}
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detail / Inside View</label>
                {product.insideImage ? (
                  <div className="relative group rounded-3xl overflow-hidden h-40 border border-white/5 shadow-2xl">
                    <img src={product.insideImage} className="w-full h-full object-cover" />
                    <button onClick={() => setProduct({...product, insideImage: ''})} className="absolute top-4 right-4 bg-red-500/90 backdrop-blur-md p-2 rounded-full text-white z-10 text-xs hover:bg-red-600 transition-colors">✕</button>
                  </div>
                ) : (
                  <label className="h-40 w-full border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-[10px] uppercase font-black text-slate-600 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
                    <span className="text-xl mb-2 opacity-50">🔍</span> Inside View
                    <input type="file" className="hidden" onChange={(e) => handleImageChange(e, 'insideImage')} accept="image/*" />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <input type="text" placeholder="Product Name" className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-6 py-4 text-xs outline-none focus:border-indigo-500 placeholder:opacity-30" value={product.title} onChange={(e) => setProduct({...product, title: e.target.value})} />
              <textarea rows={4} placeholder="Product description & value prop..." className="w-full bg-slate-950 border border-white/5 text-white rounded-2xl px-6 py-4 text-xs outline-none focus:border-indigo-500 resize-none placeholder:opacity-30" value={product.description} onChange={(e) => setProduct({...product, description: e.target.value})} />
            </div>

            <button onClick={startBulkGeneration} disabled={status === 'generating_bulk'} className="w-full py-6 bg-indigo-600 rounded-3xl text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-indigo-50 active:scale-[0.98] transition-all disabled:opacity-50">
              {status === 'generating_bulk' ? 'Synthesizing...' : `Generate Concepts`}
            </button>
          </div>
        </aside>

        <main className="lg:col-span-9 xl:col-span-9 p-8 md:p-12 xl:p-20 overflow-y-auto max-h-screen custom-scrollbar bg-[#020617]">
          <div className="max-w-6xl mx-auto space-y-16">
            <header className="flex justify-between items-end">
               <div className="space-y-4">
                  <h2 className="text-7xl xl:text-8xl font-black italic tracking-tighter uppercase text-white leading-none">Drafts</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">AI-Generated Strategy Matrix</p>
               </div>
               {bulkResults.length > 0 && (
                 <div className="text-right">
                    <span className="text-indigo-400 font-black text-3xl italic tracking-tighter">{bulkResults.length}</span>
                    <span className="text-slate-600 font-black text-[10px] uppercase tracking-widest block">Available Paths</span>
                 </div>
               )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {(bulkResults.length > 0 ? bulkResults : Array(product.variantCount).fill(null)).map((card, idx) => (
                <div key={idx} className={`bg-[#060a18] border border-white/5 rounded-[4rem] p-12 flex flex-col h-full shadow-3xl transition-all duration-500 group relative ${!card ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:scale-[1.02] hover:bg-[#080d21] hover:shadow-indigo-500/10'}`}>
                  <div className="flex justify-between items-center mb-8">
                    <span className="bg-[#151b2e] text-[#4f6ef7] text-[10px] font-black px-6 py-2.5 rounded-full uppercase tracking-[0.2em]">Concept {idx + 1}</span>
                    <div className="flex gap-2">
                       {card && (
                         <>
                            <button onClick={() => handlePlayAudio(idx)} className="w-10 h-10 bg-slate-900 border border-white/5 rounded-full flex items-center justify-center text-indigo-400 hover:text-white transition-colors" title="Quality Check (Play)">
                               {playingAudioIdx === idx ? '⏸' : '▶'}
                            </button>
                            <button onClick={() => setEditingIdx(editingIdx === idx ? null : idx)} className="w-10 h-10 bg-slate-900 border border-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors" title="Human Touch (Edit)">
                               ✎
                            </button>
                            <button onClick={() => handleRegenerateScript(idx)} className="w-10 h-10 bg-slate-900 border border-white/5 rounded-full flex items-center justify-center text-cyan-400 hover:text-white transition-colors" title="Try Again (Regen Script)">
                               ↺
                            </button>
                            <button onClick={() => handleVoiceSync(idx)} className="w-10 h-10 bg-slate-900 border border-white/5 rounded-full flex items-center justify-center text-orange-400 hover:text-white transition-colors" title="Repair Voice (Voice Sync)">
                               🎙
                            </button>
                            <button onClick={() => handleDownloadAudio(idx)} className="w-10 h-10 bg-slate-900 border border-white/5 rounded-full flex items-center justify-center text-emerald-400 hover:text-white transition-colors" title="Asset Export (Download Audio)">
                               ↓
                            </button>
                         </>
                       )}
                    </div>
                  </div>

                  <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-8 leading-none">{card?.angle || `Waiting...`}</h3>
                  
                  <div className="flex-grow">
                    <div className="bg-[#0f1525] p-8 rounded-[2.5rem] border border-white/5 shadow-inner min-h-[140px]">
                      {editingIdx === idx ? (
                        <textarea 
                          autoFocus
                          className="w-full bg-transparent text-slate-200 text-lg leading-relaxed italic border-none outline-none resize-none"
                          dir="auto"
                          value={card?.script}
                          onChange={(e) => updateCardScript(idx, e.target.value)}
                          onBlur={() => setEditingIdx(null)}
                        />
                      ) : (
                        <p className="text-slate-300 text-lg leading-relaxed italic" dir="auto">{card ? `"${card.script}"` : "Initializing..."}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-10">
                    {card?.images ? (
                      <button onClick={() => { setActivePreviewIndex(idx); setView('studio'); }} className="w-full py-7 bg-indigo-600 text-white text-[11px] font-black rounded-3xl uppercase tracking-[0.4em] shadow-xl hover:bg-indigo-50 transition-all transform active:scale-[0.98]">{status === 'exporting' ? 'Exporting...' : 'Launch Studio'}</button>
                    ) : (
                      <button onClick={() => card && generateVisualsForCard(idx)} disabled={!card} className="w-full py-7 bg-slate-900 text-slate-500 text-[11px] font-black rounded-3xl border border-white/5 uppercase tracking-[0.4em] hover:text-white transition-all disabled:opacity-50">Generate Visuals</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 40px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      `}</style>
    </div>
  );
}

function HybridStudio({ card, product, onClose, onUpdateCard, onRegenerateImage }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [nextFrame, setNextFrame] = useState<number | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  
  const [refinementText, setRefinementText] = useState("");
  const [refinementImage, setRefinementImage] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const scriptSegments = useMemo(() => {
    if (!card.script) return [];
    const parts = card.script.match(/[^.!?]+[.!?]+/g) || [card.script];
    const targetCount = card.images?.length || 6;
    const result: string[] = [];
    for (let i = 0; i < targetCount; i++) {
        result.push(parts[Math.floor((i / targetCount) * parts.length)]?.trim() || "");
    }
    return result;
  }, [card.script, card.images]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.pause();
    if (card.audioBase64) {
      audioRef.current = new Audio(createAudioDownloadUrl(card.audioBase64));
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [card.audioBase64]);

  const togglePlayback = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      setIsPlaying(false);
      setNextFrame(null);
      setTransitionProgress(0);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
      let f = 0;
      const step = () => {
        if (f >= (card.images?.length || 6)) { setIsPlaying(false); return; }
        
        setCurrentFrame(f);
        const duration = 2000;
        const transitionTime = (card.transitionType === TransitionType.NONE || card.transitionType === TransitionType.HARD_CUT) ? 0 : 500;
        
        if (transitionTime > 0 && f < (card.images?.length || 6) - 1) {
          playbackTimeoutRef.current = window.setTimeout(() => {
             setNextFrame(f + 1);
             let start = Date.now();
             const anim = () => {
                let p = (Date.now() - start) / transitionTime;
                if (p < 1) {
                  setTransitionProgress(p);
                  requestAnimationFrame(anim);
                } else {
                  setTransitionProgress(0);
                  setNextFrame(null);
                  f++;
                  step();
                }
             };
             requestAnimationFrame(anim);
          }, duration - transitionTime);
        } else {
          playbackTimeoutRef.current = window.setTimeout(() => {
            f++;
            step();
          }, duration);
        }
      };
      step();
    }
  };

  const handleMagicRefine = async () => {
    if (!refinementText && !refinementImage) return;
    setIsRegenerating(true);
    try {
      await onRegenerateImage(currentFrame, refinementText, refinementImage);
      setRefinementText("");
      setRefinementImage(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleManualRegen = async (i: number) => {
    setIsRegenerating(true);
    try {
      await onRegenerateImage(i);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleReplaceClick = () => {
    replaceInputRef.current?.click();
  };

  const handleDownloadScene = (imgBase64: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imgBase64}`;
    link.download = `creative-assembly-scene-${index + 1}.png`;
    link.click();
  };

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const copy = { ...card };
        const base64 = (reader.result as string).split(',')[1];
        copy.images[currentFrame] = base64;
        if (!copy.sceneHistory[currentFrame]) copy.sceneHistory[currentFrame] = [];
        copy.sceneHistory[currentFrame] = [...copy.sceneHistory[currentFrame], base64];
        onUpdateCard(copy);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRefineImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setRefinementImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const switchVersion = (sceneIndex: number, versionIdx: number) => {
    const history = card.sceneHistory?.[sceneIndex];
    if (history && history[versionIdx]) {
      const copy = { ...card };
      copy.images[sceneIndex] = history[versionIdx];
      onUpdateCard(copy);
    }
  };

  const handleExport = async () => {
    setExportProgress(0);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setExportProgress(null); return; }

    const stream = canvas.captureStream(30);
    let finalStream = stream;
    if (audioRef.current && card.audioBase64) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(audioRef.current);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioCtx.destination);
        finalStream = new MediaStream([...stream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } catch (err) {
        console.error("Audio mixing failed", err);
      }
    }

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Creative_Assembly_UGC.webm`;
        a.click();
        setExportProgress(null);
        if (audioRef.current) audioRef.current.pause();
    };
    
    recorder.start();

    const FPS = 30;
    const SCENE_DURATION_MS = 2000;
    const TRANSITION_DURATION_MS = (card.transitionType === TransitionType.NONE || card.transitionType === TransitionType.HARD_CUT) ? 0 : 500;
    const framesPerScene = (SCENE_DURATION_MS / 1000) * FPS;
    const framesPerTransition = (TRANSITION_DURATION_MS / 1000) * FPS;
    const scenes = card.images || [];
    
    for (let i = 0; i < scenes.length; i++) {
        const currentImg = new Image();
        currentImg.src = `data:image/png;base64,${scenes[i]}`;
        await new Promise(resolve => currentImg.onload = resolve);

        let nextImg: HTMLImageElement | null = null;
        if (i < scenes.length - 1 && TRANSITION_DURATION_MS > 0) {
            nextImg = new Image();
            nextImg.src = `data:image/png;base64,${scenes[i+1]}`;
            await new Promise(resolve => nextImg.onload = resolve);
        }

        const staticFrames = framesPerScene - (nextImg ? framesPerTransition : 0);
        for (let f = 0; f < staticFrames; f++) {
            renderFrame(ctx, canvas, currentImg, 1.0, 0, 1.0, card, i, scriptSegments[i]);
            await new Promise(r => setTimeout(r, 1000/FPS));
            setExportProgress(Math.floor(((i + f/framesPerScene) / scenes.length) * 100));
        }

        if (nextImg) {
            for (let f = 0; f < framesPerTransition; f++) {
                const progress = f / framesPerTransition;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (card.transitionType === TransitionType.FADE) {
                    renderFrame(ctx, canvas, currentImg, 1 - progress, 0, 1.0, card, i, scriptSegments[i]);
                    renderFrame(ctx, canvas, nextImg, progress, 0, 1.0, null, -1, "");
                } else if (card.transitionType === TransitionType.SLIDE) {
                    renderFrame(ctx, canvas, currentImg, 1.0, -progress * canvas.width, 1.0, card, i, scriptSegments[i]);
                    renderFrame(ctx, canvas, nextImg, 1.0, canvas.width - progress * canvas.width, 1.0, null, -1, "");
                } else if (card.transitionType === TransitionType.ZOOM || card.transitionType === TransitionType.MOTION_BLUR) {
                    if (card.transitionType === TransitionType.MOTION_BLUR) {
                        const blurAmount = Math.sin(progress * Math.PI) * 20;
                        ctx.filter = `blur(${blurAmount}px)`;
                    }
                    renderFrame(ctx, canvas, currentImg, 1 - progress, 0, 1.0 + progress * 0.5, card, i, scriptSegments[i]);
                    renderFrame(ctx, canvas, nextImg, progress, 0, 1.5 - progress * 0.5, null, -1, "");
                    ctx.filter = 'none';
                } else {
                    renderFrame(ctx, canvas, nextImg, 1.0, 0, 1.0, card, i, scriptSegments[i]);
                }
                await new Promise(r => setTimeout(r, 1000/FPS));
            }
        }
    }
    setExportProgress(100);
    setTimeout(() => recorder.stop(), 500);
  };

  const renderFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, img: HTMLImageElement, opacity: number, xOffset: number, scale: number, cardData: any, sceneIdx: number, caption: string) => {
    ctx.globalAlpha = opacity;
    const sw = canvas.width * scale;
    const sh = canvas.height * scale;
    const sx = (canvas.width - sw) / 2 + xOffset;
    const sy = (canvas.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
    if (cardData?.captionSettings?.showCaptions && caption) {
        const fontSize = cardData.captionSettings.size * 1.5;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const metrics = ctx.measureText(caption);
        const bgWidth = metrics.width + 80;
        const bgHeight = fontSize * 1.6;
        const x = (canvas.width - bgWidth) / 2 + xOffset;
        let y = cardData.captionSettings.position === CaptionPosition.TOP ? 300 : cardData.captionSettings.position === CaptionPosition.CENTER ? canvas.height / 2 : canvas.height - 400;
        ctx.fillStyle = cardData.captionSettings.backgroundColor + 'CC';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y - bgHeight/2, bgWidth, bgHeight, 40);
        else ctx.rect(x, y - bgHeight/2, bgWidth, bgHeight);
        ctx.fill();
        ctx.fillStyle = cardData.captionSettings.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(caption, canvas.width / 2 + xOffset, y);
    }
    ctx.globalAlpha = 1.0;
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-[#020617] animate-in fade-in duration-500 overflow-y-auto custom-scrollbar text-slate-200 font-sans">
      <input type="file" ref={replaceInputRef} className="hidden" accept="image/*" onChange={handleReplaceFile} />
      {(exportProgress !== null || isRegenerating) && (
        <div className="fixed inset-0 z-[2000] bg-[#020617]/98 flex flex-col items-center justify-center text-center space-y-12 animate-in fade-in zoom-in-95 duration-500">
           <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              <h3 className="absolute inset-0 flex items-center justify-center text-4xl font-black italic text-white uppercase tracking-tighter">AI</h3>
           </div>
           <div className="space-y-4">
              <h3 className="text-3xl font-black italic tracking-tighter text-white uppercase">{exportProgress !== null ? "Assembling 1080P Master" : "Syncing Logic..."}</h3>
              {exportProgress !== null && (
                <div className="w-96 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                   <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                </div>
              )}
           </div>
        </div>
      )}

      <div className="min-h-screen flex flex-col relative">
        <header className="sticky top-0 p-8 px-12 bg-black/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center z-[100]">
          <div className="flex items-center gap-6">
             <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Creative Assembly</h1>
             <div className="h-8 w-px bg-white/10 hidden md:block" />
             <span className="hidden md:block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Master Strategy Mode</span>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all">
            <span className="text-2xl">✕</span>
          </button>
        </header>

        <main className="flex-1 bg-[#040815] p-6 md:p-10 xl:p-16">
          <div className="max-w-[1700px] mx-auto grid grid-cols-1 xl:grid-cols-[480px_1fr] gap-10 xl:gap-20">
            <div className="flex flex-col items-center xl:sticky xl:top-32 xl:h-fit">
               <div className="relative group w-full max-w-[400px]">
                  <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full opacity-50 pointer-events-none" />
                  <div className="relative aspect-[9/16] bg-black rounded-[4.5rem] overflow-hidden border-[16px] border-[#0c1325] shadow-[0_80px_150px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
                     <div className="relative w-full h-full">
                        <img src={`data:image/png;base64,${card.images?.[currentFrame]}`} className="absolute inset-0 w-full h-full object-cover transition-all duration-700" 
                          style={{ 
                            opacity: nextFrame !== null ? 1 - transitionProgress : 1,
                            transform: (card.transitionType === TransitionType.ZOOM || card.transitionType === TransitionType.MOTION_BLUR) && nextFrame !== null ? `scale(${1 + transitionProgress * 0.5})` : 'scale(1)',
                            left: card.transitionType === TransitionType.SLIDE && nextFrame !== null ? `${-transitionProgress * 100}%` : '0',
                            filter: (card.transitionType === TransitionType.MOTION_BLUR) && nextFrame !== null ? `blur(${Math.sin(transitionProgress * Math.PI) * 10}px)` : 'none'
                          }} 
                        />
                        {nextFrame !== null && (
                           <img src={`data:image/png;base64,${card.images?.[nextFrame]}`} className="absolute inset-0 w-full h-full object-cover transition-all duration-700" 
                            style={{ 
                              opacity: (card.transitionType === TransitionType.FADE || card.transitionType === TransitionType.ZOOM || card.transitionType === TransitionType.MOTION_BLUR) ? transitionProgress : 1,
                              transform: (card.transitionType === TransitionType.ZOOM || card.transitionType === TransitionType.MOTION_BLUR) ? `scale(${1.5 - transitionProgress * 0.5})` : 'scale(1)',
                              left: card.transitionType === TransitionType.SLIDE ? `${100 - transitionProgress * 100}%` : '0',
                              filter: (card.transitionType === TransitionType.MOTION_BLUR) ? `blur(${Math.sin(transitionProgress * Math.PI) * 10}px)` : 'none'
                            }} 
                           />
                        )}
                     </div>
                     {card.captionSettings?.showCaptions && (
                        <div className={`absolute inset-x-0 px-10 text-center z-30 transition-all duration-500 ${card.captionSettings.position === CaptionPosition.TOP ? 'top-20' : card.captionSettings.position === CaptionPosition.CENTER ? 'top-1/2 -translate-y-1/2' : 'bottom-32'}`}>
                          <span className="font-black leading-tight shadow-xl px-10 py-6 rounded-[2.5rem] italic tracking-tight backdrop-blur-3xl inline-block animate-in slide-in-from-bottom-6"
                            style={{ fontSize: `${card.captionSettings.size}px`, color: card.captionSettings.textColor, backgroundColor: `${card.captionSettings.backgroundColor}F0` }}>
                            {scriptSegments[nextFrame !== null ? nextFrame : currentFrame]}
                          </span>
                        </div>
                     )}
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-300" onClick={togglePlayback}>
                        <div className="w-20 h-20 bg-white text-black rounded-full shadow-2xl flex items-center justify-center text-4xl">{isPlaying ? '⏸' : '▶'}</div>
                     </div>
                  </div>
               </div>
               <div className="mt-8 flex gap-3 items-center flex-wrap justify-center max-w-[400px]">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Scene {currentFrame+1} Versions:</span>
                  {(card.sceneHistory?.[currentFrame] || [card.images?.[currentFrame]]).map((img: string, vIdx: number) => {
                    const isActive = card.images?.[currentFrame] === img;
                    return (
                      <button key={vIdx} onClick={() => switchVersion(currentFrame, vIdx)} className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all flex items-center justify-center ${isActive ? 'bg-indigo-600 text-white scale-110 shadow-[0_10px_20px_rgba(79,70,229,0.4)]' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'}`}>V{vIdx + 1}</button>
                    )
                  })}
               </div>
            </div>

            <div className="flex flex-col gap-10">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-[#0c1325]/40 border border-white/5 rounded-[3rem] p-10 space-y-6 shadow-2xl">
                     <div className="flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Editable Script</h3>
                        <button onClick={togglePlayback} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">{isPlaying ? 'Pause' : 'Play'}</button>
                     </div>
                     <textarea value={card.script} onChange={(e) => onUpdateCard({...card, script: e.target.value})} 
                       className="w-full bg-transparent text-slate-200 text-3xl font-black leading-tight italic outline-none resize-none h-44 focus:text-white placeholder:opacity-20" dir="auto" placeholder="Baddel l-klam hna..." />
                  </div>
                  <div className="bg-[#0c1325]/40 border border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Transition Effects</h3>
                     <div className="space-y-4">
                        {Object.values(TransitionType).map(t => (
                          <button key={t} onClick={() => onUpdateCard({...card, transitionType: t})} className={`w-full py-4 px-8 text-left rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${card.transitionType === t ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-white/5 text-slate-500'}`}>{t}</button>
                        ))}
                     </div>
                  </div>
                  <div className="md:col-span-2 bg-[#0c1325]/40 border border-white/5 rounded-[3rem] p-12 space-y-10 shadow-2xl border-indigo-500/10 bg-indigo-500/5">
                     <div className="flex justify-between items-center">
                        <div className="space-y-1">
                           <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">Magic Refinement</h3>
                           <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Adjust this specific scene with natural instructions</p>
                        </div>
                        {isRegenerating && <div className="text-[10px] font-black text-indigo-400 animate-pulse tracking-widest uppercase">Syncing Logic...</div>}
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-8">
                        <div className="space-y-4">
                           <input type="text" placeholder="e.g. 'Make it more sunny', 'Zid wahed l-laptop f jinb', 'Change lighting to gold'..." className="w-full bg-slate-950 border border-white/10 text-white px-8 py-6 rounded-3xl text-xs outline-none focus:border-indigo-500 placeholder:opacity-30" value={refinementText} onChange={(e) => setRefinementText(e.target.value)} />
                           <div className="flex items-center gap-6">
                              <label className="flex-1 cursor-pointer bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4 hover:border-indigo-500/50 transition-all">
                                 <span className="text-xl">🖼️</span>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{refinementImage ? "Ref Image Added" : "Add Reference Instruction Image"}</span>
                                 <input type="file" className="hidden" onChange={handleRefineImageUpload} accept="image/*" />
                              </label>
                              {refinementImage && <button onClick={() => setRefinementImage(null)} className="text-red-400 text-xs font-black uppercase">Remove</button>}
                           </div>
                        </div>
                        <button onClick={handleMagicRefine} disabled={isRegenerating || (!refinementText && !refinementImage)} className="h-full bg-white text-black font-black uppercase text-[10px] tracking-[0.4em] rounded-3xl hover:bg-indigo-50 transition-all shadow-xl active:scale-[0.98] disabled:opacity-20">Sync Scene</button>
                     </div>
                  </div>
                  <div className="md:col-span-2 bg-[#0c1325]/40 border border-white/5 rounded-[3rem] p-12 grid grid-cols-1 md:grid-cols-3 gap-12 shadow-2xl">
                     <div className="space-y-8">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Style & Layout</h3>
                        <div className="space-y-4">
                           <select value={card.captionSettings?.style} onChange={(e) => onUpdateCard({...card, captionSettings: {...card.captionSettings, style: e.target.value as CaptionStyle}})} className="w-full bg-slate-950 border border-white/5 text-white px-6 py-5 rounded-2xl text-[10px] font-black appearance-none">
                              {Object.values(CaptionStyle).map(s => <option key={s} value={s}>{s}</option>)}
                           </select>
                           <select value={card.captionSettings?.position} onChange={(e) => onUpdateCard({...card, captionSettings: {...card.captionSettings, position: e.target.value as CaptionPosition}})} className="w-full bg-slate-950 border border-white/5 text-white px-6 py-5 rounded-2xl text-[10px] font-black appearance-none">
                              {Object.values(CaptionPosition).map(p => <option key={p} value={p}>{p}</option>)}
                           </select>
                        </div>
                     </div>
                     <div className="space-y-8">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Scale & Chromatics</h3>
                        <div className="space-y-6">
                           <input type="range" min="20" max="100" value={card.captionSettings?.size} onChange={(e) => onUpdateCard({...card, captionSettings: {...card.captionSettings, size: parseInt(e.target.value)}})} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                           <div className="grid grid-cols-2 gap-4">
                              <input type="color" value={card.captionSettings?.textColor} onChange={(e) => onUpdateCard({...card, captionSettings: {...card.captionSettings, textColor: e.target.value}})} className="w-full h-14 rounded-2xl bg-transparent border-none p-0 cursor-pointer" />
                              <input type="color" value={card.captionSettings?.backgroundColor} onChange={(e) => onUpdateCard({...card, captionSettings: {...card.captionSettings, backgroundColor: e.target.value}})} className="w-full h-14 rounded-2xl bg-transparent border-none p-0 cursor-pointer" />
                           </div>
                        </div>
                     </div>
                     <div className="flex flex-col justify-end gap-6">
                        <div className="flex justify-between items-center p-6 bg-slate-950 rounded-3xl border border-white/5">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Text</span>
                           <input type="checkbox" className="w-6 h-6 rounded-lg bg-slate-800 accent-indigo-600" checked={card.captionSettings?.showCaptions} onChange={(e) => onUpdateCard({...card, captionSettings: {...card.captionSettings, showCaptions: e.target.checked}})} />
                        </div>
                        <button onClick={handleExport} className="w-full py-7 bg-white text-black rounded-3xl font-black text-xs uppercase tracking-[0.4em] shadow-[0_20px_60px_-15px_rgba(255,255,255,0.4)] hover:scale-[1.03] transition-all">Export 1080P Master</button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </main>

        <footer className="bg-black border-t border-white/5 p-10 px-12 z-30 shadow-[0_-20px_80px_rgba(0,0,0,0.8)]">
          <div className="max-w-[1700px] mx-auto space-y-6">
             <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">Scene Logic Mapping (High Fidelity)</h4>
             <div className="flex gap-8 overflow-x-auto pb-6 custom-scrollbar snap-x">
                {card.images?.map((img: string, i: number) => {
                  const history = card.sceneHistory?.[i] || [img];
                  const currentIdx = history.indexOf(img);
                  return (
                    <div key={i} onClick={() => setCurrentFrame(i)} className={`relative flex-shrink-0 w-48 aspect-[9/16] rounded-[2rem] overflow-hidden border-4 cursor-pointer transition-all duration-500 snap-center ${currentFrame === i ? 'border-indigo-600 scale-105 shadow-2xl' : 'border-white/5 opacity-40 hover:opacity-100'}`}>
                      <img src={`data:image/png;base64,${img}`} className="w-full h-full object-cover" />
                      <div className="absolute top-4 left-4 flex flex-col gap-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black ${currentFrame === i ? 'bg-indigo-600 text-white' : 'bg-black/80 text-white/50'}`}>{i + 1}</div>
                        {history.length > 1 && <div className="bg-black/80 text-cyan-400 text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-widest text-center">V{currentIdx + 1}</div>}
                      </div>
                      {currentFrame === i && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 gap-3 animate-in fade-in backdrop-blur-sm duration-300">
                           <button onClick={(e) => { e.stopPropagation(); handleManualRegen(i); }} className="w-full py-2 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest">Regen</button>
                           <button onClick={(e) => { e.stopPropagation(); handleReplaceClick(); }} className="w-full py-2 bg-slate-900 text-slate-300 text-[9px] font-black rounded-lg border border-white/10 uppercase tracking-widest">Replace</button>
                           <button onClick={(e) => { e.stopPropagation(); handleDownloadScene(img, i); }} className="w-full py-2 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center justify-center gap-1">
                             <span>↓</span> Download
                           </button>
                        </div>
                      )}
                    </div>
                  )
                })}
             </div>
          </div>
        </footer>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 40px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}
