import { Route, Routes, Link } from 'react-router-dom';
import { ResetForm } from './ResetForm';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<h1>Home</h1>} />
      <Route path="/reset" element={<ResetForm />} />
      <Route path="/reset/confirm" element={<ResetForm />} />
    </Routes>
  );
}

export function Nav() {
  return <Link to="/reset">Reset password</Link>;
}
