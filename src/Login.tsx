import { useState } from 'react';
import { login, type UsuarioSesion } from './api';
import logo from './logo-mrcarnes.png';

interface LoginProps {
  onLogin: (usuario: UsuarioSesion) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const { usuario } = await login(telefono, pin);
      onLogin(usuario);
    } catch (err: any) {
      setError(err.error || 'No se pudo iniciar sesion');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <div style={{ display: 'grid', gap: '0.75rem', minWidth: 280 }}>
        <img
          src={logo}
          alt="Mr Carnes"
          style={{ width: 160, margin: '0 auto 8px', display: 'block' }}
        />
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" />
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" type="password" />
          {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={cargando}>{cargando ? 'Ingresando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}
