import React, { useState } from 'react';
import { signInWithPassword } from '@supabase/supabase-js';
import { supabase } from '../supabaseConfig';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { AUTRO_LOGO_URL } from '../data/assets';

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"></path>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
        <path fill="none" d="M0 0h48v48H0z"></path>
    </svg>
);

const MicrosoftIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21">
        <path fill="#f25022" d="M1 1h9v9H1z"></path>
        <path fill="#00a4ef" d="M1 11h9v9H1z"></path>
        <path fill="#7fba00" d="M11 1h9v9h-9z"></path>
        <path fill="#ffb900" d="M11 11h9v9h-9z"></path>
    </svg>
);

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('antonio.marcos@autro.com.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setError('Falha ao fazer login. Verifique seu e-mail e senha.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setError(null);
    setIsLoading(true);
    try {
      if (provider === 'google') {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error(error);
      setError('Falha ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleGoogleLogin = () => handleSocialLogin(new GoogleAuthProvider());
  const handleMicrosoftLogin = () => handleSocialLogin(new OAuthProvider('microsoft.com'));

  const containerClasses = `flex justify-center min-h-screen bg-gray-50 items-start pt-20 md:items-center md:pt-0`;

  return (
    <div className={containerClasses}>
        <div className="absolute top-0 left-0 w-full h-full bg-gray-100 -z-10" style={{
            backgroundImage: "linear-gradient(rgba(0, 43, 138, 0.03) 1px, transparent 1px), linear-gradient(to right, rgba(0, 43, 138, 0.03) 1px, transparent 1px)",
            backgroundSize: "20px 20px"
        }}></div>
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8 flex items-center justify-center">
             <img src={AUTRO_LOGO_URL} alt="AUTRO Logo" className="h-20" />
        </div>
        <h2 className="text-2xl font-bold text-center text-black mb-1">Login do Sistema</h2>
        <p className="text-center text-gray-500 mb-6">Bem-vindo de volta.</p>
        <div className="space-y-4">
            <Button onClick={handleGoogleLogin} variant="secondary" className="w-full flex items-center justify-center !text-black bg-white hover:!bg-gray-50 border border-gray-300" disabled={isLoading}><GoogleIcon /> Entrar com Google</Button>
            <Button onClick={handleMicrosoftLogin} variant="secondary" className="w-full flex items-center justify-center !text-black bg-white hover:!bg-gray-50 border border-gray-300" disabled={isLoading}><MicrosoftIcon /> Entrar com Microsoft</Button>
        </div>
        
        <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-sm">OU</span>
            <div className="flex-grow border-t border-gray-300"></div>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="seu.email@exemplo.com"
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar com Email'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
