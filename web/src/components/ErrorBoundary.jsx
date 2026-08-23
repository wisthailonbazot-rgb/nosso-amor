import { Component } from 'react'

/**
 * Rede de segurança da tela.
 *
 * Sem isto, um erro em qualquer componente apaga o app inteiro e sobra uma tela
 * branca — no celular, sem console aberto, isso é indepurável. Aqui o erro vira
 * texto legível, com o caminho do componente que quebrou.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('quebrou:', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}>
        <h2 style={{ fontFamily: 'sans-serif' }}>Alguma coisa quebrou aqui</h2>
        <p style={{ color: '#c9607a' }}>{String(error && error.message)}</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fffaf3', padding: 10, borderRadius: 8 }}>
          {(info && info.componentStack) || (error && error.stack)}
        </pre>
        <button onClick={() => this.setState({ error: null, info: null })}>Tentar de novo</button>
      </div>
    )
  }
}
