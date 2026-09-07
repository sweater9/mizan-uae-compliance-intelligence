"use client";

import { FormEvent, useRef, useState } from "react";

type SearchRecord = {
  id: string;
  title: string;
  instrumentType: string;
  instrumentNumber?: string;
  authority: string;
  jurisdiction: string;
  status: string;
  effectiveDate?: string;
  summary: string;
  applicability: string[];
  obligations: string[];
  officialSourceUrl: string;
  sourceAuthority: string;
  lastVerifiedAt: string;
  evidenceStatus: "official-verified";
};

type EvidenceSource = { title: string; url: string; authority: string; lastVerifiedAt: string };

function apiBase() {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("invalid_response");
  return response.json() as Promise<T>;
}

export default function Home() {
  const [screen, setScreen] = useState<"home" | "search" | "ask">("home");
  return <main>
    <Header screen={screen} go={setScreen}/>
    {screen === "home" && <Landing go={setScreen}/>} 
    {screen === "search" && <RegulatorySearch/>}
    {screen === "ask" && <AskMizan/>}
    <footer className="sitefoot"><div><b>Mizan</b><span>UAE Regulatory Intelligence</span></div><p>Regulatory information is provided for research and operational support. Confirm requirements with the cited authority or a qualified adviser where appropriate.</p></footer>
  </main>;
}

function Header({screen, go}:{screen:string;go:(screen:"home"|"search"|"ask")=>void}) {
  return <header>
    <button className="brand" onClick={()=>go("home")}><i>م</i><b>Mizan</b><small>UAE REGULATORY INTELLIGENCE</small></button>
    <nav>
      <button className={screen === "search" ? "active" : ""} onClick={()=>go("search")}>Regulatory Search</button>
      <button className={screen === "ask" ? "active" : ""} onClick={()=>go("ask")}>Ask Mizan</button>
      <button onClick={()=>go("home")}>Platform</button>
    </nav>
  </header>;
}

function Landing({go}:{go:(screen:"home"|"search"|"ask")=>void}) {
  return <>
    <section className="hero"><div>
      <p className="eyebrow">UAE Regulatory Intelligence</p>
      <h1>Know what changed.<br/><em>Find the evidence.</em></h1>
      <p className="lead">Search verified UAE regulatory material and ask compliance questions against the same evidence-backed Mizan database.</p>
      <div className="buttons"><button className="primary" onClick={()=>go("search")}>Search regulations →</button><button onClick={()=>go("ask")}>Ask Mizan</button></div>
      <small>Free Regulatory Search · Official-source evidence · Database-driven answers</small>
    </div><aside className="snapshot"><div className="snaphead">MIZAN EVIDENCE STANDARD <b>OFFICIAL SOURCES</b></div><div className="health"><strong>✓</strong><span>Evidence-first research<br/><em>verified records only</em></span></div><div className="mini"><i/><span><b>Regulatory Search</b><small>Search by topic, authority or jurisdiction</small></span></div><div className="mini"><i/><span><b>Ask Mizan</b><small>Answers grounded in the regulatory database</small></span></div><div className="mini"><i/><span><b>Source transparency</b><small>Authority, status and verification details</small></span></div></aside></section>
    <section className="platform-page"><div className="platform-head"><p className="eyebrow">One regulatory knowledge layer</p><h2>Evidence before explanation.</h2><p>Mizan separates official-source facts from its plain-language explanation and does not invent a regulatory answer when verified evidence is unavailable.</p></div><div className="platform-grid"><article><b>Free Regulatory Search</b><p>Find reviewed UAE regulatory records without a subscription.</p></article><article><b>Ask Mizan</b><p>Ask natural-language questions against the same verified knowledge base.</p></article><article><b>Change intelligence</b><p>New source material is detected and held for verification before publication.</p></article></div></section>
  </>;
}

