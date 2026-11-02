'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {THEME_STORAGE_KEY} from '@/lib/theme';

const ThemeContext=createContext({theme:'dark',toggle:()=>{}});
function storedTheme(){try{const value=localStorage.getItem(THEME_STORAGE_KEY);return ['light','dark'].includes(value)?value:null;}catch{return null;}}

export default function ThemeProvider({children}){
  const [theme,setTheme]=useState('dark');
  function apply(value){
    document.documentElement.dataset.theme=value;
    document.documentElement.style.colorScheme=value;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='light'?'#F3F6FB':'#0B1220');
    setTheme(value);
  }
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: light)');
    const system=()=>media.matches?'light':'dark';
    apply(storedTheme()||system());
    const updateSystem=()=>{if(!storedTheme())apply(system());};
    const updateStorage=e=>{if(e.key===THEME_STORAGE_KEY||e.key===null)apply(storedTheme()||system());};
    media.addEventListener('change',updateSystem);window.addEventListener('storage',updateStorage);
    return()=>{media.removeEventListener('change',updateSystem);window.removeEventListener('storage',updateStorage);};
  },[]);
  function toggle(){const next=document.documentElement.dataset.theme==='light'?'dark':'light';apply(next);try{localStorage.setItem(THEME_STORAGE_KEY,next);}catch{}}
  return <ThemeContext.Provider value={{theme,toggle}}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle(){
  const {theme,toggle}=useContext(ThemeContext),label=theme==='light'?'Switch to dark mode':'Switch to light mode';
  return <button type="button" className="icon-button theme-toggle" onClick={toggle} aria-label={label} title={label}>{theme==='light'?<Moon size={19} aria-hidden="true"/>:<Sun size={19} aria-hidden="true"/>}</button>;
}
