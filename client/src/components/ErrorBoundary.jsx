import { Component } from 'react';

/** Last line of defence: a crash in one screen shows a recovery page instead of a blank window. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="loading-screen" role="alert">
        <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
        <p className="muted">The page hit an unexpected error. Your data is safe.</p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
          <a className="btn btn-secondary" href="/">Go home</a>
        </div>
      </div>
    );
  }
}
