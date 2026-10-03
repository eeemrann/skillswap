import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import App, { ClerkRouterProvider } from './App.jsx';
import { applyTheme } from './lib/theme';
import './styles/base.css';
import './styles/app.css';
import './styles/marketing.css';
import './styles/session.css';
import './styles/responsive.css';

applyTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ClerkRouterProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </ClerkRouterProvider>
  </BrowserRouter>
);
