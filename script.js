if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW erro:', err));
}

// VARIÁVEIS GLOBAIS
let tentativasPin = 0;
let pinBloqueadoAte = 0;
let modoTeste = localStorage.getItem('bankday_modo') === 'teste';
let modoProducao = localStorage.getItem('bankday_modo') === 'producao';
let menuTimeout = null;

let dados = JSON.parse(localStorage.getItem('bankday') || '[]');
let contas = JSON.parse(localStorage.getItem('bankday_contas') || '[]');
let cartoes = JSON.parse(localStorage.getItem('bankday_cartoes') || '[]');
let config = JSON.parse(localStorage.getItem('bankday_config') || '{"projetarSaldo":false}');

let mesAtual = new Date();
let valoresOcultos = false;
let editandoId = null;
let tempContas = [];
let tempCartoes = [];
let chartInstance = null;
let tutorialStep = 1;
const TOTAL_STEPS = 4;

const formatar = v => {
    v = Number(v) || 0;
    return valoresOcultos? 'R$ ••••' : `R$ ${v.toFixed(2).replace('.',',')}`;
};
const cap = s => s? s.charAt(0).toUpperCase() + s.slice(1) : '';

const CATEGORIAS = {
    entrada: {
        'Salário': ['salario','pagamento','freela'],
        'Vendas': ['venda','vendi','mercado','olx'],
        'Outras Receitas': []
    },
    saida: {
        'Alimentação': ['ifood','mercado','restaurante','cafe','lanche','pizza'],
        'Transporte': ['uber','99','gasolina','posto'],
        'Moradia': ['aluguel','luz','agua','internet'],
        'Lazer': ['cinema','netflix','spotify','bar'],
        'Compras': ['shopee','amazon','roupa','tenis'],
        'Outras Despesas': []
    }
};

function salvar() {
    localStorage.setItem('bankday', JSON.stringify(dados));
    localStorage.setItem('bankday_contas', JSON.stringify(contas));
    localStorage.setItem('bankday_cartoes', JSON.stringify(cartoes));
    localStorage.setItem('bankday_config', JSON.stringify(config));
}

function identificarCategoria(desc, tipo = 'saida') {
    if (!desc) return tipo === 'entrada'? 'Outras Receitas' : 'Outras Despesas';
    const d = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cats = CATEGORIAS;
    for (const [cat, palavras] of Object.entries(cats)) {
        if (palavras.some(p => d.includes(p))) return cat;
    }
    return tipo === 'entrada'? 'Outras Receitas' : 'Outras Despesas';
}

// INIT
function iniciarApp() {
    const modo = localStorage.getItem('bankday_modo');
    
    const modalOnboarding = document.getElementById('modal-onboarding');
    const telaPin = document.getElementById('tela-pin');
    const appContent = document.getElementById('app-content');
    
    if (!modo) {
        if (appContent) appContent.style.display = 'none';
        if (telaPin) telaPin.style.display = 'none';
        if (modalOnboarding) modalOnboarding.style.display = 'flex';
        atualizarMes();
        atualizar();
        return;
    }
    
    if (modo === 'teste') {
        if (telaPin) telaPin.style.display = 'none';
        if (appContent) appContent.style.display = 'flex';
        if (!contas.length) contas = [{nome: 'Conta Teste', saldoInicial: 0}];
    } else {
        initPin();
    }
    
    atualizarMes();
    atualizar();
}

// PIN
function initPin() {
    const telaPin = document.getElementById('tela-pin');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;

    document.getElementById('pin-titulo').textContent = EH_PRIMEIRO? 'Crie seu PIN' : 'Digite seu PIN';
    document.getElementById('pin-subtitulo').textContent = EH_PRIMEIRO? '4 dígitos para proteger o app' : 'Para acessar o app';
    document.getElementById('btn-esqueci').style.display = EH_PRIMEIRO? 'none' : 'block';

    const inputs = document.querySelectorAll('.pin-input');
    inputs.forEach((input, idx) => {
        input.value = '';
        input.disabled = false;
        input.oninput = (e) => {
            if (e.target.value.length === 1 && idx < 3) inputs[idx + 1].focus();
            if (idx === 3 && e.target.value.length === 1) setTimeout(validarPin, 100);
        };
        input.onkeydown = (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && idx > 0) inputs[idx - 1].focus();
        };
    });
    inputs[0].focus();
    telaPin.style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
}

