import { LitElement, css, html } from 'lit'

export class HaDisplayApp extends LitElement {
  static get properties() {
    return {
      dashboardUrl: { type: String },
      ready: { type: Boolean },
      shouldRedirect: { type: Boolean },
      setupMode: { type: Boolean },
      urlError: { type: String },
    }
  }

  constructor() {
    super()
    const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
    const isLocalHttpPreview = typeof window !== 'undefined'
      && window.location.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

    let savedUrl
    try {
      savedUrl = window.localStorage.getItem('ha-display-start-url')
    } catch {
      savedUrl = ''
    }
    this.dashboardUrl = savedUrl || 'http://homeassistant.local:8123'
    this.ready = false
    this.setupMode = !savedUrl || new URLSearchParams(window.location.search).has('setup')
    this.shouldRedirect = (isTauriRuntime || isLocalHttpPreview) && !this.setupMode
    this.urlError = ''
  }

  connectedCallback() {
    super.connectedCallback()

    if (this.shouldRedirect) {
      setTimeout(() => {
        window.location.assign(this.dashboardUrl)
      }, 200)
    }
  }

  saveStartUrl(event) {
    event.preventDefault()
    const url = this.dashboardUrl.trim()

    try {
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
        throw new Error('invalid URL')
      }
    } catch {
      this.urlError = 'Enter a valid Home Assistant URL starting with http:// or https://.'
      return
    }

    try {
      window.localStorage.setItem('ha-display-start-url', url)
    } catch {
      this.urlError = 'The URL could not be saved in this browser.'
      return
    }

    this.dashboardUrl = url
    this.urlError = ''
    this.setupMode = false
    this.shouldRedirect = typeof window !== 'undefined'
      && (!!window.__TAURI_INTERNALS__
        || (window.location.protocol === 'http:'
          && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)))
    if (this.shouldRedirect) {
      window.location.assign(this.dashboardUrl)
    }
  }

  render() {
    if (this.setupMode) {
      return html`
        <main class="setup-shell">
          <form class="setup-card" @submit=${this.saveStartUrl}>
            <h1>HA Display</h1>
            <label for="start-url">Home Assistant start URL</label>
            <input
              id="start-url"
              type="url"
              .value=${this.dashboardUrl}
              @input=${(event) => { this.dashboardUrl = event.currentTarget.value }}
              autocomplete="url"
              required
            />
            ${this.urlError ? html`<p class="error" role="alert">${this.urlError}</p>` : ''}
            <button type="submit">Save and open</button>
          </form>
        </main>
      `
    }

    return html`
      <div class="display-shell">
        <div class="loading-overlay">
          <div class="loading-card">
            <div class="spinner"></div>
            <p>${this.shouldRedirect ? 'Opening Home Assistant...' : 'Browser preview blocked by Home Assistant frame policy'}</p>
            <small>${this.dashboardUrl}</small>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
        background: #020817;
      }

      .setup-shell {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        padding: 1rem;
        color: #e2e8f0;
      }

      .setup-card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: min(100%, 32rem);
        padding: 2rem;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.9);
      }

      h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      input,
      button {
        min-height: 2.75rem;
        padding: 0.65rem 0.8rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 8px;
        font: inherit;
      }

      input {
        color: #e2e8f0;
        background: #020817;
      }

      button {
        color: #020817;
        background: #38bdf8;
        border: 0;
        font-weight: 600;
        cursor: pointer;
      }

      .error {
        margin: 0;
        color: #fca5a5;
      }

      .display-shell {
        position: relative;
        width: 100%;
        height: 100%;
        background: #020817;
      }

      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        background: #020817;
      }

      .loading-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(2, 8, 23, 0.9);
      }

      .loading-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: #e2e8f0;
        text-align: center;
        padding: 2rem 3rem;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.2);
        box-shadow: 0 24px 44px rgba(15, 23, 42, 0.35);
      }

      .spinner {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 3px solid rgba(148, 163, 184, 0.25);
        border-top-color: #38bdf8;
        animation: spin 0.8s linear infinite;
      }

      p {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
      }

      small {
        color: #93c5fd;
        font-size: 0.8rem;
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
