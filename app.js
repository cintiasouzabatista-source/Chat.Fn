if ('serviceWorker' in navigator) {
    navigator.serviceWorker
    .register('./sw.js')
    .catch(err => console.error('SW erro:', err));
}

let dados = JSON.parse(localStorage.getItem('bankday') || '[]');
let contas = JSON.parse(localStorage.getItem('bankday_contas') || '[]');
let cartoes = JSON.parse(localStorage.getItem('bankday_cartoes') || '[]');
let config = JSON.parse(localStorage.getItem('bankday_config') || '{"projetarSaldo":false}');

function salvar() {
    localStorage.setItem('bankday', JSON.stringify(dados));
    localStorage.setItem('bankday_contas', JSON.stringify(contas));
    localStorage.setItem('bankday_cartoes', JSON.stringify(cartoes));
    localStorage.setItem('bankday_config', JSON.stringify(config));
}

let mesAtual = new Date();
let valoresOcultos = false;
let editandoId = null;
let tempContas = [];
let tempCartoes = [];
let editandoContaCartao = {tipo: null, index: -1};
let chartInstance = null;

const formatar = v => {
 v = Number(v) || 0;
 return valoresOcultos
  ? 'R$ ••••'
   : `R$ ${v.toFixed(2).replace('.',',')}`;
};
const cap = s => s? s.charAt(0).toUpperCase() + s.slice(1) : '';

const CATEGORIAS = {
    entrada: {
        'Salário': ['salario', 'pagamento', 'pensao', 'freela', 'bonus', '13', 'ferias', 'comissao'],
        'Vendas': ['venda', 'vendi', 'mercado livre', 'olx', 'shopee', 'pix recebido'],
        'Presente': ['presente', 'doacao', 'deu'],
        'Investimento': ['rendimento', 'dividendo', 'juros', 'cdb', 'tesouro', 'acao'],
        'Reembolso': ['reembolso', 'estorno', 'voltou'],
        'Outras Receitas': []
    },
    saida: {
        'Alimentação': ['ifood', 'rappi', 'uber eats', 'restaurante', 'padaria', 'mercado', 'acougue', 'feira', 'lanche', 'pizza'],
        'Transporte': ['uber', '99', 'posto', 'gasolina', 'estacionamento', 'metro', 'onibus', 'pedagio', 'mecanico'],
        'Moradia': ['aluguel', 'condominio', 'luz', 'agua', 'internet', 'enel', 'sabesp', 'iptu', 'gas'],
        'Lazer': ['cinema', 'netflix', 'spotify', 'jogo', 'bar', 'show', 'viagem', 'praia', 'clube'],
        'Saúde': ['farmacia', 'drogaria', 'medico', 'dentista', 'hospital', 'unimed', 'academia', 'terapia'],
        'Compras': ['shopee', 'mercado livre', 'amazon', 'sapatos', 'americanas', 'shopping', 'roupa', 'calcado', 'tenis'],
        'Educação': ['faculdade', 'curso', 'livro', 'udemy', 'alura', 'material'],
        'Assinaturas': ['netflix', 'spotify', 'youtube', 'globoplay', 'prime', 'disney'],
        'Pets': ['petshop', 'racao', 'veterinario', 'banho', 'tosa'],
        'Outras Despesas': []
    }
};

function identificarCategoria(descricao, tipo = 'saida') {
    if (!descricao) return tipo === 'entrada'? 'Outras Receitas' : 'Outras Despesas';
    const desc = descricao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cats = CATEGORIAS[tipo] || CATEGORIAS['saida'];
    for (const [categoria, palavras] of Object.entries(cats)) {
        if (palavras.some(p => desc.includes(p))) return categoria;
    }
    return tipo === 'entrada'? 'Outras Receitas' : 'Outras Despesas';
}

