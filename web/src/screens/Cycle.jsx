import { useCallback, useEffect, useState } from 'react'

import { api } from '../api'
import { subscribe } from '../store'
import Icon from '../components/Icon'
import { addDays, parts, prettyDay, relativeDay, today, toDayString, toLocalDate } from '../lib/dates'

const DIAS_CURTOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const CONFIANCA = {
  'sem dados': { label: 'sem dados ainda', cor: 'var(--ink-faint)' },
  baixa: { label: 'confiança baixa', cor: 'var(--mustard-deep)' },
  média: { label: 'confiança média', cor: 'var(--mustard-deep)' },
  boa: { label: 'confiança boa', cor: 'var(--sage-deep)' },
}

/** Primeiro e último dia do mês que contém `day`, como texto. */
function monthRange(day) {
  const p = parts(day)
  const first = `${p.y}-${String(p.m).padStart(2, '0')}-01`
  const lastDay = new Date(p.y, p.m, 0).getDate()
  const last = `${p.y}-${String(p.m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return [first, last]
}

function Calendario({ dias, mes, onMes, onDia, selecionado }) {
  const p = parts(mes)
  // quantos espaços vazios antes do dia 1, pra alinhar na coluna certa
  const primeiroDiaSemana = toLocalDate(`${p.y}-${String(p.m).padStart(2, '0')}-01`).getDay()
  const hoje = today()

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="btn-plain" onClick={() => onMes(-1)} aria-label="Mês anterior">
          <Icon name="back" size={20} />
        </button>
        <strong style={{ fontFamily: 'Baloo 2', fontSize: 18 }}>
          {MESES[p.m - 1]} {p.y}
        </strong>
        <button
          className="btn-plain"
          onClick={() => onMes(1)}
          aria-label="Próximo mês"
          style={{ transform: 'rotate(180deg)' }}
        >
          <Icon name="back" size={20} />
        </button>
      </div>

      <div className="cal-grid">
        {DIAS_CURTOS.map((d, i) => (
          <div key={i} className="cal-head">
            {d}
          </div>
        ))}
        {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
          <div key={`vazio-${i}`} />
        ))}
        {dias.map((dia) => {
          const marcas = dia.marks
          const classes = ['cal-day']
          if (marcas.includes('menstruacao')) classes.push('m-periodo')
          else if (marcas.includes('previsto')) classes.push('m-previsto')
          else if (marcas.includes('ovulacao')) classes.push('m-ovulacao')
          else if (marcas.includes('fertil')) classes.push('m-fertil')
          if (dia.day === hoje) classes.push('m-hoje')
          if (dia.day === selecionado) classes.push('m-escolhido')
          return (
            <button key={dia.day} className={classes.join(' ')} onClick={() => onDia(dia.day)}>
              {parts(dia.day).d}
              {dia.has_log && <span className="cal-dot" />}
            </button>
          )
        })}
      </div>

      <div className="row wrap cal-legend">
        <span>
          <i className="m-periodo" /> menstruação
        </span>
        <span>
          <i className="m-previsto" /> previsto
        </span>
        <span>
          <i className="m-fertil" /> janela fértil
        </span>
        <span>
          <i className="m-ovulacao" /> ovulação
        </span>
      </div>
    </div>
  )
}

function RegistroDoDia({ dia, opcoes, aoSalvar, aoFechar }) {
  const [log, setLog] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api
      .get(`/api/cycle/day/${dia}`)
      .then((r) =>
        setLog(
          r.log || { flow: 'none', symptoms: [], mood: '', energy: null, notes: '' }
        )
      )
      .catch((e) => setErro(e.message))
  }, [dia])

  if (!log) return null

  function alterna(sintoma) {
    setLog((l) => ({
      ...l,
      symptoms: l.symptoms.includes(sintoma)
        ? l.symptoms.filter((s) => s !== sintoma)
        : [...l.symptoms, sintoma],
    }))
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      await api.put(`/api/cycle/day/${dia}`, {
        flow: log.flow,
        symptoms: log.symptoms,
        mood: log.mood,
        energy: log.energy,
        notes: log.notes,
      })
      aoSalvar()
    } catch (e) {
      setErro(e.message)
    }
    setSalvando(false)
  }

  return (
    <div className="card tilt-2">
      <div className="row between" style={{ marginBottom: 10 }}>
        <strong style={{ fontFamily: 'Baloo 2' }}>{prettyDay(dia)}</strong>
        <button className="btn-plain" onClick={aoFechar} aria-label="Fechar">
          <Icon name="close" size={18} />
        </button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      <p className="card-title">Fluxo</p>
      <div className="row wrap" style={{ gap: 7 }}>
        {opcoes.flow.map((f) => (
          <button
            key={f.code}
            className={log.flow === f.code ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setLog({ ...log, flow: f.code })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="card-title" style={{ marginTop: 16 }}>
        Como você está
      </p>
      <div className="row wrap" style={{ gap: 7 }}>
        {opcoes.moods.map((m) => (
          <button
            key={m}
            className={log.mood === m ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setLog({ ...log, mood: log.mood === m ? '' : m })}
          >
            {m}
          </button>
        ))}
      </div>

      <p className="card-title" style={{ marginTop: 16 }}>
        Energia
      </p>
      <div className="row" style={{ gap: 7 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={log.energy === n ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setLog({ ...log, energy: log.energy === n ? null : n })}
            style={{ flex: 1 }}
          >
            {n}
          </button>
        ))}
      </div>

      <p className="card-title" style={{ marginTop: 16 }}>
        Sintomas
      </p>
      <div className="row wrap" style={{ gap: 6 }}>
        {opcoes.symptoms.map((s) => (
          <button
            key={s}
            className={log.symptoms.includes(s) ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => alterna(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="field" style={{ marginTop: 16 }}>
        <span>Anotação</span>
        <textarea
          rows={3}
          value={log.notes || ''}
          onChange={(e) => setLog({ ...log, notes: e.target.value })}
          placeholder="alguma coisa que você queira lembrar"
        />
      </label>

      <button className="btn-primary btn-block" onClick={salvar} disabled={salvando}>
        Salvar o dia
      </button>
    </div>
  )
}

export default function Cycle() {
  const [dados, setDados] = useState(null)
  const [cal, setCal] = useState(null)
  const [mes, setMes] = useState(() => today())
  const [dia, setDia] = useState(null)
  const [status, setStatus] = useState(null)
  const [verFontes, setVerFontes] = useState(false)

  const carregar = useCallback(async () => {
    const visao = await api.get('/api/cycle')
    setDados(visao)
    if (visao.available) {
      const [de, ate] = monthRange(mes)
      setCal(await api.get(`/api/cycle/calendar?start=${de}&end=${ate}`))
    }
  }, [mes])

  useEffect(() => {
    carregar().catch((e) => setStatus({ kind: 'error', text: e.message }))
    return subscribe('cycle', () => carregar().catch(() => {}))
  }, [carregar])

  function mudarMes(delta) {
    const p = parts(mes)
    const d = new Date(p.y, p.m - 1 + delta, 1, 12)
    setMes(toDayString(d))
    setDia(null)
  }

  async function registrarInicio() {
    setStatus(null)
    try {
      await api.post('/api/cycle/period', { start_day: today() })
      setStatus({ kind: 'ok', text: 'Registrado. A previsão já se ajustou.' })
      await carregar()
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
    }
  }

  async function encerrar() {
    setStatus(null)
    try {
      await api.post('/api/cycle/period', {
        start_day: dados.last_period_start,
        end_day: today(),
      })
      setStatus({ kind: 'ok', text: 'Fim da menstruação registrado.' })
      await carregar()
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
    }
  }

  async function mudarPrivacidade(share) {
    await api.put('/api/cycle/privacy', { share })
    await carregar()
  }

  if (!dados) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    )
  }

  if (!dados.available) {
    return (
      <>
        <h1 className="screen-title">Ciclo</h1>
        <div className="card center muted">{dados.reason}</div>
      </>
    )
  }

  const conf = CONFIANCA[dados.confidence] || CONFIANCA['sem dados']
  const emMenstruacao = dados.phase.code === 'menstrual'

  return (
    <>
      <h1 className="screen-title">Ciclo</h1>

      {status && (
        <div className={`alert alert-${status.kind === 'ok' ? 'ok' : 'error'}`}>{status.text}</div>
      )}

      {/* ------------------------------------------------ fase atual */}
      <div className="card rose tilt" style={{ paddingTop: 20 }}>
        <div className="tape" />
        <div className="center">
          <div className="muted small">
            {dados.is_owner ? 'você está na fase' : `${dados.owner_name} está na fase`}
          </div>
          <h2 style={{ fontSize: 26, margin: '2px 0 4px' }}>{dados.phase.name}</h2>
          {dados.cycle_day && <div className="muted small">dia {dados.cycle_day} do ciclo</div>}
        </div>

        <p className="small" style={{ marginBottom: 6 }}>
          {dados.phase.about}
        </p>
        {dados.phase.energy && (
          <p className="small muted" style={{ margin: 0 }}>
            Nessa fase, {dados.phase.energy}.
          </p>
        )}
      </div>

      {/* ------------------------------------------------ o que ele vê */}
      {!dados.is_owner && dados.partner_note && (
        <div className="card sage">
          <p className="card-title">Como ajudar hoje</p>
          <p className="small" style={{ margin: 0 }}>
            {dados.partner_note}
          </p>
        </div>
      )}

      {/* ------------------------------------------------ previsão */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <p className="card-title" style={{ margin: 0 }}>
            Previsão
          </p>
          <span className="pill flat tiny" style={{ color: conf.cor }}>
            {conf.label}
          </span>
        </div>

        {dados.predicted_next_start ? (
          <>
            <div className="row between small">
              <span className="muted">Próxima menstruação</span>
              <strong>
                {prettyDay(dados.predicted_next_start, { short: true })}
                {dados.days_until_next >= 0
                  ? ` · em ${dados.days_until_next} dia${dados.days_until_next === 1 ? '' : 's'}`
                  : ` · ${Math.abs(dados.days_until_next)} dia(s) de atraso`}
              </strong>
            </div>
            <div className="row between small" style={{ marginTop: 6 }}>
              <span className="muted">Janela fértil</span>
              <strong>
                {prettyDay(dados.fertile_start, { short: true })} a{' '}
                {prettyDay(dados.fertile_end, { short: true })}
              </strong>
            </div>
            <div className="row between small" style={{ marginTop: 6 }}>
              <span className="muted">Ciclo típico</span>
              <strong>
                {dados.cycle_length} dias
                {dados.cycle_variation != null && ` (varia ${dados.cycle_variation})`}
              </strong>
            </div>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Registre o começo da menstruação por alguns meses e a previsão aparece aqui.
          </p>
        )}
      </div>

      {/* ------------------------------------------------ avisos */}
      {dados.warnings?.length > 0 &&
        dados.warnings.map((w, i) => (
          <div key={i} className="alert alert-info">
            {w}
          </div>
        ))}

      {/* ------------------------------------------------ botões da dona */}
      {dados.is_owner && (
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <button className="btn-primary grow" onClick={registrarInicio}>
            <Icon name="flower" size={17} /> Começou hoje
          </button>
          {emMenstruacao && (
            <button className="btn-ghost" onClick={encerrar}>
              Acabou
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------ calendário */}
      {cal && (
        <Calendario
          dias={cal.days}
          mes={mes}
          onMes={mudarMes}
          onDia={(d) => setDia(d === dia ? null : d)}
          selecionado={dia}
        />
      )}

      {dia && dados.is_owner && (
        <RegistroDoDia
          dia={dia}
          opcoes={dados.options}
          aoSalvar={() => {
            setStatus({ kind: 'ok', text: 'Anotado.' })
            carregar()
          }}
          aoFechar={() => setDia(null)}
        />
      )}

      {/* ------------------------------------------------ privacidade */}
      {dados.is_owner && (
        <div className="card">
          <p className="card-title">O que o {'{parceiro}'.replace('{parceiro}', 'outro')} vê</p>
          <div className="stack">
            {[
              ['resumo', 'Só o resumo', 'Fase atual, previsão e como ajudar. Sem sintoma nem anotação.'],
              ['completo', 'Tudo', 'Inclusive sintomas, humor e o que você escreveu.'],
              ['nada', 'Nada', 'O módulo some pra ele por completo.'],
            ].map(([code, titulo, texto]) => (
              <button
                key={code}
                className={dados.privacy === code ? 'btn-primary' : 'btn-ghost'}
                onClick={() => mudarPrivacidade(code)}
                style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 2 }}
              >
                <span>{titulo}</span>
                <span className="tiny" style={{ fontWeight: 400, opacity: 0.85 }}>
                  {texto}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ base clínica */}
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>
          {dados.disclaimer}
        </p>
        <button className="btn-ghost btn-sm" onClick={() => setVerFontes((v) => !v)}>
          {verFontes ? 'Esconder as fontes' : 'De onde vêm essas contas'}
        </button>
        {verFontes && (
          <div className="stack" style={{ marginTop: 12 }}>
            {dados.sources.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="card tight"
                style={{ marginBottom: 0, textDecoration: 'none' }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</div>
                <div className="muted tiny">{s.detail}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
