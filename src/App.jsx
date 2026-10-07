import React, { lazy, Suspense } from 'react';
import { PublicForm } from './Form.jsx';
import { Loading } from './components.jsx';
const Admin = lazy(() => import('./Admin.jsx'));
export function App() {
  if (location.pathname.startsWith('/form')) return <PublicForm preview={new URLSearchParams(location.search).get('preview') === '1'}/>;
  return <Suspense fallback={<Loading/>}><Admin/></Suspense>;
}
