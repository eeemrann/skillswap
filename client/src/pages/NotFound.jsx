import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/hooks';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <>
      <SiteHeader />
      <main className="notfound">
        <p className="eyebrow">404</p>
        <h1>This page wandered off</h1>
        <p className="muted">The link may be broken, or the page may have moved.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/">Back home</Link>
          <Link className="btn btn-secondary" to="/browse">Discover teachers</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
