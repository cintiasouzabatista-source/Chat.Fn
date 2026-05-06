if ('serviceWorker' in navigator) {
    navigator.serviceWorker
   .register('./sw.js')
   .catch(err => console.error('SW erro:', err));
}

// VARIÁVEIS GLOBAIS
let tentativasPin = 0;
let pinBloqueadoAte = 0;
let modoTeste = localStorage.getItem('bankday_modo') === 'teste';
let modoProducao = localStorage.getItem('bankday_modo') === 'producao';

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
let tutorialStep = 1;
const TOTAL_STEPS = 4;

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

// FUNÇÕES TESTE OU PRODUÇÃO
function verificarTesteExpirado() {
    if (!modoTeste) return false;
    const expira = parseInt(localStorage.getItem('bankday_teste_expira') || '0');
    const agora = Date.now();
    if (agora > expira && expira > 0) {
        bloquearTesteExpirado();
        return true;
    }
    return false;
}

function bloquearTesteExpirado() {
    document.getElementById('app-content').innerHTML = `
        <div class="flex items-center justify-center min-h-screen p-6">
            <div class="max-w-sm w-full text-center">
                <div class="bg-amber-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-clock text-white text-2xl"></i>
                </div>
                <h2 class="text-2xl font-black mb-2">Teste Expirado</h2>
                <p class="text-slate-400 mb-6">Seu período de teste de 48h acabou. Para continuar usando o BankDay, migre para Produção.</p>
                <button onclick="converterParaProducao()" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mb-3">
                    Migrar para Produção
                </button>
                <button onclick="resetarApp()" class="w-full bg-slate-700 text-slate-300 py-3 rounded-lg font-bold">
                    Apagar tudo e recomeçar
                </button>
            </div>
        </div>
    `;
}

function converterParaProducao() {
    if (confirm('Migrar para Produção?\n\nOs dados de teste serão apagados.')) {
        localStorage.setItem('bankday_modo', 'producao');
        localStorage.removeItem('bankday');
        localStorage.removeItem('bankday_teste_expira');
        location.reload();
    }
}

function resetarApp() {
    if (confirm('Isso vai apagar TODOS os dados e voltar pro início. Confirma?')) {
        localStorage.clear();
        location.reload();
    }
}

function mostrarBannerTeste() {
    if (!modoTeste) return;
    const appContent = document.getElementById('app-content');
    const bannerExiste = document.getElementById('banner-teste');
    if (bannerExiste) return;
    const banner = document.createElement('div');
    banner.id = 'banner-teste';
    banner.className = 'bg-amber-600/20 border-b border-amber-600 text-amber-500 text-center py-2 px-4 text-xs font-bold';
    banner.innerHTML = `
        <div class="flex items-center justify-between max-w-4xl mx-auto">
            <span><i class="fas fa-flask mr-2"></i>Modo Teste Ativo</span>
            <button onclick="converterParaProducao()" class="bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold">
                Migrar para Produção
            </button>
        </div>
    `;
    appContent.insertBefore(banner, appContent.firstChild);
}

function mostrarToastExpiracao() {
    const expira = parseInt(localStorage.getItem('bankday_teste_expira') || '0');
    const agora = Date.now();
    const msRestantes = expira - agora;
    if (msRestantes <= 0) return;
    const horasRestantes = Math.floor(msRestantes / (1000 * 60 * 60));
    const minutosRestantes = Math.floor((msRestantes % (1000 * 60 * 60)) / (1000 * 60));
    const toast = document.getElementById('toast-expiracao');
    if (!toast) return;
    const titulo = document.getElementById('toast-titulo');
    const tempo = document.getElementById('toast-tempo');
    if (horasRestantes <= 1) {
        toast.querySelector('div').className = 'bg-rose-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[280px] animate-pulse';
        titulo.textContent = 'Teste acabando!';
        tempo.textContent = minutosRestantes > 0? `Faltam ${minutosRestantes}min` : 'Menos de 1min';
    } else if (horasRestantes <= 6) {
        toast.querySelector('div').className = 'bg-orange-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[280px]';
        titulo.textContent = 'Teste expirando';
        tempo.textContent = `Faltam ${horasRestantes}h`;
    } else {
        toast.querySelector('div').className = 'bg-amber-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[280px]';
        titulo.textContent = 'Modo Teste';
        tempo.textContent = `Faltam ${horasRestantes}h`;
    }
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 5000);
}