function validarPin() {
    const inputs = document.querySelectorAll('.pin-input');
    const pin = Array.from(inputs).map(i => i.value).join('');
    if (pin.length!== 4) return;[F12]

    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;
    const erro = document.getElementById('pin-erro');

    if (EH_PRIMEIRO) {
        localStorage.setItem('bankday_pin', btoa(pin));
        tentativasPin = 0;
        pinBloqueadoAte = 0;
        liberarApp();
    } else {
        if (btoa(pin) === PIN_SALVO) {
            tentativasPin = 0;
            pinBloqueadoAte = 0;
            erro.classList.add('hidden');
            liberarApp();
        } else {
            tentativasPin++;
            erro.textContent = `PIN incorreto. ${3 - tentativasPin} tentativas restantes`;
            erro.classList.remove('hidden');
            inputs.forEach(i => {
                i.value = '';
                i.classList.add('border-rose-500');
            });
            inputs[0].focus();
            setTimeout(() => inputs.forEach(i => i.classList.remove('border-rose-500')), 1000);

            if (tentativasPin >= 3) {
                pinBloqueadoAte = Date.now() + 30000;
                bloquearPin(30);
            }
        }
    }
}

function bloquearPin(s) {
    const inputs = document.querySelectorAll('.pin-input');
    const erro = document.getElementById('pin-erro');
    inputs.forEach(i => {
        i.disabled = true;
        i.value = '';
    });
    let contador = s;
    erro.classList.remove('hidden');
    erro.textContent = `Muitas tentativas. Tente em ${contador}s`;

    const interval = setInterval(() => {
        contador--;
        if (contador <= 0) {
            clearInterval(interval);
            inputs.forEach(i => i.disabled = false);
            erro.classList.add('hidden');
            inputs[0].focus();
            tentativasPin = 0;
            pinBloqueadoAte = 0;
        } else {
            erro.textContent = `Muitas tentativas. Tente em ${contador}s`;
        }
    }, 1000);
}

function initPin() {
    const telaPin = document.getElementById('tela-pin');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;

    document.getElementById('pin-titulo').textContent = EH_PRIMEIRO? 'Crie seu PIN' : 'Digite seu PIN';
    document.getElementById('pin-subtitulo').textContent = EH_PRIMEIRO? '4 dígitos para proteger o app' : 'Para acessar o app';
    document.getElementById('btn-esqueci').style.display = EH_PRIMEIRO? 'none' : 'block';

    const inputs = document.querySelectorAll('.pin-input');
    inputs.forEach((input, idx) => {
        input.value = '';
        input.disabled = false;
        input.classList.remove('border-rose-500');
        input.oninput = (e) => {
            if (e.target.value.length === 1 && idx < 3) inputs[idx + 1].focus();
            if (idx === 3 && e.target.value.length === 1) setTimeout(validarPin, 100);
        };
        input.onkeydown = (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && idx > 0) inputs[idx - 1].focus();
        };
    });

    // CHECA SE TÁ BLOQUEADO
    const agora = Date.now();
    if (pinBloqueadoAte > agora) {
        const segundos = Math.ceil((pinBloqueadoAte - agora) / 1000);
        bloquearPin(segundos);
    } else {
        inputs[0].focus();
        pinBloqueadoAte = 0;
        tentativasPin = 0;
    }

    telaPin.style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
}
function esqueciPin() {
    if (confirm('Esqueceu o PIN?\n\nIsso vai apagar TODOS os dados.')) {
        localStorage.clear();
        location.reload();
    }
}

function selecionarModo(tipo) {
    localStorage.setItem('bankday_modo', tipo);
    document.getElementById('modal-onboarding').style.display = 'none';
    if (tipo === 'producao') {
        modoProducao = true;
        modoTeste = false;
    } else {
        modoTeste = true;
        modoProducao = false;
        if (!contas.length) contas = [{nome: 'Conta Teste', saldoInicial: 0}];
        salvar();
    }
    document.getElementById('app-content').style.display = 'flex';
}

