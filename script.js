let menuTimeout = null;
let tentativasPin = 0;
let pinBloqueadoAte = 0;
let modoTeste = localStorage.getItem('bankday_modo') === 'teste';
let modoProducao = localStorage.getItem('bankday_modo') === 'producao';

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
        'Alimentação': ['ifood','mercado','restaurante','cafe','lanche'],
        'Transporte': ['uber','99','gasolina','posto'],
        'Moradia': ['aluguel','luz','agua','internet'],
        'Lazer': ['cinema','netflix','spotify','jogo','bar'],
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
    if (!modo) {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('tela-pin').style.display = 'none';
        setTimeout(() => document.getElementById('modal-onboarding').style.display = 'flex', 300);
        atualizarMes();
        atualizar();
        return;
    }
    if (modo === 'teste') {
        document.getElementById('tela-pin').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        if (!contas.length) contas = [{nome: 'Conta Teste', saldoInicial: 0}];
    } else {
        initPin();
    }
    atualizarMes();
    atualizar();
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
    if (pin.length!== 4) return;

    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;
    const erro = document.getElementById('pin-erro');

    if (EH_PRIMEIRO) {
        localStorage.setItem('bankday_pin', btoa(pin));
        liberarApp();
    } else {
        if (btoa(pin) === PIN_SALVO) {
            tentativasPin = 0;
            liberarApp();
        } else {
            tentativasPin++;
            erro.textContent = `PIN incorreto. ${3 - tentativasPin} tentativas restantes`;
            erro.classList.remove('hidden');
            inputs.forEach(i => { i.value = ''; i.classList.add('border-rose-500'); });
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
    inputs.forEach(i => { i.disabled = true; i.value = ''; });
    let contador = s;
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
    const input = document.getElementById("user-input");
    if (!input) return;
    let textoOriginal = input.value.trim();
    if (!textoOriginal) return;
    input.value = "";

    let texto = textoOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