function fecharToastExpiracao() {
    const toast = document.getElementById('toast-expiracao');
    if (toast) toast.classList.add('hidden');
}

function selecionarModo(tipo) {
    const agora = Date.now();
    localStorage.setItem('bankday_modo', tipo);
    localStorage.setItem('bankday_modo_inicio', agora);
    document.getElementById('modal-onboarding').style.display = 'none';
    if (tipo === 'producao') {
        modoProducao = true;
        modoTeste = false;
        setTimeout(() => {
            document.getElementById('modal-cadastro-conta').style.display = 'flex';
        }, 300);
    } else {
        modoTeste = true;
        modoProducao = false;
        localStorage.setItem('bankday_teste_expira', agora + (48 * 60 * 60 * 1000));
        if (!contas.length || contas[0].nome!== 'Conta Teste') {
            contas = [{nome: 'Conta Teste', saldoInicial: 0}];
            localStorage.setItem('bankday_contas', JSON.stringify(contas));
        }
        document.getElementById('app-content').style.display = 'flex';
        mostrarBannerTeste();
        mostrarToastExpiracao();
        setTimeout(() => {
            document.getElementById('tutorial').style.display = 'flex';
        }, 300);
    }
}

function salvarContaProducao() {
    const nome = document.getElementById('cadastro-conta-nome').value.trim();
    const saldo = parseFloat(document.getElementById('cadastro-conta-saldo').value) || 0;
    if (!nome) {
        alert('Digite o nome da conta');
        return;
    }
    contas = [{nome, saldoInicial: saldo}];
    localStorage.setItem('bankday_contas', JSON.stringify(contas));
    if (saldo > 0) {
        dados.push({
            id: Date.now(),
            descricao: 'Saldo inicial',
            valor: saldo,
            tipo: 'entrada',
            metodo: 'conta',
            banco: nome,
            data: new Date().toISOString(),
            categoria: 'Outras Receitas',
            isSaldoInicial: true
        });
        salvar();
    }
    document.getElementById('modal-cadastro-conta').style.display = 'none';
    initPin();
}

// INIT PRINCIPAL
function iniciarApp() {
    console.log('Iniciando BankDay...');

    const modo = localStorage.getItem('bankday_modo');

    if (!modo) {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('tela-pin').style.display = 'none';
        setTimeout(() => {
            document.getElementById('modal-onboarding').style.display = 'flex';
        }, 300);
        atualizarMes();
        aplicarVisualSaldoProjetado();
        atualizar();
        return;
    }

    if (modo === 'teste') {
        if (verificarTesteExpirado()) return;
        document.getElementById('tela-pin').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        mostrarBannerTeste();
        mostrarToastExpiracao();
        verificarTutorial();
    }
    else if (modo === 'producao') {
        initPin();
    }

    atualizarMes();
    aplicarVisualSaldoProjetado();
    atualizar();
}

