import { LitElement, css, html } from 'lit'

export class HaDisplayApp extends LitElement {
  static get properties() {
    return {
      dashboardUrl: { type: String },
      ready: { type: Boolean },
    }
  }

  constructor() {
    super()
    const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
    const isLocalHttpPreview = typeof window !== 'undefined'
      && window.location.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

    const defaultUrl = 'http://homeassistant.local:8123'
    this.dashboardUrl = isTauriRuntime || isLocalHttpPreview
      ? defaultUrl
      : 'about:blank'
    this.ready = false
  }

  render() {
    const isPreviewBlocked = this.dashboardUrl === 'about:blank'

    return html`
      <div class="display-shell">
        ${isPreviewBlocked
          ? html`
            <div class="loading-overlay">
              <div class="loading-card">
                <div class="spinner"></div>
                <p>Browser preview blocked by mixed-content policy</p>
                <small>
                  The desktop app will open Home Assistant at http://homeassistant.local.
                  Browser previews are served over HTTPS and cannot load an HTTP iframe.
                </small>
              </div>
            </div>
          `
          : html`
            <iframe
              src=${this.dashboardUrl}
              title="Home Assistant Dashboard"
              @load=${this._onDashboardLoad}
            ></iframe>
          `}

        ${!isPreviewBlocked && this.ready ? '' : ''}
      </div>
    `
  }

  _onDashboardLoad() {
    this.ready = true
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
