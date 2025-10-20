import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, TrendingUp, BarChart3, Send, Menu, X, Upload, FileText, Zap } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// URL do backend no Render
const BACKEND_URL = 'https://alpha-insights-backend.onrender.com';

export default function AlphaInsights() {
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: 'Olá! Sou o assistente IA da Alpha Insights. Para começar, faça upload de sua planilha de vendas (CSV ou XLSX).' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [useLLM, setUseLLM] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Chama OpenAI via backend
  const callOpenAI = async (question) => {
    try {
      const dataContext = `Total de registros: ${sheetData.length}
Colunas: ${Object.keys(sheetData[0]).join(', ')}
Amostra de dados: ${JSON.stringify(sheetData.slice(0, 5))}`;

      const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          dataContext
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      return `❌ Erro ao conectar com IA: ${error.message}\n\nCertifique-se que o backend está rodando em ${BACKEND_URL}`;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Processa arquivo
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSheetName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let data = [];

        if (file.name.endsWith('.csv')) {
          const csv = e.target.result;
          const lines = csv.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((h, idx) => {
              row[h] = values[idx] ? values[idx].trim() : '';
            });
            data.push(row);
          }
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          data = XLSX.utils.sheet_to_json(sheet);
        }

        setSheetData(data);
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          type: 'bot',
          text: `✅ Arquivo carregado! ${data.length} registros encontrados.\n\nColunas: ${Object.keys(data[0] || {}).join(', ')}\n\nO que deseja saber sobre os dados?`
        }]);
      } catch (error) {
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          type: 'bot',
          text: `❌ Erro ao processar arquivo: ${error.message}`
        }]);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Gera resposta de análise
  const generateAnalysis = (question) => {
    if (!sheetData || sheetData.length === 0) {
      return "Carregue uma planilha primeiro!";
    }

    const q = question.toLowerCase();
    const columns = Object.keys(sheetData[0]);
    
    // Encontra a coluna de receita/valor (evita ID e quantidade)
    let valueCol = null;
    for (let col of columns) {
      const lower = col.toLowerCase();
      if (lower.includes('receita') || lower.includes('faturamento') || lower.includes('valor') || lower.includes('venda')) {
        valueCol = col;
        break;
      }
    }

    // Se não encontrou, pega a primeira coluna numérica que não é ID
    if (!valueCol) {
      for (let col of columns) {
        const lower = col.toLowerCase();
        if (!lower.includes('id') && !lower.includes('quantidade') && !lower.includes('data')) {
          if (sheetData.some(row => !isNaN(parseFloat(row[col])))) {
            valueCol = col;
            break;
          }
        }
      }
    }

    let response = "";

    // Pergunta sobre total, soma, quanto, faturamento
    if (q.includes('total') || q.includes('soma') || q.includes('quanto') || q.includes('faturamento') || q.includes('vendas')) {
      if (valueCol) {
        let numbers = [];
        sheetData.forEach(row => {
          const val = parseFloat(row[valueCol]);
          if (!isNaN(val)) numbers.push(val);
        });

        if (numbers.length > 0) {
          const sum = numbers.reduce((a, b) => a + b, 0);
          const avg = (sum / numbers.length).toFixed(2);
          const max = Math.max(...numbers);
          const min = Math.min(...numbers);
          
          response = `📊 ANÁLISE DE VENDAS (${valueCol})\n\n`;
          response += `💰 Total: R$ ${sum.toFixed(2)}\n`;
          response += `📈 Média: R$ ${avg}\n`;
          response += `⬆️ Máximo: R$ ${max.toFixed(2)}\n`;
          response += `⬇️ Mínimo: R$ ${min.toFixed(2)}\n`;
          response += `📝 Registros: ${numbers.length}`;
          return response;
        }
      }
    }

    // Pergunta sobre média
    if (q.includes('média') || q.includes('media')) {
      if (valueCol) {
        let numbers = [];
        sheetData.forEach(row => {
          const val = parseFloat(row[valueCol]);
          if (!isNaN(val)) numbers.push(val);
        });

        if (numbers.length > 0) {
          const avg = (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2);
          response = `📈 MÉDIA (${valueCol})\n\n`;
          response += `Média: R$ ${avg}\n`;
          response += `Registros analisados: ${numbers.length}`;
          return response;
        }
      }
    }

    // Pergunta sobre comparação entre períodos
    if (q.includes('compara') || q.includes('versus') || q.includes('vs ') || q.includes('entre')) {
      const dateCol = columns.find(c => c.toLowerCase().includes('data'));
      if (dateCol && valueCol) {
        const periods = [...new Set(sheetData.map(r => r[dateCol]).filter(v => v))];
        
        if (periods.length >= 2) {
          response = `📊 ANÁLISE COMPARATIVA\n\n`;
          
          // Pega os dois primeiros períodos
          const p1 = sheetData.filter(r => r[dateCol] === periods[0]);
          const p2 = sheetData.filter(r => r[dateCol] === periods[1]);
          
          const sum1 = p1.reduce((a, b) => a + parseFloat(b[valueCol] || 0), 0);
          const sum2 = p2.reduce((a, b) => a + parseFloat(b[valueCol] || 0), 0);
          const diff = ((sum2 - sum1) / sum1 * 100).toFixed(1);
          
          response += `${periods[0]}: R$ ${sum1.toFixed(2)} (${p1.length} registros)\n`;
          response += `${periods[1]}: R$ ${sum2.toFixed(2)} (${p2.length} registros)\n`;
          response += `${diff > 0 ? '📈' : '📉'} Variação: ${diff}%`;
          return response;
        }
      }
    }

    // Pergunta sobre melhor/top/pior
    if (q.includes('melhor') || q.includes('top') || q.includes('pior') || q.includes('ranking') || q.includes('melhores')) {
      if (valueCol) {
        const sorted = [...sheetData].sort((a, b) => 
          parseFloat(b[valueCol] || 0) - parseFloat(a[valueCol] || 0)
        );

        response = `🏆 TOP 5 MELHORES (${valueCol})\n\n`;
        sorted.slice(0, 5).forEach((row, i) => {
          response += `${i + 1}. R$ ${parseFloat(row[valueCol]).toFixed(2)}\n`;
        });
        return response;
      }
    }

    // Pergunta sobre categoria, região, produto
    if (q.includes('categoria') || q.includes('região') || q.includes('regiao') || q.includes('produto')) {
      const catCol = columns.find(c => c.toLowerCase().includes('categoria') || c.toLowerCase().includes('produto'));
      const regionCol = columns.find(c => c.toLowerCase().includes('região') || c.toLowerCase().includes('regiao'));
      
      const col = catCol || regionCol;
      if (col) {
        const unique = [...new Set(sheetData.map(r => r[col]).filter(v => v))];
        response = `📂 ${col}\n\n`;
        response += `Total de categorias: ${unique.length}\n\n`;
        response += unique.slice(0, 8).map(v => `• ${v}`).join('\n');
        return response;
      }
    }

    // Pergunta sobre região
    if (q.includes('região') || q.includes('regiao')) {
      const regionCol = columns.find(c => c.toLowerCase().includes('região') || c.toLowerCase().includes('regiao'));
      if (regionCol && valueCol) {
        const regions = [...new Set(sheetData.map(r => r[regionCol]).filter(v => v))];
        response = `🗺️ ANÁLISE POR REGIÃO\n\n`;
        
        regions.slice(0, 5).forEach(region => {
          const regionData = sheetData.filter(r => r[regionCol] === region);
          const sum = regionData.reduce((a, b) => a + parseFloat(b[valueCol] || 0), 0);
          response += `${region}: R$ ${sum.toFixed(2)}\n`;
        });
        return response;
      }
    }

    // Se nada bateu, retorna dica
    response = `📋 INFORMAÇÕES DO ARQUIVO\n\n`;
    response += `Total de registros: ${sheetData.length}\n`;
    response += `Coluna de valor: ${valueCol || 'não identificada'}\n`;
    response += `Colunas: ${columns.join(', ')}\n\n`;
    response += `Tente perguntar:\n`;
    response += `• "Qual é o total de vendas?"\n`;
    response += `• "Qual a média?"\n`;
    response += `• "Mostre os melhores"\n`;
    response += `• "Compare períodos"\n`;
    response += `• "Análise por região"`;

    return response;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!sheetData) {
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        type: 'bot',
        text: '⚠️ Carregue uma planilha primeiro!'
      }]);
      return;
    }

    // Adiciona mensagem do usuário
    const userMsg = {
      id: messages.length + 1,
      type: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let analysis;

      if (useLLM) {
        // Usa OpenAI
        analysis = await callOpenAI(input);
      } else {
        // Usa análise local
        analysis = generateAnalysis(input);
      }

      const botMsg = {
        id: messages.length + 2,
        type: 'bot',
        text: analysis
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        type: 'bot',
        text: `❌ Erro: ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getDashboardStats = () => {
    if (!sheetData || sheetData.length === 0) {
      return { total: 'N/A', registros: 0, media: 'N/A', maxValue: 'N/A' };
    }

    let numbers = [];
    Object.keys(sheetData[0]).forEach(col => {
      sheetData.forEach(row => {
        const val = parseFloat(row[col]);
        if (!isNaN(val)) numbers.push(val);
      });
    });

    if (numbers.length === 0) {
      return { total: 'N/A', registros: sheetData.length, media: 'N/A', maxValue: 'N/A' };
    }

    const sum = numbers.reduce((a, b) => a + b, 0);
    const avg = (sum / numbers.length).toFixed(2);
    const max = Math.max(...numbers);

    return {
      total: `R$ ${sum.toFixed(0)}`,
      registros: sheetData.length,
      media: `R$ ${avg}`,
      maxValue: `R$ ${max.toFixed(0)}`
    };
  };

  const stats = getDashboardStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white overflow-hidden relative">
      {/* Elementos flutuantes */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 opacity-5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 opacity-5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500 opacity-5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-md bg-slate-950/50 border-b border-purple-500/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center">
              <MessageCircle size={24} />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Alpha Insights
            </h1>
          </div>
        </div>
      </header>

      <div className="relative z-5 max-w-7xl mx-auto px-4 py-8">
        {/* KPI Cards */}
        <div className="flex gap-4 mb-8 flex-wrap">
          {[
            { icon: TrendingUp, label: 'Total', value: stats.total, color: 'from-purple-500 to-purple-600' },
            { icon: BarChart3, label: 'Registros', value: stats.registros, color: 'from-blue-500 to-blue-600' },
            { icon: MessageCircle, label: 'Média', value: stats.media, color: 'from-indigo-500 to-indigo-600' },
            { icon: TrendingUp, label: 'Máximo', value: stats.maxValue, color: 'from-cyan-500 to-cyan-600' }
          ].map((kpi, i) => (
            <div key={i} className="w-44 h-44 backdrop-blur-md bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center text-center">
              <div className={`w-10 h-10 bg-gradient-to-br ${kpi.color} rounded-lg flex items-center justify-center mb-3`}>
                <kpi.icon size={20} />
              </div>
              <p className="text-xs text-gray-400 mb-2 font-medium">{kpi.label}</p>
              <p className="text-base font-bold line-clamp-2">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="grid md:grid-cols-3 gap-8">
          {/* Chat */}
          <div className="md:col-span-2 backdrop-blur-md bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-purple-500/20 rounded-2xl overflow-hidden flex flex-col h-[600px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-3 rounded-lg backdrop-blur-sm whitespace-pre-wrap text-sm ${
                    msg.type === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-slate-700/50 text-gray-100 border border-purple-500/20'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700/50 border border-purple-500/20 px-4 py-3 rounded-lg">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-purple-500/20 p-4 bg-gradient-to-t from-slate-900/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Faça uma pergunta..."
                  className="flex-1 bg-slate-700/50 border border-purple-500/30 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition text-white placeholder-gray-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 p-3 rounded-lg transition"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Upload */}
            <div className="backdrop-blur-md bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-purple-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload size={20} />
                Planilha
              </h3>
              
              {sheetData ? (
                <div className="space-y-3">
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                    <p className="text-sm text-green-400 mb-2">✅ Carregado</p>
                    <p className="text-xs text-gray-300 truncate">{sheetName}</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-700/50 hover:bg-slate-700 border border-purple-500/30 rounded-lg px-3 py-2 text-sm transition"
                  >
                    Trocar Arquivo
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg px-4 py-3 font-semibold flex items-center justify-center gap-2"
                >
                  <FileText size={20} />
                  CSV / XLSX
                </button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* LLM Toggle */}
            <div className="backdrop-blur-md bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-purple-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap size={20} />
                Modo IA
              </h3>
              
              <button
                onClick={() => setUseLLM(!useLLM)}
                className={`w-full px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  useLLM
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    : 'bg-slate-700/50 hover:bg-slate-700 border border-purple-500/30'
                }`}
              >
                {useLLM ? (
                  <>
                    <Zap size={18} />
                    IA Ativa
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    IA Desativa
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-400 mt-3">
                {useLLM 
                  ? '🤖 Respostas com inteligência artificial (ChatGPT)'
                  : '📊 Respostas com análise local'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