function initPin() {
    const telaPin = document.getElementById('tela-pin');
    const appContent = document.getElementById('app-content');
    const titulo = document.getElementById('pin-titulo');
    const subtitulo = document.getElementById('pin-subtitulo');
    const btnEsqueci = document.getElementById('btn-esqueci');

    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;

    if (EH_PRIMEIRO) {
        titulo.textContent = 'Crie seu PIN';
        subtitulo.textContent = '4 dígitos para proteger o app';
        btnEsqueci.classList.add('hidden');
    } else {
        titulo.textContent = 'Digite seu PIN';
        subtitulo.textContent = 'Para acessar o app';
        btnEsqueci.classList.remove('hidden');
        const agora = Date.now();
        if (pinBloqueadoAte > agora) {
            const segundos = Math.ceil((pinBloqueadoAte - agora) / 1000);
            bloquearPin(segundos);
        }
    }

    const inputs = document.querySelectorAll('.pin-input');
    inputs.forEach(i => {
        i.value = '';
        i.disabled = false;
        i.classList.remove('border-rose-500');
    });
    inputs[0].focus();

    inputs.forEach((input, idx) => {
        input.oninput = (e) => {
            if (e.target.value.length === 1 && idx < 3) {
                inputs[idx + 1].focus();
            }
            if (idx === 3 && e.target.value.length === 1) {
                setTimeout(validarPin, 100);
            }
        };
        input.onkeydown = (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && idx > 0) {
                inputs[idx - 1].focus();
            }
        };
    });

    telaPin.style.display = 'flex';
    appContent.style.display = 'none';
}

function validarPin() {
    const inputs = document.querySelectorAll('.pin-input');
    const pinDigitado = Array.from(inputs).map(i => i.value).join('');
    if (pinDigitado.length!== 4) return;

    const erro = document.getElementById('pin-erro');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;

    if (EH_PRIMEIRO) {
        localStorage.setItem('bankday_pin', btoa(pinDigitado));
        liberarApp();
    } else {
        if (btoa(pinDigitado) === PIN_SALVO) {
            tentativasPin = 0;
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
            setTimeout(() => {
                inputs.forEach(i => i.classList.remove('border-rose-500'));
            }, 1000);
            if (tentativasPin >= 3) {
                pinBloqueadoAte = Date.now() + 30000;
                bloquearPin(30);
            }
        }
    }
}

function bloquearPin(segundos) {
    const inputs = document.querySelectorAll('.pin-input');
    const erro = document.getElementById('pin-erro');
    inputs.forEach(i => {
        i.disabled = true;
        i.value = '';
    });
    let contador = segundos;
    erro.classList.remove('hidden');
    const interval = setInterval(() => {
        erro.textContent = `Muitas tentativas. Tente em ${contador}s`;
        contador--;
        if (contador < 0) {
            clearInterval(interval);
            inputs.forEach(i => i.disabled = false);
            erro.classList.add('hidden');
            inputs[0].focus();
            tentativasPin = 0;
        }
    }, 1000);
}

function liberarApp() {
    document.getElementById('tela-pin').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    verificarTutorial();
}

function esqueciPin() {
    if (confirm('Esqueceu o PIN?\n\nIsso vai apagar TODOS os dados do app:\n- Transações\n- Contas\n- Cartões\n\nNão tem volta!')) {
        localStorage.clear();
        location.reload();
    }
}

// MENU
function toggleMenu() {
    const menu = document.getElementById('menuDropdown');
    if (!menu) return;

    const isHidden = menu.classList.contains('hidden');

    if (menuTimeout) clearTimeout(menuTimeout);

    if (isHidden) {
        menu.classList.remove('hidden');
        menuTimeout = setTimeout(() => {
            menu.classList.add('hidden');
        }, 10000);
    } else {
        menu.classList.add('hidden');
    }
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('menuDropdown');
    const btn = document.getElementById('btnMenu');
    if (!menu || menu.classList.contains('hidden')) return;
    if (!menu.contains(e.target) &&!btn.contains(e.target)) {
        menu.classList.add('hidden');
        if (menuTimeout) clearTimeout(menuTimeout);
    }
});

// TUTORIAL
function verificarTutorial() {
    const viuTutorial = localStorage.getItem('bankday_tutorial');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;

    if (!viuTutorial && modoProducao) {
        setTimeout(() => {
            document.getElementById('tutorial').style.display = 'flex';
        }, 500);
    }
}