// CHAT
function addMensagem(texto, tipo = 'system', info = '', autoLimpar = true, id = null) {
    const chat = document.getElementById("chat-box");
    if (!chat) return;
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement("div");
    div.className = `msg ${tipo}`;
    if (id) div.onclick = () => abrirModalEditar(id);
    div.innerHTML = `
        <div class="msg-bubble">
            <p>${texto}</p>
            ${info? `<div class="msg-info">${info}</div>` : ''}
            <div class="msg-time">${hora}</div>
        </div>
    `;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (autoLimpar && tipo === 'system') {
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 8000);
    }
}

function processarMensagem() {
function parceleiNoCartao(descricao, valorTotal, parcelas, cartaoNome) {
    let cartao = cartoes.find(c => c.nome.toLowerCase() === cartaoNome.toLowerCase()) || cartoes[0];
    if (!cartao) {
        addMensagem(`Cadastre um cartão primeiro`, 'system');
        return;
    }
    const valorParcela = Math.floor(valorTotal / parcelas * 100) / 100;
    const resto = +(valorTotal - valorParcela * (parcelas - 1)).toFixed(2);
    const hoje = new Date();
    let primeiroId = null;

    for (let i = 0; i < parcelas; i++) {
        let dataCompra = new Date(hoje.getFullYear(), hoje.getMonth() + i, hoje.getDate());
        let mesFatura = dataCompra.getMonth();
        let anoFatura = dataCompra.getFullYear();
        if (dataCompra.getDate() > cartao.diaFechamento) {
            mesFatura++;
            if (mesFatura > 11) { mesFatura = 0; anoFatura++; }
        }
        const dataVencimento = new Date(anoFatura, mesFatura, cartao.diaVencimento);
        const valorFinal = i === parcelas - 1? resto : valorParcela;
        const id = Date.now() + i + Math.random();
        if (i === 0) primeiroId = id;

        dados.push({
            id: id,
            descricao: descricao,
            valor: valorFinal,
            tipo: "saida",
            metodo: "cartao",
            banco: cartao.nome,
            data: dataVencimento.toISOString(),
            texto: `${descricao} ${i+1}/${parcelas}`,
            parcelaAtual: i + 1,
            totalParcelas: parcelas,
            valorTotalCompra: valorTotal,
            categoria: identificarCategoria(descricao, 'saida')
        });
    }
    salvar();
    addMensagem(`${descricao} ${parcelas}x de R$ ${valorParcela.toFixed(2)} no ${cartao.nome}`, 'user', `Fecha dia ${cartao.diaFechamento} | Vence dia ${cartao.diaVencimento}`, false, primeiroId);
    atualizar();
}

// ATUALIZAR CARDS
function atualizar() {
    const mes = mesAtual.getMonth(), ano = mesAtual.getFullYear();
    const dadosMes = dados.filter(d => {
        const dt = new Date(d.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    const ent = dadosMes.filter(d => d.tipo === 'entrada').reduce((s,d) => s + d.valor, 0);
    const sai = dadosMes.filter(d => d.tipo === 'saida' && d.metodo!== 'cartao').reduce((s,d) => s + d.valor, 0);
    const fat = dadosMes.filter(d => d.tipo === 'saida' && d.metodo === 'cartao').reduce((s,d) => s + d.valor, 0);
    const saldo = ent - sai;
    const liquido = saldo - fat;

    const elEntradas = document.getElementById('card-entradas');
    const elSaidas = document.getElementById('card-saidas');
    const elSaldo = document.getElementById('card-saldo');
    const elCartoes = document.getElementById('card-cartoes');
    const elLiquido = document.getElementById('card-liquido');

    if (elEntradas) elEntradas.textContent = formatar(ent);
    if (elSaidas) elSaidas.textContent = formatar(sai);
    if (elSaldo) elSaldo.textContent = formatar(saldo);
    if (elCartoes) elCartoes.textContent = formatar(fat);
    if (elLiquido) elLiquido.textContent = formatar(liquido);

    if (elSaldo) elSaldo.className = `val text-lg font-black mt-1 ${saldo >= 0? 'text-blue' : 'text-rose'}`;
    if (elLiquido) elLiquido.className = `val text-emerald big ${liquido >= 0? 'text-emerald' : 'text-rose'}`;
}

function atualizarMes() {
    const el = document.getElementById('mesAtual');
    if (el) el.textContent = cap(mesAtual.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(' de ',' '));
}

function mudarMes(d) {
    mesAtual.setMonth(mesAtual.getMonth() + d);
    atualizar();
    atualizarMes();
}

// HEADER
function toggleTheme() {
    document.body.classList.toggle('dark');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = document.body.classList.contains('dark')? 'fas fa-sun text-amber-500 text-lg' : 'fas fa-moon text-blue-500 text-lg';
    localStorage.setItem('bankday_tema', document.body.classList.contains('dark')? 'dark' : 'light');
}

function toggleVisibility() {
    valoresOcultos =!valoresOcultos;
    document.getElementById('eye-icon').className = valoresOcultos? 'fas fa-eye-slash text-lg' : 'fas fa-eye text-lg';
    atualizar();
}

function toggleMenu() {
    const menu = document.getElementById('menuDropdown');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    if (menuTimeout) clearTimeout(menuTimeout);
    if (isHidden) {
        menu.classList.remove('hidden');
        menuTimeout = setTimeout(() => menu.classList.add('hidden'), 10000);
    } else {
        menu.classList.add('hidden');
    }
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('menuDropdown');
    const btn = document.getElementById('btnMenu');
    if (!menu || menu.classList.contains('hidden')) return;
    if (!menu.contains(e.target) &&!btn?.contains(e.target)) {
        menu.classList.add('hidden');
        if (menuTimeout) clearTimeout(menuTimeout);
    }
});

// NAVEGAÇÃO
function trocarAba(aba) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');

    if (aba === 'extrato') abrirModal('modal-extrato');
    if (aba === 'graficos') abrirModal('modal-graficos');
    if (aba === 'chat') {
        fecharModal('modal-extrato');
        fecharModal('modal-graficos');
    }
}

// MODAIS
function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
    if (id === 'modal-extrato') filtrarExtrato();
    if (id === 'modal-graficos') mostrarGrafico('despesas');
    if (id === 'modal-contas') {
        tempContas = [...contas];
        tempCartoes = [...cartoes];
        renderizarListaTemp();
    }
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

// EXTRATO
function filtrarExtrato() {
    const tipo = document.getElementById('filtro-tipo').value;
    const cat = document.getElementById('filtro-categoria').value;

    let filtrados = [...dados];
    if (tipo) filtrados = filtrados.filter(d => d.tipo === tipo || d.metodo === tipo);
    if (cat) filtrados = filtrados.filter(d => d.categoria === cat);

    const ent = filtrados.filter(d => d.tipo === 'entrada').reduce((s,d) => s+d.valor, 0);
    const sai = filtrados.filter(d => d.tipo === 'saida').reduce((s,d) => s+d.valor, 0);
    document.getElementById('total-extrato').textContent = `Entradas: ${formatar(ent)} | Saídas: ${formatar(sai)} | Saldo: ${formatar(ent - sai)}`;

    const lista = document.getElementById('lista-extrato');
    lista.innerHTML = filtrados.sort((a,b) => new Date(b.data) - new Date(a.data)).map(t => `
        <div class="item-temp" onclick="abrirModalEditar(${t.id})" style="cursor:pointer">
            <div>
                <div style="font-weight:600">${t.descricao}</div>
                <div style="font-size:11px;color:#64748b">${t.categoria} • ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.banco}</div>
            </div>
            <div style="font-weight:900;color:${t.tipo === 'entrada'? '#10b981' : '#f43f5e'}">
                ${t.tipo === 'entrada'? '+' : '-'} ${formatar(t.valor)}
            </div>
        </div>
    `).join('') || '<p style="text-align:center;color:#64748b">Nenhuma transação encontrada</p>';

    // Popular categorias
    const catSelect = document.getElementById('filtro-categoria');
    const cats = new Set();
    dados.forEach(d => cats.add(d.categoria));
    catSelect.innerHTML = '<option value="">Todas categorias</option>' + Array.from(cats).sort().map(c => `<option value="${c}">${c}</option>`).join('');
}

// GRÁFICOS
function mostrarGrafico(tipo, btn) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.querySelector('.tab').classList.add('active');

    const mes = mesAtual.getMonth(), ano = mesAtual.getFullYear();
    const dadosMes = dados.filter(d => { const dt = new Date(d.data); return dt.getMonth() === mes && dt.getFullYear() === ano; });

    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('chartCanvas').getContext('2d');

    if (tipo === 'despesas') {
        const cats = {};
        dadosMes.filter(d => d.tipo === 'saida').forEach(d => {
            cats[d.categoria] = (cats[d.categoria] || 0) + d.valor;
        });
        const sorted = Object.entries(cats).sort((a,b) => b - a);
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([c]) => c),
                datasets: [{ label: 'Despesas', data: sorted.map(([,v]) => v), backgroundColor: '#f43f5e' }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } } }
        });
    } else if (tipo === 'receitas') {
        const ent = dadosMes.filter(d => d.tipo === 'entrada').reduce((s,d) => s+d.valor, 0);
        const sai = dadosMes.filter(d => d.tipo === 'saida').reduce((s,d) => s+d.valor, 0);
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Receitas', 'Despesas'],
                datasets: [{ data: [ent, sai], backgroundColor: ['#10b981', '#f43f5e'] }]
            },
            options: { plugins: { legend: { display: false } } }
        });
    } else if (tipo === 'bancos') {
        const bancos = {};
        dadosMes.forEach(d => { bancos[d.banco] = (bancos[d.banco] || 0) + d.valor; });
        chartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(bancos),
                datasets: [{ data: Object.values(bancos), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6'] }]
            }
        });
    }
}

