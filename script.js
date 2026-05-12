if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW erro:', err));
}

// VARIÁVEIS GLOBAIS
let tentativasPin = 0;
let pinBloqueadoAte = 0;
let modoTeste = true;
let modoProducao = false;
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
let tipoGraficoAtivo = 'categoria';

const formatar = v => {
    v = Number(v) || 0;
    return valoresOcultos ? 'R$ ••••' : `R$ ${v.toFixed(2).replace('.', ',')}`;
};

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const CATEGORIAS = {
    entrada: {
        'Salário': ['salario', 'pagamento', 'freela'],
        'Vendas': ['venda', 'vendi', 'mercado', 'olx'],
        'Outras Receitas': []
    },
    saida: {
        'Alimentação': ['ifood', 'mercado', 'restaurante', 'cafe', 'lanche', 'pizza'],
        'Transporte': ['uber', '99', 'gasolina', 'posto'],
        'Moradia': ['aluguel', 'luz', 'agua', 'internet'],
        'Lazer': ['cinema', 'netflix', 'spotify', 'bar'],
        'Compras': ['shopee', 'amazon', 'roupa', 'tenis'],
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
    if (!desc) return tipo === 'entrada' ? 'Outras Receitas' : 'Outras Despesas';
    const d = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const categoriasDoTipo = CATEGORIAS[tipo];

    for (const [categoria, palavras] of Object.entries(categoriasDoTipo)) {
        if (Array.isArray(palavras) && palavras.some(p => d.includes(p))) {
            return categoria;
        }
    }
    return tipo === 'entrada' ? 'Outras Receitas' : 'Outras Despesas';
}

// --- SISTEMA DE PIN ---

function initPin() {
    const telaPin = document.getElementById('tela-pin');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO = !PIN_SALVO;
    
    document.getElementById('pin-titulo').textContent = EH_PRIMEIRO ? 'Crie seu PIN' : 'Digite seu PIN';
    document.getElementById('pin-subtitulo').textContent = EH_PRIMEIRO ? '4 dígitos para proteger o app' : 'Para acessar o app';
    document.getElementById('btn-esqueci').style.display = EH_PRIMEIRO ? 'none' : 'block';
    
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

function validarPin() {
    const inputs = document.querySelectorAll('.pin-input');
    const pin = Array.from(inputs).map(i => i.value).join('');
    if (pin.length !== 4) return;

    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO = !PIN_SALVO;
    const erro = document.getElementById('pin-erro');

    if (EH_PRIMEIRO) {
        localStorage.setItem('bankday_pin', btoa(pin));
        liberarApp();
    } else {
        if (btoa(pin) === PIN_SALVO) {
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
    inputs.forEach(i => { i.disabled = true; i.value = ''; });
    let contador = s;
    erro.classList.remove('hidden');
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

function liberarApp() {
    tentativasPin = 0;
    pinBloqueadoAte = 0;
    document.getElementById('pin-erro').classList.add('hidden');
    document.getElementById('tela-pin').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
}

// --- IMPORTAÇÃO E PROCESSAMENTO ---

function executarImportacao() {
    const textarea = document.getElementById('texto-importacao');
    const texto = textarea ? textarea.value.trim() : "";
    
    if (!texto) {
        addMensagem('Cole o extrato primeiro', 'system');
        return;
    }

    const linhas = texto.split('\n');
    let importadas = 0;

    linhas.forEach((linha) => {
        if (!linha.trim()) return;

        const matchValor = linha.match(/(\d{1,3}(\.\d{3})*,\d{2})|(\d+\.\d{2})|(\d+,\d{2})|(\d+)/);
        
        if (matchValor) {
            let valorTexto = matchValor[0].replace(/\./g, '').replace(',', '.');
            let valorNum = Math.abs(parseFloat(valorTexto));
            
            if (!isNaN(valorNum) && valorNum > 0) {
                const ehEntrada = linha.toLowerCase().match(/recebi|vendi|ganhei|salario|pix recebido|deposito|estorno/);
                const tipoFinal = ehEntrada ? 'entrada' : 'saida';
                const desc = linha.replace(matchValor[0], '').replace(/R\$/g, '').trim() || 'Importado';

                dados.push({
                    id: Date.now() + Math.random(),
                    descricao: cap(desc),
                    valor: valorNum,
                    tipo: tipoFinal,
                    metodo: 'conta',
                    banco: contas[0]?.nome || 'Principal',
                    data: new Date().toISOString(),
                    categoria: identificarCategoria(desc, tipoFinal)
                });
                importadas++;
            }
        }
    });

    if (importadas > 0) {
        salvar();
        atualizar();
        fecharModal('modal-importar');
        if (textarea) textarea.value = "";
        addMensagem(`${importadas} transações importadas!`, 'system');
    } else {
        addMensagem('Nenhum valor reconhecido no texto.', 'system');
    }
}

function processarMensagem() {
    const input = document.getElementById("user-input");
    if (!input) return;
    let textoOriginal = input.value.trim();
    if (!textoOriginal) return;
    
    const texto = textoOriginal.toLowerCase();
    input.value = "";

    const tipo = texto.includes('recebi') || texto.includes('vendi') || texto.includes('ganhei') ? 'entrada' : 'saida';
    const valorMatch = texto.match(/\d+(?:[.,]\d+)?/);
    
    if (!valorMatch) {
        addMensagem("Valor não identificado. Ex: 'cafe 15'", 'system');
        return;
    }

    const valorNum = parseFloat(valorMatch[0].replace(',', '.'));
    const desc = texto.replace(/recebi|gastei|comprei|paguei|vendi|ganhei|no|na|em|conta|\d+(?:[.,]\d+)?|reais?/gi, '').trim() || 'Lançamento';
    const id = Date.now();

    dados.push({
        id: id,
        descricao: cap(desc),
        valor: valorNum,
        tipo: tipo,
        metodo: 'conta',
        banco: contas[0]?.nome || 'Principal',
        data: new Date().toISOString(),
        categoria: identificarCategoria(desc, tipo)
    });

    addMensagem(textoOriginal, 'user', `Categoria: ${identificarCategoria(desc, tipo)}`, false, id);
    salvar();
    atualizar();
}

// --- ATUALIZAÇÃO DA UI ---

function atualizar() {
    // Sincroniza com localstorage para garantir dados novos
    dados = JSON.parse(localStorage.getItem('bankday') || '[]');
    
    const mes = mesAtual.getMonth();
    const ano = mesAtual.getFullYear();
    
    let dadosMes = dados.filter(d => {
        const dt = new Date(d.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    let ent = dadosMes.filter(d => d.tipo === 'entrada').reduce((s, d) => s + d.valor, 0);
    let sai = dadosMes.filter(d => d.tipo === 'saida' && d.metodo !== 'cartao').reduce((s, d) => s + d.valor, 0);
    let fat = dadosMes.filter(d => d.tipo === 'saida' && d.metodo === 'cartao').reduce((s, d) => s + d.valor, 0);
    
    let saldo = ent - sai;
    let liquido = saldo - fat;

    // Atualiza elementos na tela
    const atualizarTexto = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatar(valor);
    };

    atualizarTexto('card-entradas', ent);
    atualizarTexto('card-saidas', sai);
    atualizarTexto('card-saldo', saldo);
    atualizarTexto('card-cartoes', fat);
    atualizarTexto('card-liquido', liquido);

    // Cores
    const elSaldo = document.getElementById('card-saldo');
    if (elSaldo) elSaldo.className = `val ${saldo >= 0 ? 'text-blue' : 'text-rose'}`;
    
    const elLiquido = document.getElementById('card-liquido');
    if (elLiquido) elLiquido.className = `val big ${liquido >= 0 ? 'text-emerald' : 'text-rose'}`;
}

// --- FUNÇÕES DE AUXÍLIO ---

function addMensagem(texto, tipo = 'system', info = '', autoLimpar = true, id = null) {
    const chat = document.getElementById("chat-box");
    if (!chat) return;
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement("div");
    div.className = `msg ${tipo}`;
    div.innerHTML = `
        <div class="msg-bubble">
            <p>${texto}</p>
            ${info ? `<span class="msg-badge">${info}</span>` : ''}
            <div class="msg-time">${hora}</div>
        </div>
    `;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (autoLimpar && tipo === 'system') {
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 5000);
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function mudarMes(d) {
    mesAtual.setMonth(mesAtual.getMonth() + d);
    document.getElementById('mesAtual').textContent = cap(mesAtual.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}));
    atualizar();
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    atualizar();
    const input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') processarMensagem();
        });
    }
});