function proximoTutorial() {
    document.getElementById(`tutorial-step-${tutorialStep}`).classList.add('hidden');
    document.querySelectorAll('.tutorial-dot')[tutorialStep - 1].classList.replace('bg-blue-600', 'bg-slate-600');
    tutorialStep++;
    if (tutorialStep > TOTAL_STEPS) {
        finalizarTutorial();
        return;
    }
    document.getElementById(`tutorial-step-${tutorialStep}`).classList.remove('hidden');
    document.querySelectorAll('.tutorial-dot')[tutorialStep - 1].classList.replace('bg-slate-600', 'bg-blue-600');
    if (tutorialStep === TOTAL_STEPS) {
        document.getElementById('btn-tutorial-prox').textContent = 'Começar';
    }
}

function pularTutorial() {
    if (confirm('Pular tutorial? Você pode ver depois em Mais > Ajuda')) {
        finalizarTutorial();
    }
}

function finalizarTutorial() {
    localStorage.setItem('bankday_tutorial', 'true');
    document.getElementById('tutorial').style.display = 'none';
    document.getElementById('user-input').focus();
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
    if (autoLimpar) {
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 8000);
    }
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
        <button onclick="abrirCadastroInicial()">
            <span>💳</span> Gerenciar Contas/Cartões
        </button>
        <button onclick="toggleProjetarSaldo()">
            <span>${config.projetarSaldo? '✓' : ''}</span> Projetar Saldo Próximo Mês
        </button>
        <button onclick="resetarTransacoes()">
            <span>🗑️</span> Resetar Transações
        </button>
        <button onclick="resetarTudo()">
            <span>⚠️</span> Resetar Tudo
        </button>
    `;
    m.style.display = m.style.display === 'flex'? 'none' : 'flex';
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
            bancos[d.banco] = (bancos[d.banco] || 0) + d.valor;
        });
        chartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(bancos),
                datasets: [{
                    data: Object.values(bancos),
                    backgroundColor: ['#25d366', '#00a884', '#075e54', '#4ade80', '#ef4444', '#f87171', '#fbbf24', '#a78bfa']
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
    const sai = dadosMes.filter(d => d.tipo === 'saida' && d.metodo!== 'cartao').reduce((s,d) => s + d.valor, 0);
    const fat = dadosMes.filter(d => d.tipo === 'saida' && d.metodo === 'cartao').reduce((s,d) => s + d.valor, 0);
    const saldo = ent - sai;
    const liquido = saldo - fat;

    // IDs CORRETOS DO TEU HTML
    const elEntradas = document.getElementById('card-entradas');
    const elSaidas = document.getElementById('card-saidas');
    const elSaldo = document.getElementById('card-saldo');
    const elCartoes = document.getElementById('card-cartoes');
    const elLiquido = document.getElementById('card-liquido');
    const elMes = document.getElementById('mesAtual');

    if (elEntradas) elEntradas.textContent = formatar(ent);
    if (elSaidas) elSaidas.textContent = formatar(sai);
    if (elSaldo) elSaldo.textContent = formatar(saldo);
    if (elCartoes) elCartoes.textContent = formatar(fat);
    if (elLiquido) elLiquido.textContent = formatar(liquido);
    if (elMes) elMes.textContent = cap(mesAtual.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(' de ',' '));

    // Cores
    if (elSaldo) elSaldo.className = `val-field text-lg font-black mt-1 ${saldo >= 0? 'text-blue-500' : 'text-rose-500'}`;
    if (elLiquido) elLiquido.className = `val-field text-xl font-black mt-1 ${liquido >= 0? 'text-emerald-500' : 'text-rose-500'}`;
}

function atualizarMes() {
    const el = document.getElementById('mesAtual');
    if (el) el.textContent = cap(mesAtual.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(' de ',' '));
}

function aplicarVisualSaldoProjetado() {
    const btn = document.getElementById('btnSaldoProjetado');
    if (!btn) return;
    if (config.projetarSaldo) {
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-blue-500');
    } else {
        btn.classList.add('text-slate-400');
        btn.classList.remove('text-blue-500');
    }
}
function mudarMes(d) {
    mesAtual.setMonth(mesAtual.getMonth() + d);
    atualizar();
}

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

// INIT COM PIN/TESTE/PRODUÇÃO
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
    iniciarApp();
}