function addMensagem(texto, tipo = 'system', info = '', autoLimpar = true, id = null) {
    const chat = document.getElementById("chat-mensagens");
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement("div");
    div.className = `msg ${tipo}`;
    if (id) div.onclick = () => abrirModalEditar(id);
    div.innerHTML = `<div class="msg-bubble">${texto}${info? `<div class="msg-info">${info}</div>` : ''}<div class="msg-time">${hora}</div></div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  if (autoLimpar) { // remove o '&& tipo === 'system''
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 8000);
}
}

function toggleMenu() {
    let m = document.getElementById('menuDropdown');
    if (!m) {
        m = document.createElement('div');
        m.id = 'menuDropdown';
        m.className = 'menu-dropdown';
        document.body.appendChild(m);
    }
    m.innerHTML = `
        <button onclick="abrirCadastroInicial()">Gerenciar Contas/Cartões</button>
        <button onclick="toggleProjetarSaldo()">${config.projetarSaldo? '✓' : ''} Projetar Saldo Próximo Mês</button>
        <button onclick="resetarTransacoes()">Resetar Transações</button>
        <button onclick="resetarTudo()">Resetar Tudo</button>
    `;
    m.style.display = m.style.display === 'flex'? 'none' : 'flex';
}

function toggleProjetarSaldo() {
    config.projetarSaldo =!config.projetarSaldo;
    salvar();
    toggleMenu();
    atualizar();
    addMensagem(`Projeção ${config.projetarSaldo? 'ativada' : 'desativada'}`, 'system');
}

function toggleMenuMais() {
    let m = document.getElementById('menuDropdown');
    if (!m) {
        m = document.createElement('div');
        m.id = 'menuDropdown';
        m.className = 'menu-dropdown';
        document.body.appendChild(m);
    }
    m.innerHTML = `
        <button onclick="abrirCadastroInicial()">Gerenciar Contas/Cartões</button>
        <button onclick="toggleProjetarSaldo()">${config.projetarSaldo? '✓ ' : ''}Projetar Saldo Próximo Mês</button>
        <button onclick="resetarTransacoes()">Resetar Transações</button>
        <button onclick="resetarTudo()">Resetar Tudo</button>
    `;
    m.style.display = m.style.display === 'flex'? 'none' : 'flex';
    m.style.bottom = 'calc(56px + env(safe-area-inset-bottom))';
    m.style.right = '8px';
    m.style.top = 'auto';
}

function abrirCadastroInicial() {
    tempContas = [...contas];
    tempCartoes = [...cartoes];
    renderizarListaTemp();
    abrirModal('modal-conta');
    const m = document.getElementById('menuDropdown');
    if (m) m.style.display = 'none';
}

function renderizarListaTemp() {
    const listaContas = document.getElementById('lista-contas-temp');
    const listaCartoes = document.getElementById('lista-cartoes-temp');
    if (!listaContas ||!listaCartoes) return;
    listaContas.innerHTML = tempContas.map((c, i) => `
        <div class="item-temp">
            <span onclick="editarContaCartao('conta', ${i})">${c.nome} - ${formatar(c.saldoInicial || 0)}</span>
            <button onclick="removerTempConta(${i})">✕</button>
        </div>
    `).join('');
    listaCartoes.innerHTML = tempCartoes.map((c, i) => `
        <div class="item-temp">
            <span onclick="editarContaCartao('cartao', ${i})">${c.nome} - Fecha ${c.diaFechamento} | Vence ${c.diaVencimento}</span>
            <button onclick="removerTempCartao(${i})">✕</button>
        </div>
    `).join('');
}

function addTempConta() {
    const nome = document.getElementById('conta-nome').value.trim();
    const saldo = parseFloat(document.getElementById('conta-saldo').value) || 0;
    if (!nome) return alert("Digite o nome da conta");
    if (editandoContaCartao.tipo === 'conta' && editandoContaCartao.index >= 0) {
        tempContas[editandoContaCartao.index] = {nome, saldoInicial: saldo};
        editandoContaCartao = {tipo: null, index: -1};
    } else {
        tempContas.push({nome, saldoInicial: saldo});
    }
    document.getElementById('conta-nome').value = '';
    document.getElementById('conta-saldo').value = '';
    renderizarListaTemp();
}

function addTempCartao() {
    const nome = document.getElementById('cartao-nome').value.trim();
    const diaFech = parseInt(document.getElementById('cartao-fechamento').value) || 2;
    const diaVenc = parseInt(document.getElementById('cartao-vencimento').value) || 7;
    if (!nome) return alert("Digite o nome do cartão");
    if (editandoContaCartao.tipo === 'cartao' && editandoContaCartao.index >= 0) {
        tempCartoes[editandoContaCartao.index] = {nome, diaFechamento: diaFech, diaVencimento: diaVenc};
        editandoContaCartao = {tipo: null, index: -1};
    } else {
        tempCartoes.push({nome, diaFechamento: diaFech, diaVencimento: diaVenc});
    }
    document.getElementById('cartao-nome').value = '';
    document.getElementById('cartao-fechamento').value = '';
    document.getElementById('cartao-vencimento').value = '';
    renderizarListaTemp();
}

function editarContaCartao(tipo, index) {
    editandoContaCartao = {tipo, index};
    if (tipo === 'conta') {
        const c = tempContas[index];
        document.getElementById('conta-nome').value = c.nome;
        document.getElementById('conta-saldo').value = c.saldoInicial || 0;
        document.getElementById('conta-nome').focus();
    } else {
        const c = tempCartoes[index];
        document.getElementById('cartao-nome').value = c.nome;
        document.getElementById('cartao-fechamento').value = c.diaFechamento;
        document.getElementById('cartao-vencimento').value = c.diaVencimento;
        document.getElementById('cartao-nome').focus();
    }
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
    fecharModal('modal-conta');
    atualizar();
    popularFiltros();
    addMensagem(`Configuração salva: ${contas.length} contas e ${cartoes.length} cartões`, 'system');
}

function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }

function alternarTema() {
    document.body.classList.toggle('dark');
    document.getElementById('btnTema').textContent = document.body.classList.contains('dark')? '☀️' : '🌙';
    localStorage.setItem('bankday_tema', document.body.classList.contains('dark')? 'dark' : 'light');
}

function alternarValores() {
    valoresOcultos =!valoresOcultos;
    document.getElementById('olho').textContent = valoresOcultos? '🙈' : '👁️';
    atualizar();
}

function trocarAba(aba) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');

    document.getElementById('chat-area').style.display='none';
    document.getElementById('input-area').style.display='none';
    document.getElementById('extrato-area').style.display='none';
    document.getElementById('graficos-area').style.display='none';

    if (aba === 'chat') {
        document.getElementById('chat-area').style.display='flex';
        document.getElementById('input-area').style.display='flex';
    }

    if (aba === 'extrato') {
        document.getElementById('extrato-area').style.display='flex';
        popularFiltros();
        aplicarFiltros();
    }

    if (aba === 'graficos') {
        document.getElementById('graficos-area').style.display='flex';
        mostrarGrafico('despesas');
    }
}

function popularFiltros() {
    const catSelect = document.getElementById('filtro-categoria');
    const bancoSelect = document.getElementById('filtro-banco');
    if (!catSelect ||!bancoSelect) return;

    const cats = new Set();
    dados.forEach(d => cats.add(d.categoria));
    catSelect.innerHTML = '<option value="">Todas Categorias</option>' + Array.from(cats).sort().map(c => `<option value="${c}">${c}</option>`).join('');

    const bancos = new Set([...contas.map(c=>c.nome),...cartoes.map(c=>c.nome)]);
    bancoSelect.innerHTML = '<option value="">Todas Contas/Cartões</option>' + Array.from(bancos).sort().map(b => `<option value="${b}">${b}</option>`).join('');
}

function aplicarFiltros() {
    const inicio = document.getElementById('filtro-inicio').value;
    const fim = document.getElementById('filtro-fim').value;
    const cat = document.getElementById('filtro-categoria').value;
    const banco = document.getElementById('filtro-banco').value;

    let filtrados = [...dados];
    if (inicio) filtrados = filtrados.filter(d => new Date(d.data) >= new Date(inicio));
    if (fim) filtrados = filtrados.filter(d => new Date(d.data) <= new Date(fim + 'T23:59:59'));
    if (cat) filtrados = filtrados.filter(d => d.categoria === cat);
    if (banco) filtrados = filtrados.filter(d => d.banco === banco);

    const ent = filtrados.filter(d => d.tipo === 'entrada').reduce((s,d) => s+d.valor, 0);
    const sai = filtrados.filter(d => d.tipo === 'saida').reduce((s,d) => s+d.valor, 0);
    document.getElementById('resumoEntradas').textContent = formatar(ent);
    document.getElementById('resumoSaidas').textContent = formatar(sai);
    document.getElementById('resumoSaldo').textContent = formatar(ent - sai);
    document.getElementById('resumoFiltro').style.display = filtrados.length? 'flex' : 'none';

    const lista = document.getElementById('lista-transacoes');
    lista.innerHTML = filtrados.sort((a,b) => new Date(b.data) - new Date(a.data)).map(t => `
        <div class="transacao-item" onclick="abrirModalEditar(${t.id})">
            <div class="transacao-info">
                <div class="transacao-desc">${t.descricao}</div>
                <div class="transacao-cat">${t.categoria} • ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.banco}</div>
            </div>
            <div class="transacao-valor ${t.tipo === 'entrada'? 'positivo' : 'negativo'}">
                ${t.tipo === 'entrada'? '+' : '-'} ${formatar(t.valor)}
            </div>
        </div>
    `).join('') || '<p style="text-align:center;opacity:0.6;color:var(--text)">Nenhuma transação encontrada</p>';
}

function mostrarGrafico(tipo){
   document.querySelectorAll('.tab-grafico').forEach(b=>b.classList.remove('active'));
   event?.currentTarget.classList.add('active');

    const mes = mesAtual.getMonth(), ano = mesAtual.getFullYear();
    const dadosMes = dados.filter(d => { const dt = new Date(d.data); return dt.getMonth() === mes && dt.getFullYear() === ano; });

    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('chartCanvas').getContext('2d');

    if (tipo === 'despesas') {
        const cats = {};
        dadosMes.filter(d => d.tipo === 'saida').forEach(d => {
            cats[d.categoria] = (cats[d.categoria] || 0) + d.valor;
        });
        const sorted = Object.entries(cats).sort((a,b) => b[1] - a[1]);
        const total = sorted.reduce((s, [,v]) => s + v, 0);
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([c]) => c),
                datasets: [{
                    label: 'Despesas',
                    data: sorted.map(([,v]) => v),
                    backgroundColor: '#ef4444'
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${formatar(ctx.raw)} (${(ctx.raw/total*100).toFixed(1)}%)`
                        }
                    }
                }
            }
        });
    } else if (tipo === 'receitas') {
        const ent = dadosMes.filter(d => d.tipo === 'entrada').reduce((s,d) => s+d.valor, 0);
        const sai = dadosMes.filter(d => d.tipo === 'saida').reduce((s,d) => s+d.valor, 0);
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Receitas', 'Despesas'],
                datasets: [{
                    label: 'Valores',
                    data: [ent, sai],
                    backgroundColor: ['#4ade80', '#ef4444']
                }]
            },
            options: { indexAxis: 'x' }
        });
  } else if (tipo === 'bancos') {
    const bancos = {};

    dadosMes.forEach(d => {
        bancos[d.banco] =
            (bancos[d.banco] || 0) + d.valor;
    });

    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(bancos),
            datasets: [{
                data: Object.values(bancos),
                backgroundColor: [
                    '#25d366',
                    '#00a884',
                    '#075e54',
                    '#4ade80',
                    '#ef4444',
                    '#f87171',
                    '#fbbf24',
                    '#a78bfa'
                ]
            }]
        }
    });
  }
}

