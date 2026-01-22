import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Activity, Package, CheckCircle, AlertTriangle, Play, Server } from 'lucide-react';

const API_BASE = '/api';

function App() {
    const [logs, setLogs] = useState([]);
    const [orderForm, setOrderForm] = useState({ customer_id: 'CUST-001', amount: 150 });
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState(null);
    const [authStatus, setAuthStatus] = useState('Connecting...');
    const logEndRef = useRef(null);

    useEffect(() => {
        // Auto-login for Demo
        axios.post(`${API_BASE}/auth/login`, { username: 'admin', password: 'password' })
            .then(res => {
                setToken(res.data.token);
                setAuthStatus('Authenticated (Admin)');
            })
            .catch(err => {
                console.error('Login failed', err);
                setAuthStatus('Auth Failed');
            });
    }, []);

    useEffect(() => {
        const sse = new EventSource(`${API_BASE}/notifications/stream`);
        sse.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'PING') return;
            setLogs(prev => [...prev, data]);
        };
        return () => sse.close();
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const createOrder = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/orders`, {
                customer_id: orderForm.customer_id,
                total_amount: Number(orderForm.amount),
                items: [{ name: "Demo Item", price: Number(orderForm.amount), quantity: 1 }]
            }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) {
            console.error(e);
            alert('Failed to create order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-8 font-sans">
            <header className="mb-8 flex items-center justify-between border-b border-slate-700 pb-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">IntegraHub</h1>
                    <p className="text-slate-400">Enterprise Integration Platform Demo</p>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                    <Activity size={20} />
                    <span className="text-sm font-medium">System Operational</span>
                </div>
                <div className={`flex items-center gap-2 ${token ? 'text-blue-400' : 'text-red-400'}`}>
                    <span className="text-sm font-medium">{authStatus}</span>
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Control Panel */}
                <section className="bg-slate-800 rounded-xl p-6 border border-slate-700 h-fit shadow-xl">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <Package className="text-blue-400" /> New Order
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Customer ID</label>
                            <input
                                type="text"
                                value={orderForm.customer_id}
                                onChange={e => setOrderForm({ ...orderForm, customer_id: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Total Amount ($)</label>
                            <input
                                type="number"
                                value={orderForm.amount}
                                onChange={e => setOrderForm({ ...orderForm, amount: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <button
                            onClick={createOrder}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Activity className="animate-spin" /> : <Play size={18} />}
                            Submit Order
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Services Status</h3>
                        <div className="space-y-2">
                            {['Gateway', 'Orders', 'Inventory', 'Payments', 'Notifications'].map(s => (
                                <div key={s} className="flex justify-between items-center text-sm">
                                    <span>{s}</span>
                                    <span className="flex items-center gap-1 text-green-400"><CheckCircle size={12} /> UP</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Live Logs */}
                <section className="col-span-1 lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col h-[600px]">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Server className="text-purple-400" /> Live Integration Events
                    </h2>

                    <div className="flex-1 overflow-auto bg-black/30 rounded-lg p-4 space-y-3 font-mono text-sm">
                        {logs.length === 0 && (
                            <div className="text-slate-500 text-center mt-20">Waiting for events...</div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="border-l-2 border-blue-500 pl-3 py-1 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>{log.timestamp}</span>
                                    <span className="text-blue-300">{log.routingKey}</span>
                                </div>
                                <div className="mt-1 text-slate-200">
                                    <span className="font-bold text-yellow-400">{log.payload.event_type}</span>
                                    <span className="mx-2 text-slate-600">|</span>
                                    Correlation: {log.payload.correlation_id?.substring(0, 8)}...
                                </div>
                                {log.payload.data && (
                                    <div className="mt-1 text-xs text-slate-500 break-words">
                                        {JSON.stringify(log.payload.data)}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </section>
            </main>
        </div>
    )
}

export default App
