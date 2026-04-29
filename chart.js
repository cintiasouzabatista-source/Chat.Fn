// chart.js - Gráficos profissionais do Chat Financeiro

let graficoAtual = null;
let tipoGraficoAtual = 'categoria';

function abrirGraficos() {
    setMenuAtivo('graficos');
    document.getElementById('modal-graficos').style.display = 'flex';

    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [ano, mes] = mesAtual.split('-');
    document.getElementById('grafico-mes').textContent = `${meses[parseInt(mes)-1]} ${ano}`;

    trocarGrafico('categoria');
}

function fecharGraficos() {
    document.getElementById('modal-graficos').style.display = 'none';
    if (graficoAtual) {
        graficoAtual.destroy();
        graficoAtual = null;
    }
}

function trocarGrafico(tipo) {
    tipoGraficoAtual = tipo;

    document.getElementById('btn-cat').className = tipo === 'categoria'
      ? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold'
        : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';

    document.getElementById('btn-tipo').className = tipo === 'tipo'
      ? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold'
        : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';

    const [ano, mesNum] = mesAtual.split('-').map(Number);
    const transacoesMes = transacoes.filter(t => {
        const dt = new Date(t.data);
        return dt.getMonth() === mesNum - 1 && dt.getFullYear() === ano;
    });

    if (graficoAtual) graficoAtual.destroy();

    const ctx = document.getElementById('grafico-canvas').getContext('2d');
    const isDark =!document.body.classList.contains('light-mode');

    if (tipo === 'categoria') {
        let porCategoria = {};
        transacoesMes.forEach(t => {
            if (t.tipo!== 'entrada') {
                porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor;
            }
        });

        const labels = Object.keys(porCategoria);
        const dados = Object.values(porCategoria);
        const total = dados.reduce((a,b) => a+b, 0);

        if (labels.length === 0) {
            document.getElementById('grafico-legenda').innerHTML = '<p class="text-center text-slate-500">Nenhum gasto no mês</p>';
            return;
        }

        const cores = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

        graficoAtual = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dados,
                    backgroundColor: cores,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.parsed;
                                const perc = ((val/total)*100).toFixed(1);
                                return `R$ ${val.toFixed(2).replace('.',',')} - ${perc}%`;
                            }
                        }
                    }
                }
            }
        });

        document.getElementById('grafico-legenda').innerHTML = labels.map((cat, i) => {
            const val = dados[i];
            const perc = ((val/total)*100).toFixed(1);
            return `
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded" style="background:${cores[i]}"></div>
                        <span>${cat}</span>
                    </div>
                    <span class="font-bold">R$ ${val.toFixed(2).replace('.',',')} - ${perc}%</span>
                </div>
            `;
        }).join('');

    } else {
        let entrada = 0, saida = 0, cartao = 0;
        transacoesMes.forEach(t => {
            if (t.tipo === 'entrada') entrada += t.valor;
            else if (t.tipo === 'saida') saida += t.valor;
            else if (t.tipo === 'cartao') cartao += t.valor;
        });

        graficoAtual = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Entrada', 'Saída', 'Cartão'],
                datasets: [{
                    data: [entrada, saida, cartao],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2).replace('.',',')}`
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: isDark? '#94a3b8' : '#475569',
                            callback: (val) => `R$ ${val}`
                        },
                        grid: { color: isDark? '#334155' : '#e2e8f0' }
                    },
                    x: {
                        ticks: { color: isDark? '#94a3b8' : '#475569' },
                        grid: { display: false }
                    }
                }
            }
        });

        document.getElementById('grafico-legenda').innerHTML = `
            <div class="flex justify-between"><span class="text-emerald-500">Entrada</span><span class="font-bold">R$ ${entrada.toFixed(2).replace('.',',')}</span></div>
            <div class="flex justify-between"><span class="text-orange-500">Saída</span><span class="font-bold">R$ ${saida.toFixed(2).replace('.',',')}</span></div>
            <div class="flex justify-between"><span class="text-rose-500">Cartão</span><span class="font-bold">R$ ${cartao.toFixed(2).replace('.',',')}</span></div>
        `;
    }
}
