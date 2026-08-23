import { useEffect, useState } from 'react'

import { api } from '../api'
import { useStore } from '../store'

export default function Login() {
  const login = useStore((s) => s.login)
  const [config, setConfig] = useState(null)
  const [slug, setSlug] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get('/api/config')
      .then((data) => {
        setConfig(data)
        // Sao duas pessoas: nao faz sentido digitar login. Escolhe no botao.
        if (data.users.length === 1) setSlug(data.users[0].slug)
      })
      .catch(() => setError('Nao consegui falar com o servidor.'))
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!slug) return setError('Escolha quem esta entrando.')
    setBusy(true)
    setError('')
    try {
      await login(slug, password)
    } catch (err) {
      setError(err.message || 'Deu erro ao entrar.')
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">💜</div>
      <h1 className="center" style={{ margin: '0 0 4px', fontSize: 24 }}>
        {config?.app_name || 'Nosso app'}
      </h1>
      <p className="center muted small" style={{ marginTop: 0, marginBottom: 26 }}>
        só nós dois aqui
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={submit}>
        {config?.users?.length > 1 && (
          <div className="who-grid">
            {config.users.map((u) => (
              <button
                type="button"
                key={u.slug}
                className={`who ${slug === u.slug ? 'selected' : ''}`}
                onClick={() => setSlug(u.slug)}
              >
                {u.name}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="sua senha"
          />
        </label>

        <button className="btn-primary btn-block" disabled={busy || !slug || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
