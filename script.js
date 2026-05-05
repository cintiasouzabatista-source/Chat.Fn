// SISTEMA DE PIN
let tentativasPin = 0;
let pinBloqueadoAte = 0;

// REMOVE ESSAS 2 LINHAS:
// const PIN_SALVO = localStorage.getItem('bankday_pin');
// const PIN_PRIMEIRO_ACESSO =!PIN_SALVO;

// SISTEMA TESTE OU PRODUÇÃO
let modoTeste = localStorage.getItem('bankday_modo') === 'teste';
let modoProducao = localStorage.getItem('bankday_modo') === 'producao';

// script.js - Lógica principal do Chat Financeiro
let transacoes = JSON.parse(localStorage.getItem('bankday_transacoes') || '[]');
let contas = JSON.parse(localStorage.getItem('bankday_contas') || '["Conta Principal"]');
let cartoes = JSON.parse(localStorage.getItem('bankday_cartoes') || '[]');
let contasFixas = JSON.parse(localStorage.getItem('bankday_contas_fixas') || '[]');
let idEditando = null;
let mesAtual = localStorage.getItem('bankday_mesAtual');
let transacaoPendente = null;
let msgSistemaId = null;
let menuTimeout = null;
let saldoProjetadoAtivo = localStorage.getItem('saldoProjetado') === 'true';
let abaAtualCC = 'contas';
let contaEditando = null;
let cartaoEditando = null;
let tutorialStep = 1;
const TOTAL_STEPS = 4;
let fixaEditando = null;

// FUNÇÕES TESTE OU PRODUÇÃO - TEM QUE VIR ANTES
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
        localStorage.removeItem('bankday_transacoes');
        localStorage.removeItem('bankday_teste_expira');
        transacoes = [];
        contas = ['Conta Principal'];
        localStorage.setItem('bankday_contas', JSON.stringify(contas));
        modoTeste = false;
        modoProducao = true;
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
    document.getElementById('toast-expiracao').classList.add('hidden');
}

function verificarModoInicial() {
    const modoDefinido = localStorage.getItem('bankday_modo');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;

    if (EH_PRIMEIRO &&!modoDefinido) {
        setTimeout(() => {
            document.getElementById('modal-onboarding').style.display = 'flex';
        }, 500);
        return false;
    }
    return true;
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
        if (!contas.includes('Conta Teste')) {
            contas = ['Conta Teste'];
            localStorage.setItem('bankday_contas', JSON.stringify(contas));
        }
        mostrarBannerTeste();
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
    contas = [nome];
    localStorage.setItem('bankday_contas', JSON.stringify(contas));
    if (saldo > 0) {
        transacoes.push({
            id: Date.now(),
            descricao: 'Saldo inicial',
            valor: saldo,
            valorTotal: saldo,
            tipo: 'entrada',
            categoria: 'Outras Receitas',
            conta: nome,
            parcelas: 1,
            data: new Date().toISOString()
        });
        localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
    }
    document.getElementById('modal-cadastro-conta').style.display = 'none';
    document.getElementById('tutorial').style.display = 'flex';
    atualizarCalculos();
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
        // Força reload pra recarregar o estado
        location.reload();
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
    if (verificarTesteExpirado()) return;
    if (modoTeste) {
        mostrarBannerTeste();
        mostrarToastExpiracao();
    }
    if (verificarModoInicial()) {
        verificarTutorial();
    }
}

function esqueciPin() {
    if (confirm('Esqueceu o PIN?\n\nIsso vai apagar TODOS os dados do app:\n- Transações\n- Contas\n- Cartões\n\nNão tem volta!')) {
        localStorage.clear();
        location.reload();
    }
}

// Init - RODA SEMPRE
function iniciarApp() {
    console.log('Iniciando BankDay...');

    const PIN_SALVO_AGORA = localStorage.getItem('bankday_pin');

    if (!PIN_SALVO_AGORA) {
        initPin();
    } else {
        if (verificarTesteExpirado()) return;
        initPin();
    }

    atualizarMes();
    aplicarVisualSaldoProjetado();
    atualizarCalculos();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
    iniciarApp();
}
