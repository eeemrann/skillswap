import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import App, { ClerkRouterProvider } from './App.jsx';
import './index.css';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ClerkRouterProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </ClerkRouterProvider>
  </BrowserRouter>
);
