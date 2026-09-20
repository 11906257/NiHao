import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './fonts.css'
import './styles.css'
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <main className="boot-screen">
        <h1>Die Ansicht konnte nicht geladen werden.</h1>
        <p>Dein gespeicherter Lernstand bleibt erhalten. Lade die App bitte erneut.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Neu laden
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
