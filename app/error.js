'use client';
export default function ErrorPage({reset}){return <main className="workspace-gate"><section><span className="gate-brand">FINN</span><h1>We couldn’t load this view.</h1><p>Your saved documents and portfolio data remain in storage. Try loading the view again.</p><button className="button primary" onClick={()=>reset()}>Try again</button></section></main>;}
