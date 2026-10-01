import { LitElement, css, html } from 'lit'

const API_URL = 'http://127.0.0.1:8765/api/bootstrap'

export class HaDisplayApp extends LitElement {
  static get properties() {
    return {
      paired: { type: Boolean },
      pin: { type: String },
      status: { type: String },
    }
  }

  constructor() {
    super()
    this.paired = false
    this.pin = ''
    this.status = 'Connecting to the local display service…'
    this.pollTimer = undefined
  }

  connectedCallback() {
    super.connectedCallback()
    this.refreshStatus()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    clearTimeout(this.pollTimer)
  }

  async refreshStatus() {
    try {
      const response = await fetch(API_URL)
      if (!response.ok) {
        throw new Error(`Display service returned ${response.status}`)
      }
      const data = await response.json()
      this.paired = data.paired
      this.pin = data.pin || ''
      this.status = data.paired
        ? 'Paired with Home Assistant. Waiting for its display settings…'
        : 'Add this display in Home Assistant and enter the pairing PIN.'

      if (data.paired && data.dashboard_url) {
        window.location.replace(data.dashboard_url)
        return
      }
    } catch {
      this.status = 'The local display service is unavailable. Restart HA Display to try again.'
    }
    this.pollTimer = setTimeout(() => this.refreshStatus(), 2000)
  }

  render() {
    const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
    return html`
      <main class="setup-shell">
        <section class="setup-card" aria-live="polite">
          <h1>HA Display</h1>
          <p>${isTauriRuntime ? this.status : 'Run HA Display on the device to pair it with Home Assistant.'}</p>
          ${this.pin ? html`
            <div class="pin" aria-label="Pairing PIN">${this.pin}</div>
            <small>This PIN expires after 15 minutes.</small>
          ` : ''}
          ${this.paired && !this.pin ? html`<div class="spinner" aria-hidden="true"></div>` : ''}
        </section>
      </main>
    `
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
        color: #e2e8f0;
        background: #020817;
        font-family: Inter, 'Segoe UI', sans-serif;
      }

      .setup-shell {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        padding: 1rem;
      }

      .setup-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        width: min(100%, 34rem);
        padding: 2.5rem;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.9);
        text-align: center;
      }

      h1 {
        margin: 0;
        font-size: 1.75rem;
      }

      p {
        margin: 0;
        line-height: 1.5;
      }

      .pin {
        padding: 0.4rem 1.5rem;
        color: #38bdf8;
        font-size: 3rem;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        letter-spacing: 0.2em;
      }

      small {
        color: #94a3b8;
      }

      .spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid rgba(148, 163, 184, 0.25);
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
  }
}

customElements.define('ha-display-app', HaDisplayApp)
