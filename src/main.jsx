import ErrorBoundary from './ErrorBoundary'
import './styles.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
)

//__overlay_hook__

;(() => {
  function showOverlay(msg){
    const el = document.createElement('div')
    el.style.position='fixed'; el.style.inset='0'; el.style.background='rgba(0,0,0,.6)'
    el.style.zIndex='99999'; el.style.display='flex'; el.style.alignItems='center'; el.style.justifyContent='center'
    el.innerHTML = '<div style="max-width:800px; width:90%; background:#fff; color:#111; padding:16px; border-radius:12px; font-family:ui-sans-serif,system-ui"><h3 style="margin:0 0 8px">Errore runtime</h3><pre style="white-space:pre-wrap">'+msg+'</pre><button id="ovlClose" style="margin-top:10px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;cursor:pointer">Chiudi</button></div>'
    document.body.appendChild(el)
    document.getElementById('ovlClose').onclick=()=>el.remove()
  }
  window.addEventListener('error', (e)=>{ if(e && e.message) showOverlay(e.message) })
  window.addEventListener('unhandledrejection', (e)=>{ try{ showOverlay(String(e.reason)) }catch{} })
})()