// CONTAS E CARTÕES
function renderizarListaTemp() {
    const listaContas = document.getElementById('lista-contas-temp');
    const listaCartoes = document.getElementById('lista-cartoes-temp');
    if (!listaContas ||!listaCartoes) return;
    listaContas.innerHTML = tempContas.map((c, i) => `
        <div class="item-temp">
            <span onclick="editarContaCartao('conta', ${i})">${c.nome} - ${formatar(c.saldoInicial || 0)}</span>
            <button onclick="removerTempConta(${i})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    listaCartoes.innerHTML = tempCartoes.map((c, i) => `
        <div class="item-temp">
            <span onclick="editarContaCartao('cartao', ${i})">${c.nome} - Fecha ${c.diaFechamento} | Vence ${c.diaVencimento}</span>
            <button onclick="removerTempCartao(${i})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function addTempConta() {
    const nome = document.getElementById('conta-nome').value.trim();
    const saldo = parseFloat(document.getElementById('conta-saldo').value) || 0;
    if (!nome) return alert("Digite o nome da conta");
    tempContas.push({nome, saldoInicial: saldo});
    document.getElementById('conta-nome').value = '';
    document.getElementById('conta-saldo').value = '';
    renderizarListaTemp();
}

function addTempCartao() {
    const nome = document.getElementById('cartao-nome').value.trim();
    const diaFech = parseInt(document.getElementById('cartao-fechamento').value) || 2;
    const diaVenc = parseInt(document.getElementById('cartao-vencimento').value) || 7;
    if (!nome) return alert("Digite o nome do cartão");
    tempCartoes.push({nome, diaFechamento: diaFech, diaVencimento: diaVenc});
    document.getElementById('cartao-nome').value = '';
    document.getElementById('cartao-fechamento').value = '';
    document.getElementById('cartao-vencimento').value = '';
    renderizarListaTemp();
}

function removerTempConta(i) { tempContas.splice(i, 1); renderizarListaTemp(); }
function removerTempCartao(i) { tempCartoes.splice(i, 1); renderizarListaTemp(); }

function finalizarCadastro() {
    if (!tempContas.length) return alert("Cadastre pelo menos 1 conta");
    contas = [...tempContas];
    cartoes = [...tempCartoes];
    contas.forEach(c => {
        if (c.saldoInicial &&!dados.some(d => d.isSaldoInicial && d.banco === c.nome)) {
            dados.push({
                id: Date.now() + Math.random(),
                descricao: "Saldo inicial",
                valor: c.saldoInicial,
                tipo: "entrada",
                metodo: "conta",
                banco: c.nome,
                data: new Date().toISOString(),
                isSaldoInicial: true,
                categoria: 'Outras Receitas'
            });
        }
    });
    salvar();
    fecharModal('modal-contas');
    atualizar();
    addMensagem(`Configuração salva: ${contas.length} contas e ${cartoes.length} cartões`, 'system');
}

// EDITAR TRANSAÇÃO
function abrirModalEditar(id) {
    editandoId = id;
    const t = dados.find(d => d.id === id);
    if (!t) return;
    document.getElementById('edit-desc').value = t.descricao;
    document.getElementById('edit-valor').value = t.valor;
    document.getElementById('edit-tipo').value = t.tipo;
    document.getElementById('edit-metodo').value = t.metodo;
    document.getElementById('edit-data').value = new Date(t.data).toISOString().split('T')[0];

    atualizarContasModal();
    atualizarCategorias();

    document.getElementById('edit-banco').value = t.banco;
    document.getElementById('edit-categoria').value = t.categoria;
    abrirModal('modal-editar');
}

function atualizarContasModal() {
    const metodo = document.getElementById('edit-metodo').value;
    const selectBanco = document.getElementById('edit-banco');
    selectBanco.innerHTML = '';
    const lista = metodo === 'cartao'? cartoes : contas;
    lista.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.nome;
        opt.textContent = item.nome;
        selectBanco.appendChild(opt);
    });
}

