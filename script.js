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
let menuTimeout = null;

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
 return valoresOcultos? 'R$ ••••' : `R$ ${v.toFixed(2).replace('.',',')}`;
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
        'Alimentação': ['ifood', 'rappi', 'uber eats', 'restaurante', 'padaria', 'mercado', 'acougue', 'feira', 'lanche', 'pizza', 'cafe'],
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
    const chat = document.getElementById("chat-box");
    if (!chat) return;
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement("div");
    div.className = `flex ${tipo === 'user'? 'justify-end' : 'justify-start'} mb-3`;
    if (id) div.onclick = () => abrirModalEditar(id);
    div.innerHTML = `
        <div class="${tipo === 'user'? 'bg-blue-600' : 'bg-slate-700'} text-white px-4 py-2 rounded-2xl max-w-[80%] cursor-pointer">
            <p class="text-sm">${texto}</p>
            ${info? `<p class="text-xs opacity-70 mt-1">${info}</p>` : ''}
            <p class="text-xs opacity-50 mt-1">${hora}</p>
        </div>
    `;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (autoLimpar && tipo === 'system') {
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 8000);
    }
}

// FUNÇÕES DO HEADER
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

function mudarMes(d) {
    mesAtual.setMonth(mesAtual.getMonth() + d);
    atualizar();
    atualizarMes();
}

// LANÇAMENTO PRINCIPAL
function processarMensagem() {
    const input = document.getElementById("user-input");
    if (!input) return;

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

    // Cores
    if (elSaldo) elSaldo.className = `val-field text-lg font-black mt-1 ${saldo >= 0? 'text-blue-500' : 'text-rose-500'}`;
    if (elLiquido) elLiquido.className = `val-field text-xl font-black mt-1 ${liquido >= 0? 'text-emerald-500' : 'text-rose-500'}`;
}

function atualizarMes() {
    const el = document.getElementById('mesAtual');
    if (el) el.textContent = cap(mesAtual.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(' de ',' '));
}

// MENU FUNCTIONS
function abrirResumo(tipo) {
    addMensagem('Resumo em desenvolvimento: ' + tipo, 'system');
}

function abrirExtrato() {
    addMensagem('Use o menu Mais > Extrato em breve', 'system');
}

function abrirFaturas() {
    addMensagem('Faturas em desenvolvimento', 'system');
}

function abrirContasCartoes() {
    addMensagem('Use Mais > Gerenciar Contas/Cartões', 'system');
}

function abrirContasFixas() {
    addMensagem('Contas fixas em desenvolvimento', 'system');
}

function toggleSaldoProjetado() {
    config.projetarSaldo =!config.projetarSaldo;
    salvar();
    aplicarVisualSaldoProjetado();
    atualizar();
    toggleMenu();
    addMensagem(`Projeção ${config.projetarSaldo? 'ativada' : 'desativada'}`, 'system');
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

function abrirTutorial() {
    document.getElementById('tutorial').style.display = 'flex';
}

function abrirModalReset() {
    if (confirm('Resetar tudo? Isso apaga TODOS os dados.')) resetarTudo();
}

function fecharResumoCard() {
    document.getElementById('modal-resumo-card').style.display = 'none';
}

function fecharExtrato() {
    document.getElementById('modal-extrato').style.display = 'none';
}

function filtrarExtrato() {
    addMensagem('Filtro em desenvolvimento', 'system');
}

// MODAL EDITAR
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
    const catsDoTipo = CATEGORIAS[tipo] || CATEGORIAS['saida'];
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

function excluirMensagem() {
    deletarTransacao();
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

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

// INIT
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
    iniciarApp();
}
