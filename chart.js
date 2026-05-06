let graficoAtual = null;
let tipoGraficoAtivo = 'categoria';

function abrirGraficos() {
    trocarAba('graficos');
    document.getElementById('modal-graficos').style.display = 'flex';
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mes = mesAtual.getMonth();
    const ano = mesAtual.getFullYear();
    document.getElementById('grafico-mes').textContent = `${meses[mes]} ${ano}`;
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
    tipoGraficoAtivo = tipo;
    document.getElementById('btn-cat').className = tipo === 'categoria'
   ? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold'
    : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';
    document.getElementById('btn-tipo').className = tipo === 'tipo'
   ? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold'
    : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';
    desenharGrafico();
}

function desenharGrafico() {
    const mes = mesAtual.getMonth();
    const ano = mesAtual.getFullYear();
    const transacoesMes = dados.filter(t => {
        const dt = new Date(t.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    if (graficoAtual) graficoAtual.destroy();

    const ctx = document.getElementById('grafico-canvas').getContext('2d');
    const isLight = document.body.classList.contains('light-mode');
    const corTexto = isLight? '#1e293b' : '#f1f5f9';
    const corGrid = isLight? '#e2e8f0' : '#334155';

    if (tipoGraficoAtivo === 'categoria') {
        const gastosPorCat = {};
        transacoesMes.filter(t => t.tipo!== 'entrada').forEach(t => {
            gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + t.valor;
        });

        const dadosGraf = Object.entries(gastosPorCat)
       .sort((a, b) => b[1] - a[1])
       .slice(0, 8);

        if (dadosGraf.length === 0) {
            document.getElementById('grafico-legenda').innerHTML = '<p class="text-center text-slate-500 py-8">Sem gastos no mês</p>';
            return;
        }

        const labels = dadosGraf.map(d => d[0]);
        const valores = dadosGraf.map(d => d[1]);
        const total = valores.reduce((s, v) => s + v, 0);

        graficoAtual = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: '#3b82f6',
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return `R$ ${ctx.raw.toFixed(2).replace('.', ',')} - ${pct}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: corTexto,
                            callback: (v) => `R$ ${v}`
                        },
                        grid: { color: corGrid }
                    },
                    y: {
                        ticks: { color: corTexto },
                        grid: { display: false }
                    }
                }
            }
        });

        document.getElementById('grafico-legenda').innerHTML = dadosGraf.map(([cat, val]) => {
            const pct = ((val / total) * 100).toFixed(1);
            return `
                <div class="flex justify-between text-xs py-1">
                    <span>${cat}</span>
                    <span class="font-bold">R$ ${val.toFixed(2).replace('.', ',')} - ${pct}%</span>
                </div>
            `;
        }).join('');

    } else {
        let entrada = 0, saida = 0, cartao = 0;
        transacoesMes.forEach(t => {
            if (t.tipo === 'entrada') entrada += t.valor;
            else if (t.tipo === 'saida' && t.metodo!== 'cartao') saida += t.valor;
            else if (t.tipo === 'saida' && t.metodo === 'cartao') cartao += t.valor;
        });

        const totalGasto = saida + cartao;
        const total = entrada + totalGasto;

        if (total === 0) {
            document.getElementById('grafico-legenda').innerHTML = '<p class="text-center text-slate-500 py-8">Sem dados no mês</p>';
            return;
        }

        graficoAtual = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Entradas', 'Saídas', 'Cartões'],
                datasets: [{
                    data: [entrada, saida, cartao],
                    backgroundColor: ['#10b981', '#f97316', '#ef4444'],
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
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return `${ctx.label}: R$ ${ctx.raw.toFixed(2).replace('.', ',')} - ${pct}%`;
                            }
                        }
                    }
                }
            }
        });

        const dadosLegenda = [
            { label: 'Entradas', valor: entrada, cor: '#10b981' },
            { label: 'Saídas', valor: saida, cor: '#f97316' },
            { label: 'Cartões', valor: cartao, cor: '#ef4444' }
        ].filter(d => d.valor > 0);

        document.getElementById('grafico-legenda').innerHTML = dadosLegenda.map(d => {
            const pct = ((d.valor / total) * 100).toFixed(1);
            return `
                <div class="flex justify-between items-center text-xs py-1">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded" style="background:${d.cor}"></div>
                        <span>${d.label}</span>
                    </div>
                    <span class="font-bold">R$ ${d.valor.toFixed(2).replace('.', ',')} - ${pct}%</span>
                </div>
            `;
        }).join('');
    }
}
