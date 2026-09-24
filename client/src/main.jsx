import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import App, { ClerkRouterProvider } from './App.jsx';
import './index.css';
import './App.css';

const storedTheme = localStorage.getItem('skillswap-theme');
const initialTheme = storedTheme === 'light' || storedTheme === 'dark'
  ? storedTheme
  : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
document.documentElement.dataset.theme = initialTheme;
document.documentElement.style.colorScheme = initialTheme;

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ClerkRouterProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </ClerkRouterProvider>
  </BrowserRouter>
);