function RegulatorySearch() {
  const [query,setQuery]=useState("");
  const [jurisdiction,setJurisdiction]=useState("All");
  const [submitted,setSubmitted]=useState("");
  const [results,setResults]=useState<SearchRecord[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const pending=useRef<AbortController|null>(null);

  const run = async (event?:FormEvent) => {
    event?.preventDefault();
    const value=query.trim(); if(!value || loading) return;
    pending.current?.abort(); const controller=new AbortController(); pending.current=controller;
    setSubmitted(value); setResults([]); setError(""); setLoading(true);
    try {
      const params=new URLSearchParams({q:value}); if(jurisdiction!=="All") params.set("jurisdiction",jurisdiction);
      const response=await fetch(`${apiBase()}/api/regulatory-search?${params}`,{signal:controller.signal});
      const payload=await jsonResponse<{results?:SearchRecord[]}>(response);
      if(!response.ok || !Array.isArray(payload.results)) throw new Error("unavailable");
      if(pending.current===controller) setResults(payload.results.filter(item=>item.evidenceStatus==="official-verified"));
    } catch { if(pending.current===controller) setError(controller.signal.aborted?"The search was cancelled. Please try again.":"The verified regulatory database is temporarily unavailable. Please try again later."); }
    finally { if(pending.current===controller) setLoading(false); }
  };

  return <section className="reg-search-page"><div className="search-intro"><p className="eyebrow">Official evidence only</p><h2>Mizan Regulatory Search</h2><p>Search reviewed regulatory records. Mizan returns only material with intact official-source and verification evidence.</p><form onSubmit={run}><label htmlFor="reg-query">Search UAE regulations</label><div className="search-box"><input id="reg-query" value={query} maxLength={500} required onChange={e=>setQuery(e.target.value)} placeholder="e.g. beneficial ownership requirements"/><select aria-label="Jurisdiction" value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)}><option>All</option><option>Mainland</option><option>Federal</option><option>DIFC</option><option>ADGM</option></select><button className="primary" disabled={loading}>{loading?"Searching…":"Search"}</button></div></form></div>
  <div className="search-results" aria-live="polite">{error&&<div className="search-empty"><h3>Search unavailable</h3><p>{error}</p></div>}{submitted&&!loading&&!error&&results.length===0&&<div className="search-empty"><h3>No verified result found</h3><p>Mizan will not invent a result or citation. Try another term, authority or jurisdiction.</p></div>}{results.length>0&&<><div className="search-results-head"><p className="eyebrow">Verified results</p><h3>{results.length} record{results.length===1?"":"s"}</h3><p>Search: {submitted}</p></div>{results.map(record=><article className="reg-card" key={record.id}><div className="reg-card-top"><div className="reg-pills"><span>{record.jurisdiction}</span><span>{record.status}</span></div><b className="evidence">✓ Official evidence verified</b></div><p className="reg-reference">{record.instrumentType}{record.instrumentNumber?` · ${record.instrumentNumber}`:""}</p><h3>{record.title}</h3><p className="reg-summary">{record.summary}</p><div className="reg-facts"><div><small>Authority</small><b>{record.authority}</b></div><div><small>Effective date</small><b>{record.effectiveDate||"See official source"}</b></div><div><small>Last verified</small><b>{new Date(record.lastVerifiedAt).toLocaleDateString()}</b></div></div><div className="evidence-detail"><b>Who it applies to</b><ul>{record.applicability.map(item=><li key={item}>{item}</li>)}</ul><b>Key obligations</b><ul>{record.obligations.map(item=><li key={item}>{item}</li>)}</ul></div><a href={record.officialSourceUrl} target="_blank" rel="noreferrer">View official source ↗</a></article>)}</>}</div></section>;
}

function AskMizan() {
  const [question,setQuestion]=useState(""); const [answer,setAnswer]=useState(""); const [verified,setVerified]=useState(false); const [sources,setSources]=useState<EvidenceSource[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const ask=async(event?:FormEvent)=>{event?.preventDefault();const value=question.trim();if(!value||loading)return;setLoading(true);setAnswer("");setSources([]);setVerified(false);setError("");try{const response=await fetch(`${apiBase()}/api/assistant`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:value})});const payload=await jsonResponse<{answer?:string;verified?:boolean;sources?:EvidenceSource[]}>(response);if(!response.ok||typeof payload.answer!=="string")throw new Error("unavailable");setAnswer(payload.answer);setVerified(payload.verified===true);setSources(Array.isArray(payload.sources)?payload.sources:[]);}catch{setError("Mizan's verified regulatory database is temporarily unavailable. Please try again later.");}finally{setLoading(false)}};
  return <section className="assistant-page"><div className="assistant-head"><p className="eyebrow">Database-driven regulatory answers</p><h2>Ask Mizan</h2><p>Ask a UAE regulatory question. Answers are assembled from verified records already held in Mizan’s regulatory knowledge base.</p></div><div className="assistant-grid"><aside><b>Suggested questions</b>{["What are the beneficial ownership requirements?","What VAT requirements are recorded?","What corporate tax rules are available?"].map(item=><button key={item} onClick={()=>setQuestion(item)}>{item}</button>)}</aside><article className="conversation" aria-live="polite"><form onSubmit={ask}><label htmlFor="mizan-question">Your question</label><textarea id="mizan-question" value={question} maxLength={4000} required onChange={e=>setQuestion(e.target.value)} placeholder="Ask about a UAE regulatory requirement"/><button className="primary" disabled={loading||!question.trim()}>{loading?"Checking evidence…":"Ask Mizan"}</button></form>{answer&&<div className="ai-bubble"><span>م</span><div><b>{verified?"Mizan · verified evidence used":"Mizan · insufficient verified evidence"}</b><p>{answer}</p>{sources.length>0&&<div className="answer-sources"><strong>Evidence cited</strong><ol>{sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.authority} · verified {new Date(source.lastVerifiedAt).toLocaleDateString()}</small></li>)}</ol></div>}</div></div>}{error&&<p role="alert" className="fine">{error}</p>}<div className="answer-guard"><b>Evidence boundary</b><p>If Mizan cannot find sufficient verified regulatory evidence, it will say so rather than create an answer or citation.</p></div></article></div></section>;
}
