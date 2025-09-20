import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui', color: '#b91c1c' }}>
          <h2>Si è verificato un errore in pagina</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background:'#fee2e2', padding:12, borderRadius:8, border:'1px solid #fecaca' }}>
{String(this.state.error)}
          </pre>
          {this.state.info && (
            <details open style={{ marginTop: 8, color: '#7f1d1d' }}>
              <summary>Dettagli</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.info.componentStack)}</pre>
            </details>
          )}
          <p style={{ marginTop: 12 }}>Apri la console del browser (F12 → Console) e incolla qui il messaggio se persiste.</p>
        </div>
      )
    }
    return this.props.children
  }
}