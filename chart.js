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
    const botoes = ['categoria', 'tipo', 'conta', 'receita', 'fluxo'];
    botoes.forEach(t => {
        const btn = document.getElementById(`btn-${t}`);
        if (btn) {
            btn.className = tipo === t
                ? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold'
                : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';
        }
    });
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
        // GASTOS POR CATEGORIA
        const gastosPorCat = {};
        transacoesMes.filter(t => t.tipo === 'saida').forEach(t => {
            gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + t.valor;
        });

        const dadosGraf = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (dadosGraf.length === 0) return semDados();

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
            options: getBarOptions(corTexto, corGrid, total)
        });
        renderLegenda(dadosGraf, total);

    } else if (tipoGraficoAtivo === 'tipo') {
        // ENTRADA X SAÍDA X CARTÃO
        let entrada = 0, saida = 0, cartao = 0;
        transacoesMes.forEach(t => {
            if (t.tipo === 'entrada') entrada += t.valor;
            else if (t.metodo!== 'cartao') saida += t.valor;
            else cartao += t.valor;
        });

        const total = entrada + saida + cartao;
        if (total === 0) return semDados();

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
            options: getDoughnutOptions(total)
        });

        const dadosLegenda = [
            { label: 'Entradas', valor: entrada, cor: '#10b981' },
            { label: 'Saídas', valor: saida, cor: '#f97316' },
            { label: 'Cartões', valor: cartao, cor: '#ef4444' }
        ].filter(d => d.valor > 0);
        renderLegendaCores(dadosLegenda, total);

    } else if (tipoGraficoAtivo === 'conta') {
        // GASTOS POR CONTA/BANCO
        const gastosPorConta = {};
        transacoesMes.filter(t => t.tipo === 'saida' && t.metodo!== 'cartao').forEach(t => {
            const banco = t.banco || 'Principal';
            gastosPorConta[banco] = (gastosPorConta[banco] || 0) + t.valor;
        });

        const dadosGraf = Object.entries(gastosPorConta).sort((a, b) => b[1] - a[1]);
        if (dadosGraf.length === 0) return semDados();

        const labels = dadosGraf.map(d => d[0]);
        const valores = dadosGraf.map(d => d[1]);
        const total = valores.reduce((s, v) => s + v, 0);

        graficoAtual = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: '#8b5cf6',
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: getBarOptions(corTexto, corGrid, total)
        });
        renderLegenda(dadosGraf, total);

    } else if (tipoGraficoAtivo === 'receita') {
        // RECEITAS POR CATEGORIA
        const receitaPorCat = {};
        transacoesMes.filter(t => t.tipo === 'entrada').forEach(t => {
            receitaPorCat[t.categoria] = (receitaPorCat[t.categoria] || 0) + t.valor;
        });

        const dadosGraf = Object.entries(receitaPorCat).sort((a, b) => b[1] - a[1]);
        if (dadosGraf.length === 0) return semDados();

        const labels = dadosGraf.map(d => d[0]);
        const valores = dadosGraf.map(d => d[1]);
        const total = valores.reduce((s, v) => s + v, 0);

        graficoAtual = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: '#10b981',
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: getBarOptions(corTexto, corGrid, total)
        });
        renderLegenda(dadosGraf, total);

    } else if (tipoGraficoAtivo === 'fluxo') {
        // FLUXO DO MÊS - ENTRADAS VS SAÍDAS POR DIA
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const labels = Array.from({length: diasNoMes}, (_, i) => i + 1);
        const entradasDia = new Array(diasNoMes).fill(0);
        const saidasDia = new Array(diasNoMes).fill(0);

        transacoesMes.forEach(t => {
            const dia = new Date(t.data).getDate() - 1;
            if (t.tipo === 'entrada') entradasDia[dia] += t.valor;
            else saidasDia[dia] += t.valor;
        });

        graficoAtual = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Entradas',
                        data: entradasDia,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Saídas',
                        data: saidasDia,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: corTexto }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: R$ ${ctx.raw.toFixed(2).replace('.', ',')}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: corTexto },
                        grid: { color: corGrid }
                    },
                    y: {
                        ticks: {
                            color: corTexto,
                            callback: (v) => `R$ ${v}`
                        },
                        grid: { color: corGrid }
                    }
                }
            }
        });
        document.getElementById('grafico-legenda').innerHTML = '';
    }
}

// FUNÇÕES AUXILIARES
function semDados() {
    document.getElementById('grafico-legenda').innerHTML = '<p class="text-center text-slate-500 py-8">Sem dados no mês</p>';
}

function getBarOptions(corTexto, corGrid, total) {
    return {
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
                ticks: { color: corTexto, callback: (v) => `R$ ${v}` },
                grid: { color: corGrid }
            },
            y: { ticks: { color: corTexto }, grid: { display: false } }
        }
    };
}

function getDoughnutOptions(total) {
    return {
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
    };
}

function renderLegenda(dados, total) {
    document.getElementById('grafico-legenda').innerHTML = dados.map(([cat, val]) => {
        const pct = ((val / total) * 100).toFixed(1);
        return `
            <div class="flex justify-between text-xs py-1">
                <span>${cat}</span>
                <span class="font-bold">R$ ${val.toFixed(2).replace('.', ',')} - ${pct}%</span>
            </div>
        `;
    }).join('');
}

function renderLegendaCores(dados, total) {
    document.getElementById('grafico-legenda').innerHTML = dados.map(d => {
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
