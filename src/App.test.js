import { render, screen } from '@testing-library/react';
import App from './App';

// Route integration only; child screens have their own behavior tests.
jest.mock('axios', () => ({ defaults: {}, interceptors: { request: { use: jest.fn() } } }));
jest.mock('./components/Layout', () => {
  const { Outlet } = require('react-router-dom');
  return () => <Outlet />;
});
jest.mock('./components/CartContext', () => ({ CartProvider: ({ children }) => children }));
jest.mock('./components/AdminReferenceData', () => () => <h1>Catalog Setup</h1>);

test('catalog administration route renders the reference management screen', () => {
  window.history.replaceState({}, '', '/admin/catalog-setup');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Catalog Setup' })).toBeInTheDocument();
});