function atualizarCategorias() {
    const tipo = document.getElementById('edit-tipo').value;
    const selectCat = document.getElementById('edit-categoria');
    selectCat.innerHTML = '';
    const catsDoTipo = CATEGORIAS || CATEGORIAS['saida'];
    Object.keys(catsDoTipo).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        selectCat.appendChild(opt);
    });
}

function salvarEdicao() {
    const t = dados.find(d => d.id === editandoId);
    if (!t) return;
    t.descricao = document.getElementById('edit-desc').value;
    t.valor = parseFloat(document.getElementById('edit-valor').value) || t.valor;
    t.tipo = document.getElementById('edit-tipo').value;
    t.metodo = document.getElementById('edit-metodo').value;
    t.banco = document.getElementById('edit-banco').value;
    t.categoria = document.getElementById('edit-categoria').value;
    t.data = new Date(document.getElementById('edit-data').value).toISOString();
    salvar();
    atualizar();
    fecharModal('modal-editar');
    addMensagem('Transação editada', 'system', `${t.descricao} - R$ ${t.valor.toFixed(2)}`);
}

function deletarTransacao() {
    dados = dados.filter(d => d.id!== editandoId);
    salvar();
    atualizar();
    fecharModal('modal-editar');
    addMensagem('Transação excluída', 'system');
}

// RESET
function resetarTransacoes() {
    if (!confirm('Apagar todas as transações? Contas e cartões serão mantidos.')) return;
    dados = [];
    salvar();
    atualizar();
    addMensagem('Transações limpas', 'system');
    toggleMenu();
}

function resetarApp() {
    if (!confirm('Apagar TUDO? Não tem volta.')) return;
    localStorage.clear();
    location.reload();
}

// OUTROS
function toggleProjetado() {
    config.projetarSaldo =!config.projetarSaldo;
    salvar();
    aplicarVisualSaldoProjetado();
    atualizar();
    toggleMenu();
    addMensagem(`Projeção ${config.projetarSaldo? 'ativada' : 'desativada'}`, 'system');
}

function aplicarVisualSaldoProjetado() {
    const btn = document.getElementById('btnProjetado');
    if (!btn) return;
    if (config.projetarSaldo) {
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-blue-500');
    } else {
        btn.classList.add('text-slate-400');
        btn.classList.remove('text-blue-500');
    }
}

// INIT
window.onload = () => {
    iniciarApp();
};
