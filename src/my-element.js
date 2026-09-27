import { LitElement, css, html } from 'lit'

export class HaDisplayApp extends LitElement {
  static get properties() {
    return {
      dashboardUrl: { type: String },
      ready: { type: Boolean },
      shouldRedirect: { type: Boolean },
    }
  }

  constructor() {
    super()
    const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
    const isLocalHttpPreview = typeof window !== 'undefined'
      && window.location.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

    this.dashboardUrl = 'http://homeassistant.local:8123'
    this.ready = false
    this.shouldRedirect = isTauriRuntime || isLocalHttpPreview
  }

  connectedCallback() {
    super.connectedCallback()

    if (this.shouldRedirect) {
      setTimeout(() => {
        window.location.assign(this.dashboardUrl)
      }, 200)
    }
  }

  render() {
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