function abrirModalEditar(id) {
    editandoId = id;
    const t = dados.find(d => d.id === id);
    if (!t) return;
    document.getElementById('edit-desc').value = t.descricao;
    document.getElementById('edit-valor').value = t.valor;
    document.getElementById('edit-tipo').value = t.tipo;
    document.getElementById('edit-metodo').value = t.metodo;
    document.getElementById('edit-data').value = new Date(t.data).toISOString().split('T')[0];
    const selectBanco = document.getElementById('edit-banco');
    selectBanco.innerHTML = '';
    const lista = t.metodo === 'cartao'? cartoes : contas;
    lista.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.nome;
        opt.textContent = item.nome;
        if (item.nome === t.banco) opt.selected = true;
        selectBanco.appendChild(opt);
    });
    const selectCat = document.getElementById('edit-categoria');
    selectCat.innerHTML = '';
    const catsDoTipo = CATEGORIAS[t.tipo] || CATEGORIAS['saida'];
    Object.keys(catsDoTipo).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === t.categoria) opt.selected = true;
        selectCat.appendChild(opt);
    });
    abrirModal('modal-editar');
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

function resetarTudo() {
    if (!confirm('Apagar TUDO? Não tem volta.')) return;
    dados = []; contas = []; cartoes = [];
    salvar();
    location.reload();
}

