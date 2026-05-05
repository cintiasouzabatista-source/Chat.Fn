// SISTEMA DE PIN
let tentativasPin = 0;
let pinBloqueadoAte = 0;
// REMOVE essas 2 linhas:
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

function initPin() {
    const telaPin = document.getElementById('tela-pin');
    const appContent = document.getElementById('app-content');
    const titulo = document.getElementById('pin-titulo');
    const subtitulo = document.getElementById('pin-subtitulo');
    const btnEsqueci = document.getElementById('btn-esqueci');
    
    // RECALCULA AQUI
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
    // RECALCULA AQUI TAMBÉM
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

// MENU - USA classList, NÃO style.display
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

// FUNÇÕES TESTE OU PRODUÇÃO
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

// TUTORIAL
function verificarTutorial() {
    const viuTutorial = localStorage.getItem('bankday_tutorial');
    const PIN_SALVO = localStorage.getItem('bankday_pin');
    const EH_PRIMEIRO =!PIN_SALVO;
    
    if (!viuTutorial && EH_PRIMEIRO) {
        setTimeout(() => {
            document.getElementById('tutorial').style.display = 'flex';
        }, 500);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
    iniciarApp();
}
