/**
 * dsh-inner-voice — settings panel (client half).
 *
 * Loaded as a dsh.client bundle: registers a settings.section page that reads
 * past entries from the host's read-only route /dsh-inner-voice-api.
 *
 * The registration id must equal the loader entry name (dsh-inner-voice),
 * otherwise ModuleLoader reports "loaded without registering".
 */
window.__ModuleLoader__.load({
  id: 'dsh-inner-voice',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

    const S = {
      wrap: { display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0', fontSize: 13 },
      head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
      title: { fontSize: 13, fontWeight: 600, opacity: 0.85 },
      hint: { fontSize: 12, opacity: 0.55, lineHeight: 1.7, marginTop: 4 },
      btn: {
        cursor: 'pointer', fontSize: 12, padding: '6px 12px', borderRadius: 8,
        border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit',
      },
      day: { fontSize: 12, fontWeight: 600, opacity: 0.6, margin: '2px 0 -6px' },
      item: {
        display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 10,
        background: 'rgba(128,128,128,.07)',
      },
      time: { fontSize: 11, opacity: 0.45, flex: 'none', width: 40, paddingTop: 2 },
      line: { fontSize: 13, lineHeight: 1.65 },
      raw: { fontSize: 11, opacity: 0.45, lineHeight: 1.6, marginTop: 3, wordBreak: 'break-word' },
      empty: { fontSize: 12, opacity: 0.5, padding: '28px 0', textAlign: 'center' },
      err: { fontSize: 12, color: '#d9534f' },
    }

    function Panel() {
      const [state, setState] = React.useState({ loading: true, days: [], label: 'inner voice', error: '' })

      const load = React.useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: '' }))
        fetch('/dsh-inner-voice-api', { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
          .then((d) => setState({
            loading: false,
            days: d.days || [],
            label: d.label || 'inner voice',
            error: '',
          }))
          .catch((e) => setState({ loading: false, days: [], label: 'inner voice', error: String(e.message || e) }))
      }, [])

      React.useEffect(() => { load() }, [load])

      const days = state.days || []
      const total = days.reduce((n, d) => n + (d.entries ? d.entries.length : 0), 0)

      return h('div', { style: S.wrap },
        h('div', { style: S.head },
          h('div', null,
            h('div', { style: S.title }, 'Inner voice'),
            h('div', { style: S.hint },
              'Reasoning the agent kept while thinking. The short line is a rewrite; the grey text is the raw excerpt.',
              total ? ` ${days.length} day(s), ${total} entr${total === 1 ? 'y' : 'ies'}.` : ''),
          ),
          h('button', { style: S.btn, onClick: load, disabled: state.loading },
            state.loading ? 'Loading…' : 'Refresh'),
        ),

        state.error ? h('div', { style: S.err }, 'Failed to load: ' + state.error) : null,

        !state.loading && !state.error && total === 0
          ? h('div', { style: S.empty },
            'Nothing recorded yet. Entries appear after the agent thinks for a while.')
          : null,

        days.map((day) =>
          h('div', { key: day.date, style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('div', { style: S.day }, day.date),
            (day.entries || []).map((e, i) =>
              h('div', { key: day.date + '-' + i, style: S.item },
                h('div', { style: S.time }, e.time),
                h('div', { style: { minWidth: 0 } },
                  h('div', { style: S.line }, e.line || '—'),
                  e.raw ? h('div', { style: S.raw }, e.raw) : null,
                ),
              ),
            ),
          ),
        ),
      )
    }

    function apply(ctx) {
      const slots = ctx.get ? ctx.get('slots') : undefined
      if (!slots) return
      slots.inject('settings.section', () =>
        slots.register(
          { name: 'settings.section', id: 'inner-voice', order: 26, label: 'Inner voice' },
          () => h(Panel),
        ),
      )
    }

    const inject = []
    exports.apply = apply
    exports.inject = inject
    exports.__test = { Panel }
    return module.exports
  },
})