function resetarTransacoes() {
    if (!confirm('Apagar todas as transações? Contas e cartões serão mantidos.')) return;
    dados = [];
    salvar();
    atualizar();
    addMensagem('Transações limpas', 'system');
}

function parceleiNoCartao(descricao, valorTotal, parcelas, cartaoNome) {
    let cartao = cartoes.find(c => c.nome.toLowerCase() === cartaoNome.toLowerCase());
    if (!cartao && cartoes.length > 0) cartao = cartoes[0];
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

function enviar() {
    const input = document.getElementById("inputMsg");
    let textoOriginal = input.value.trim();
    if (!textoOriginal) return;
    input.value = "";

    let texto = textoOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const extensoNum = {'uma':1,'duas':2,'tres':3,'quatro':4,'cinco':5,'seis':6,'sete':7,'oito':8,'nove':9,'dez':10,'onze':11,'doze':12};
    for (const [ext, num] of Object.entries(extensoNum)) {
        texto = texto.replace(new RegExp(`\\b${ext}\\s+vezes\\b`, 'g'), `${num}x`);
    }

    const tipo = texto.includes('recebi') || texto.includes('vendi') || texto.includes('ganhei')? 'entrada' : 'saida';

    let banco = contas[0]?.nome || 'Principal';
    let metodo = "conta";
    for (const conta of contas) {
        const nomeConta = conta.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const regex = new RegExp(`(?:no|na|em)\\s+(?:conta\\s+)?${nomeConta}\\b`);
        if (regex.test(texto)) {
            banco = conta.nome;
            metodo = conta.nome.toLowerCase().includes('dinheiro') || conta.nome.toLowerCase().includes('carteira')? "dinheiro" : "conta";
            break;
        }
    }

    const regexParcelado = /(?:comprei\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:reais?)?\s*(?:em\s+)?(\d{1,2})x?(?:\s+vezes)?(?:\s+(?:no\s+)?(.+))?/;
    const matchParc = texto.match(regexParcelado);

    if (matchParc && (texto.includes('x') || texto.includes('vezes'))) {
        const [, desc, valorStr, parcelasStr, cartaoNome] = matchParc;
        const valor = parseFloat(valorStr.replace(',', '.'));
        const parcelas = parseInt(parcelasStr);
        if (parcelas > 1 && valor) {
            const nomeCartao = cartaoNome? cap(cartaoNome) : (cartoes[0]?.nome || 'Cartão');
            if (!cartoes.length) {
                addMensagem("Cadastre um cartão primeiro", 'system');
                return;
            }
            parceleiNoCartao(cap(desc.trim()), valor, parcelas, nomeCartao);
            return;
        }
    }

    const valorNum = parseFloat(texto.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
    if (isNaN(valorNum)) {
        addMensagem("Ex: 'cafe 15' ou 'recebi 500 salario'", 'system');
        return;
    }

    const desc = texto.replace(/recebi|gastei|comprei|paguei|vendi|ganhei|no|na|em|conta|\d+(?:[.,]\d+)?|reais?|credito|x|vezes|a\s*vista|avista/gi, '').trim() || 'Lançamento';
    const id = Date.now();

    dados.push({
        id: id,
        descricao: cap(desc),
        valor: valorNum,
        tipo: tipo,
        metodo: metodo,
        banco: banco,
        data: new Date().toISOString(),
        texto: textoOriginal,
        categoria: identificarCategoria(desc, tipo)
    });
    addMensagem(textoOriginal, 'user', `Categoria: ${identificarCategoria(desc, tipo)}`, false, id);
    salvar();
    atualizar();
}

function atualizar() {
    const mes = mesAtual.getMonth(), ano = mesAtual.getFullYear();
    const dadosMes = dados.filter(d => { 
        const dt = new Date(d.data); 
        return dt.getMonth() === mes && dt.getFullYear() === ano; 
    });
    
    const ent = dadosMes.filter(d => d.tipo === 'entrada').reduce((s,d) => s + d.valor, 0);
    const sai = dadosMes.filter(d => d.tipo === 'saida' && d.metodo !== 'cartao').reduce((s,d) => s + d.valor, 0);
    const fat = dadosMes.filter(d => d.tipo === 'saida' && d.metodo === 'cartao').reduce((s,d) => s + d.valor, 0);
    const saldo = ent - sai;
    const saldoFinal = saldo - fat;
    
    document.getElementById('totalEntradas').textContent = formatar(ent);
    document.getElementById('totalSaidas').textContent = formatar(sai);
    document.getElementById('saldoMes').textContent = formatar(saldo);
    document.getElementById('totalFatura').textContent = formatar(fat);
    document.getElementById('saldoFinal').textContent = formatar(saldoFinal);
    
    const saldoMesEl = document.getElementById('saldoMes');
    const saldoFinalEl = document.getElementById('saldoFinal');
    saldoMesEl.className = saldo >= 0 ? 'positivo' : 'negativo';
    saldoFinalEl.className = saldoFinal >= 0 ? 'positivo' : 'negativo';
    
    document.getElementById('mesAtual').textContent = cap(mesAtual.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(' de ',' '));

    // Se projetar saldo tá ativo, leva o saldo atual pro próximo mês
    if (config.projetarSaldo) {
        const projMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1);
        const dadosProj = dados.filter(d => { 
            const dt = new Date(d.data); 
            return dt.getMonth() === projMes.getMonth() && dt.getFullYear() === projMes.getFullYear(); 
        });
        
        const entProj = dadosProj.filter(d => d.tipo === 'entrada').reduce((s,d) => s + d.valor, 0);
        const saiProj = dadosProj.filter(d => d.tipo === 'saida' && d.metodo !== 'cartao').reduce((s,d) => s + d.valor, 0);
        const fatProj = dadosProj.filter(d => d.tipo === 'saida' && d.metodo === 'cartao').reduce((s,d) => s + d.valor, 0);
        
        // Soma o saldo do mês atual com as entradas do próximo mês
        const saldoProjetado = saldo + entProj - saiProj - fatProj;
        document.getElementById('saldoProjValor').textContent = formatar(saldoProjetado);
       function mudarMes(d) { mesAtual.setMonth(mesAtual.getMonth() + d); atualizar(); }

document.addEventListener('click', (e) => {
    const m = document.getElementById('menuDropdown');
    if (m &&!e.target.closest('.menu-dropdown') &&!e.target.closest('.icon-btn')) {
        m.style.display = "none";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const metodoSelect = document.getElementById('edit-metodo');
    if (metodoSelect) {
        metodoSelect.addEventListener('change', () => {
            const selectBanco = document.getElementById('edit-banco');
            selectBanco.innerHTML = '';
            const lista = metodoSelect.value === 'cartao'? cartoes : contas;
            lista.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.nome;
                opt.textContent = item.nome;
                selectBanco.appendChild(opt);
            });
        });
    }
    const temaSalvo = localStorage.getItem('bankday_tema');
    if (temaSalvo === 'dark') {
        document.body.classList.add('dark');
        document.getElementById('btnTema').textContent = '☀️';
    }
});

window.onload = () => {
    atualizar();
    if (!contas.length) abrirCadastroInicial();
   
};
