import { useEffect, useState } from 'react';

export default function App() {
  const [server, setServer] = useState('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(() => setServer('up'))
      .catch(() => setServer('down'));
  }, []);

  return (
    <main className="app">
      <h1>Query Forge</h1>
      <p>Generate Postgres queries from plain English, and practice SQL.</p>
      <p className={`status status-${server}`}>Server: {server}</p>
    </main>
  );
}
