// SISTEMA DE PIN
let tentativasPin = 0;
let pinBloqueadoAte = 0;
const PIN_SALVO = localStorage.getItem('bankday_pin');
const PIN_PRIMEIRO_ACESSO =!PIN_SALVO;

function initPin() {
    const telaPin = document.getElementById('tela-pin');
    const appContent = document.getElementById('app-content');
    const titulo = document.getElementById('pin-titulo');
    const subtitulo = document.getElementById('pin-subtitulo');
    const btnEsqueci = document.getElementById('btn-esqueci');

    if (PIN_PRIMEIRO_ACESSO) {
        titulo.textContent = 'Crie seu PIN';
        subtitulo.textContent = '4 dígitos para proteger o app';
        btnEsqueci.classList.add('hidden');
    } else {
        titulo.textContent = 'Digite seu PIN';
        subtitulo.textContent = 'Para acessar o app';
        btnEsqueci.classList.remove('hidden');

        // Verifica bloqueio
        const agora = Date.now();
        if (pinBloqueadoAte > agora) {
            const segundos = Math.ceil((pinBloqueadoAte - agora) / 1000);
            bloquearPin(segundos);
        }
    }

    // Auto-focus e navegação entre inputs
    const inputs = document.querySelectorAll('.pin-input');
    inputs[0].focus();

    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && idx < 3) {
                inputs[idx + 1].focus();
            }
            if (idx === 3 && e.target.value.length === 1) {
                validarPin();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && idx > 0) {
                inputs[idx - 1].focus();
            }
        });
    });

    telaPin.style.display = 'flex';
    appContent.style.display = 'none';
}

function validarPin() {
    const inputs = document.querySelectorAll('.pin-input');
    const pinDigitado = Array.from(inputs).map(i => i.value).join('');

    if (pinDigitado.length!== 4) return;

    const erro = document.getElementById('pin-erro');

    if (PIN_PRIMEIRO_ACESSO) {
        // Criar PIN
        localStorage.setItem('bankday_pin', btoa(pinDigitado)); // base64 simples
        liberarApp();
    } else {
        // Verificar PIN
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
                pinBloqueadoAte = Date.now() + 30000; // 30s
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
    document.getElementById('app-content').style.display = 'block';
}

function esqueciPin() {
    if (confirm('Esqueceu o PIN?\n\nIsso vai apagar TODOS os dados do app:\n- Transações\n- Contas\n- Cartões\n\nNão tem volta!')) {
        localStorage.clear();
        location.reload();
    }
}

// Chama na inicialização
document.addEventListener('DOMContentLoaded', () => {
    initPin(); // Adiciona isso antes de atualizarMes()
    atualizarMes();
    aplicarVisualSaldoProjetado();
    atualizarCalculos();
});
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
// NORMALIZAÇÃO E CATEGORIAS
function normalizarTexto(txt) {
    return txt.toLowerCase()
     .normalize('NFD')
     .replace(/[\u0300-\u036f]/g, '')
     .replace(/[.,!?;:]/g, '')
     .trim();
}

function capitalizarPrimeira(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function detectarCategoria(desc) {
    const d = normalizarTexto(desc);
    const categorias = {
        'Alimentação': ['ifood', 'rappi', 'uber eats', 'lanche', 'lanches', 'hamburguer', 'pizza', 'pizzaria', 'restaurante', 'bar', 'boteco', 'padaria', 'paes', 'pao', 'mercado', 'supermercado', 'acougue', 'hortifruti', 'feira', 'comida', 'almoco', 'janta', 'cafe', 'cafeteria', 'sorvete', 'acai', 'doceria', 'bolo', 'salada', 'marmita'],
        'Transporte': ['uber', '99', 'taxi', 'onibus', 'metro', 'trem', 'passagem', 'pedagio', 'estacionamento', 'gasolina', 'combustivel', 'posto', 'alcool', 'diesel', 'mecanico', 'oficina', 'pneu', 'oleo', 'lavagem', 'carro', 'moto', 'bike', 'bicicleta', 'ipva'],
        'Moradia': ['aluguel', 'condominio', 'iptu', 'luz', 'energia', 'enel', 'cpfl', 'light', 'agua', 'saneamento', 'sabesp', 'gas', 'comgas', 'internet', 'net', 'vivo', 'claro', 'tim', 'oi', 'telefone', 'celular', 'faxina', 'diarista', 'reforma', 'material', 'construcao', 'moveis'],
        'Saúde': ['farmacia', 'drogaria', 'remedio', 'medicamento', 'medico', 'medica', 'consulta', 'dentista', 'hospital', 'clinica', 'laboratorio', 'exame', 'plano', 'unimed', 'amil', 'sulamerica', 'psicologo', 'terapia', 'fisio', 'fisioterapia', 'academia', 'gym', 'pilates'],
        'Lazer': ['cinema', 'teatro', 'show', 'festa', 'balada', 'ingresso', 'streaming', 'netflix', 'spotify', 'prime', 'disney', 'hbo', 'globoplay', 'youtube', 'jogo', 'game', 'psn', 'xbox', 'steam', 'viagem', 'hotel', 'airbnb', 'passagem aerea', 'passeio', 'bar', 'cerveja'],
        'Educação': ['escola', 'faculdade', 'curso', 'livro', 'material escolar', 'matricula', 'mensalidade', 'idioma', 'ingles', 'espanhol', 'udemy', 'alura', 'curso online', 'colegio'],
        'Compras': ['shopping', 'loja', 'roupa', 'sapato', 'tenis', 'calcado', 'presente', 'eletronico', 'celular', 'notebook', 'tv', 'amazon', 'mercado livre', 'shopee', 'shein', 'aliexpress', 'magazine', 'americanas', 'casas bahia', 'magalu'],
        'Cartão': ['fatura', 'cartao', 'credito', 'nubank', 'itau', 'bradesco', 'santander', 'bb', 'caixa', 'inter', 'c6', 'neon', 'pagbank'],
        'Investimento': ['aplicacao', 'investimento', 'tesouro', 'cdb', 'lci', 'lca', 'acao', 'fii', 'fundo', 'bitcoin', 'crypto', 'cripto', 'poupanca', 'renda fixa'],
        'Salário': ['salario', 'pagamento', 'holerite', '13', 'decimo', 'ferias', 'bonus', 'comissao', 'freelance', 'freela', 'pix recebido', 'renda']
    };
    for (const [cat, palavras] of Object.entries(categorias)) {
        if (palavras.some(p => d.includes(p))) return cat;
    }
    return 'Outros';
}

if (!mesAtual) {
    const hoje = new Date();
    mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('bankday_mesAtual', mesAtual);
}

const CATEGORIAS = {
    entrada: ['Salário', 'Vendas', 'Presente', 'Investimento', 'Reembolso', 'Outras Receitas'],
    saida: ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Compras', 'Educação', 'Assinaturas', 'Pets', 'Outras Despesas'],
    cartao: ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Compras', 'Educação', 'Assinaturas', 'Pets', 'Outras Despesas']
};

function normalizar(texto) {
    return texto.toLowerCase()
.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9\sx]/g, '')
.trim();
}

function setMenuAtivo(pagina) {
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pagina) btn.classList.add('active');
    });
}

function toggleMenu() {
    const menu = document.getElementById('menuDropdown');
    const isOpen = menu.style.display === 'flex';
    if (menuTimeout) clearTimeout(menuTimeout);
    if (isOpen) {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'flex';
        menuTimeout = setTimeout(() => {
            menu.style.display = 'none';
        }, 10000);
    }
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('menuDropdown');
    const btn = document.getElementById('btnMenu');
    if (menu.style.display === 'flex' &&!menu.contains(e.target) &&!btn.contains(e.target)) {
        menu.style.display = 'none';
        if (menuTimeout) clearTimeout(menuTimeout);
    }
});

function aplicarVisualSaldoProjetado() {
    const btn = document.getElementById('btnSaldoProjetado');
    if (!btn) return;
    if (saldoProjetadoAtivo) {
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-blue-500');
    } else {
        btn.classList.remove('text-blue-500');
        btn.classList.add('text-slate-400');
    }
}

function toggleSaldoProjetado() {
    saldoProjetadoAtivo =!saldoProjetadoAtivo;
    localStorage.setItem('saldoProjetado', saldoProjetadoAtivo);
    aplicarVisualSaldoProjetado();
    atualizarCalculos();
}

function getMesAnterior() {
    let [ano, mes] = mesAtual.split('-');
    mes = parseInt(mes) - 1;
    if (mes === 0) {
        mes = 12;
        ano = parseInt(ano) - 1;
    }
    return `${ano}-${String(mes).padStart(2, '0')}`;
}

function salvarDadosMes(dados) {
    localStorage.setItem(`dados_${mesAtual}`, JSON.stringify(dados));
}

function lancarContasFixas() {
    const [ano, mes] = mesAtual.split('-').map(Number);
    contasFixas.forEach(fixa => {
        if (!fixa.ativa) return;
        const jaExiste = transacoes.some(t =>
            t.idFixa === fixa.id &&
            new Date(t.data).getMonth() === mes - 1 &&
            new Date(t.data).getFullYear() === ano
        );
        if (!jaExiste) {
            const dataLancamento = new Date(ano, mes - 1, fixa.dia);
            transacoes.push({
                id: Date.now() + Math.random(),
                idFixa: fixa.id,
                descricao: fixa.descricao,
                valor: fixa.valor,
                tipo: fixa.tipo,
                categoria: fixa.categoria,
                conta: fixa.conta,
                data: dataLancamento.toISOString(),
                recorrente: true
            });
        }
    });
    localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
}

function mudarMes(direcao) {
    const [ano, mes] = mesAtual.split('-').map(Number);
    const data = new Date(ano, mes - 1 + direcao, 1);
    mesAtual = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('bankday_mesAtual', mesAtual);
    atualizarMes();
    lancarContasFixas();
    atualizarCalculos();
}

function atualizarMes() {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [ano, mes] = mesAtual.split('-');
    document.getElementById('mesAtual').textContent = `${meses[parseInt(mes)-1]} ${ano}`;
}

function abrirFaturas() {
    setMenuAtivo('faturas');
    document.getElementById('modal-faturas').style.display = 'flex';
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [ano, mes] = mesAtual.split('-');
    document.getElementById('fatura-mes').textContent = `${meses[parseInt(mes)-1]} ${ano}`;
    const hoje = new Date();
    const [anoAtual, mesAtualNum] = mesAtual.split('-').map(Number);
    const lista = document.getElementById('lista-faturas');
    if (cartoes.length === 0) {
        lista.innerHTML = '<p class="text-center text-slate-500 py-8">Nenhum cartão cadastrado</p>';
        return;
    }
    lista.innerHTML = cartoes.map(cartao => {
        const gastosMes = transacoes.filter(t => {
            const dt = new Date(t.data);
            return t.tipo === 'cartao' && t.conta === cartao.nome && dt.getMonth() === mesAtualNum - 1 && dt.getFullYear() === anoAtual;
        });
        const total = gastosMes.reduce((s,t) => s + t.valor, 0);
        let status = 'Fechada';
        let statusCor = 'bg-rose-600';
        if (hoje.getFullYear() === anoAtual && hoje.getMonth() === mesAtualNum - 1) {
            if (hoje.getDate() <= cartao.diaFechamento) {
                status = 'Aberta';
                statusCor = 'bg-emerald-600';
            }
        } else if (hoje < new Date(anoAtual, mesAtualNum - 1, 1)) {
            status = 'Futura';
            statusCor = 'bg-slate-600';
        }
        return `
            <div class="bg-slate-800 p-4 rounded-lg">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-bold text-lg">${cartao.nome}</p>
                        <p class="text-xs text-slate-400">Fecha dia ${cartao.diaFechamento} • Vence dia ${cartao.diaVencimento}</p>
                    </div>
                    <span class="${statusCor} text- px-2 py-1 rounded font-bold">${status}</span>
                </div>
                <div class="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                    <span class="text-slate-400 text-sm">Total da Fatura</span>
                    <span class="text-xl font-black text-rose-500">R$ ${total.toFixed(2).replace('.',',')}</span>
                </div>
            </div>
        `;
    }).join('');
}

function fecharFaturas() {
    document.getElementById('modal-faturas').style.display = 'none';
}

function abrirContasCartoes() {
    toggleMenu();
    document.getElementById('modal-contas-cartoes').style.display = 'flex';
    abaContaCartao('contas');
}

function fecharContasCartoes() {
    document.getElementById('modal-contas-cartoes').style.display = 'none';
}

function abaContaCartao(tipo) {
    abaAtualCC = tipo;
    document.getElementById('aba-contas').className = tipo === 'contas'? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold' : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';
    document.getElementById('aba-cartoes').className = tipo === 'cartoes'? 'flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold' : 'flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold';
    const lista = document.getElementById('lista-contas-cartoes');
    if (tipo === 'contas') {
        lista.innerHTML = contas.map(c => `
            <div class="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                <span class="font-bold text-white light-mode:text-slate-800">${c}</span>
                <div class="flex gap-3">
                    <button onclick="editarConta('${c}')" class="text-blue-400"><i class="fas fa-pen"></i></button>
                    <button onclick="excluirConta('${c}')" class="text-rose-500"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('') || '<p class="text-center text-slate-500 py-4">Nenhuma conta</p>';
    } else {
        lista.innerHTML = cartoes.map(c => `
            <div class="bg-slate-800 p-3 rounded-lg">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-white light-mode:text-slate-800">${c.nome}</p>
                        <p class="text-xs text-slate-400">Fecha ${c.diaFechamento} • Vence ${c.diaVencimento}</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="editarCartao('${c.nome}')" class="text-blue-400"><i class="fas fa-pen"></i></button>
                        <button onclick="excluirCartao('${c.nome}')" class="text-rose-500"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `).join('') || '<p class="text-center text-slate-500 py-4">Nenhum cartão</p>';
    }
}

function adicionarContaCartao() {
    if (abaAtualCC === 'contas') {
        document.getElementById('modal-add-conta').style.display = 'flex';
    } else {
        document.getElementById('modal-add-cartao').style.display = 'flex';
    }
}

function fecharModalAddConta() {
    document.getElementById('modal-add-conta').style.display = 'none';
    document.getElementById('conta-nome').value = '';
    document.getElementById('conta-saldo').value = '';
    document.getElementById('conta-saldo').placeholder = 'Ex: 1000.00';
    document.querySelector('#modal-add-conta h3').textContent = 'Nova Conta';
    contaEditando = null;
}

function salvarConta() {
    const nome = document.getElementById('conta-nome').value.trim();
    const saldoInicial = parseFloat(document.getElementById('conta-saldo').value) || 0;
    if (!nome) {
        alert('Preencha o nome da conta');
        return;
    }
    if (contaEditando) {
        const index = contas.indexOf(contaEditando);
        if (contas.includes(nome) && nome!== contaEditando) {
            alert('Já existe uma conta com esse nome');
            return;
        }
        contas[index] = nome;
        transacoes.forEach(t => {
            if (t.conta === contaEditando) t.conta = nome;
        });
        contasFixas.forEach(f => {
            if (f.conta === contaEditando) f.conta = nome;
        });
        contaEditando = null;
    } else {
        if (contas.includes(nome)) {
            alert('Conta já existe');
            return;
        }
        contas.push(nome);
        if (saldoInicial > 0) {
            transacoes.push({
                id: Date.now(),
                descricao: `Saldo inicial - ${nome}`,
                valor: saldoInicial,
                valorTotal: saldoInicial,
                tipo: 'entrada',
                categoria: 'Outras Receitas',
                conta: nome,
                parcelas: 1,
                valorParcela: saldoInicial,
                data: new Date().toISOString()
            });
            atualizarCalculos();
        }
    }
    localStorage.setItem('bankday_contas', JSON.stringify(contas));
    localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
    localStorage.setItem('bankday_contas_fixas', JSON.stringify(contasFixas));
    fecharModalAddConta();
    abaContaCartao('contas');
}

function fecharModalAddCartao() {
    document.getElementById('modal-add-cartao').style.display = 'none';
    document.getElementById('cartao-nome').value = '';
    document.getElementById('cartao-fechamento').value = '';
    document.getElementById('cartao-vencimento').value = '';
    document.querySelector('#modal-add-cartao h3').textContent = 'Novo Cartão';
    cartaoEditando = null;
}

function salvarCartao() {
    const nome = document.getElementById('cartao-nome').value.trim();
    const fechamento = parseInt(document.getElementById('cartao-fechamento').value);
    const vencimento = parseInt(document.getElementById('cartao-vencimento').value);
    if (!nome ||!fechamento ||!vencimento) {
        alert('Preencha todos os campos');
        return;
    }
    if (cartaoEditando) {
        const index = cartoes.findIndex(c => c.nome === cartaoEditando);
        if (cartoes.some(c => c.nome === nome && c.nome!== cartaoEditando)) {
            alert('Já existe um cartão com esse nome');
            return;
        }
        cartoes[index] = { nome, diaFechamento: fechamento, diaVencimento: vencimento };
        transacoes.forEach(t => {
            if (t.conta === cartaoEditando) t.conta = nome;
        });
        contasFixas.forEach(f => {
            if (f.conta === cartaoEditando) f.conta = nome;
        });
        cartaoEditando = null;
    } else {
        if (cartoes.some(c => c.nome === nome)) {
            alert('Cartão já existe');
            return;
        }
        cartoes.push({ nome, diaFechamento: fechamento, diaVencimento: vencimento });
    }
    localStorage.setItem('bankday_cartoes', JSON.stringify(cartoes));
    localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
    localStorage.setItem('bankday_contas_fixas', JSON.stringify(contasFixas));
    fecharModalAddCartao();
    abaContaCartao('cartoes');
}

function editarConta(nomeAntigo) {
    contaEditando = nomeAntigo;
    document.getElementById('conta-nome').value = nomeAntigo;
    document.getElementById('conta-saldo').value = '';
    document.getElementById('conta-saldo').placeholder = 'Não altera o saldo';
    document.querySelector('#modal-add-conta h3').textContent = 'Editar Conta';
    document.getElementById('modal-add-conta').style.display = 'flex';
}

function editarCartao(nomeAntigo) {
    cartaoEditando = nomeAntigo;
    const cartao = cartoes.find(c => c.nome === nomeAntigo);
    document.getElementById('cartao-nome').value = cartao.nome;
    document.getElementById('cartao-fechamento').value = cartao.diaFechamento;
    document.getElementById('cartao-vencimento').value = cartao.diaVencimento;
    document.querySelector('#modal-add-cartao h3').textContent = 'Editar Cartão';
    document.getElementById('modal-add-cartao').style.display = 'flex';
}

function excluirConta(nome) {
    if (!confirm(`Excluir conta ${nome}?`)) return;
    contas = contas.filter(c => c!== nome);
    localStorage.setItem('bankday_contas', JSON.stringify(contas));
    abaContaCartao('contas');
}

function excluirCartao(nome) {
    if (!confirm(`Excluir cartão ${nome}?`)) return;
    cartoes = cartoes.filter(c => c.nome!== nome);
    localStorage.setItem('bankday_cartoes', JSON.stringify(cartoes));
    abaContaCartao('cartoes');
}

function abrirReserva() {
    adicionarMensagemSistema('RESERVA:\nFunção em desenvolvimento.\nAqui vai mostrar seu saldo guardado.');
    toggleMenu();
}

function abrirContasFixas() {
    toggleMenu();
    document.getElementById('modal-contas-fixas').style.display = 'flex';
    listarContasFixas();
}

function fecharContasFixas() {
    document.getElementById('modal-contas-fixas').style.display = 'none';
}

function listarContasFixas() {
    const lista = document.getElementById('lista-contas-fixas');
    if (contasFixas.length === 0) {
        lista.innerHTML = '<p class="text-center text-slate-500 py-8">Nenhuma conta fixa cadastrada<br><span class="text-xs">Digite "fixo dia X" numa transação pra criar</span></p>';
        return;
    }
    lista.innerHTML = contasFixas.map(f => `
        <div class="bg-slate-800 light-mode:bg-slate-100 p-3 rounded-lg border border-slate-700 light-mode:border-slate-200">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="font-bold text-white light-mode:text-slate-900">${f.descricao}</p>
                    <p class="text-xs text-slate-400">R$ ${f.valor.toFixed(2).replace('.', ',')} • Todo dia ${f.dia} • ${f.conta}</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="editarContaFixa(${f.id})" class="text-blue-400"><i class="fas fa-pen"></i></button>
                    <button onclick="excluirContaFixa(${f.id})" class="text-rose-500"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

let fixaEditando = null;
let tipoEdicaoFixa = null; // 'atual' ou 'todas'

function editarContaFixa(id) {
    fixaEditando = contasFixas.find(f => f.id === id);
    document.getElementById('fixa-desc').value = fixaEditando.descricao;
    document.getElementById('fixa-valor').value = fixaEditando.valor;
    document.getElementById('fixa-dia').value = fixaEditando.dia;
    document.getElementById('fixa-conta').innerHTML = contas.map(c => `<option value="${c}" ${c === fixaEditando.conta? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('modal-edit-fixa').style.display = 'flex';
}

function salvarEdicaoFixa(escopo) {
    const novaDesc = document.getElementById('fixa-desc').value;
    const novoValor = parseFloat(document.getElementById('fixa-valor').value);
    const novoDia = parseInt(document.getElementById('fixa-dia').value);
    const novaConta = document.getElementById('fixa-conta').value;

    if (!novaDesc ||!novoValor ||!novoDia ||!novaConta) {
        alert('Preencha todos os campos');
        return;
    }

    if (escopo === 'todas') {
        // Edita o modelo da conta fixa
        fixaEditando.descricao = novaDesc;
        fixaEditando.valor = novoValor;
        fixaEditando.dia = novoDia;
        fixaEditando.conta = novaConta;
        localStorage.setItem('bankday_contas_fixas', JSON.stringify(contasFixas));
        adicionarMensagemSistema(`Conta fixa atualizada para todos os meses`);
    } else {
        // Edita só a transação deste mês
        const [ano, mes] = mesAtual.split('-').map(Number);
        const transacaoMes = transacoes.find(t => 
            t.idFixa === fixaEditando.id && 
            new Date(t.data).getMonth() === mes - 1 && 
            new Date(t.data).getFullYear() === ano
        );
        if (transacaoMes) {
            transacaoMes.descricao = novaDesc;
            transacaoMes.valor = novoValor;
            transacaoMes.conta = novaConta;
            transacaoMes.data = new Date(ano, mes - 1, novoDia).toISOString();
            localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
            adicionarMensagemSistema(`Conta fixa atualizada só para ${mes}/${ano}`);
        }
    }
    fecharModalEditFixa();
    listarContasFixas();
    atualizarCalculos();
}

function fecharModalEditFixa() {
    document.getElementById('modal-edit-fixa').style.display = 'none';
    fixaEditando = null;
}

function excluirContaFixa(id) {
    fixaEditando = contasFixas.find(f => f.id === id);
    document.getElementById('fixa-excluir-nome').textContent = fixaEditando.descricao;
    document.getElementById('modal-excluir-fixa').style.display = 'flex';
}

function confirmarExcluirFixa(escopo) {
    if (escopo === 'todas') {
        // Remove o modelo e todas as transações futuras
        contasFixas = contasFixas.filter(f => f.id!== fixaEditando.id);
        const hoje = new Date();
        transacoes = transacoes.filter(t => 
            !(t.idFixa === fixaEditando.id && new Date(t.data) >= hoje)
        );
        localStorage.setItem('bankday_contas_fixas', JSON.stringify(contasFixas));
        localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
        adicionarMensagemSistema(`Conta fixa excluída de todos os meses futuros`);
    } else {
        // Remove só a transação deste mês
        const [ano, mes] = mesAtual.split('-').map(Number);
        transacoes = transacoes.filter(t => 
            !(t.idFixa === fixaEditando.id && 
              new Date(t.data).getMonth() === mes - 1 && 
              new Date(t.data).getFullYear() === ano)
        );
        localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
        adicionarMensagemSistema(`Conta fixa removida só de ${mes}/${ano}`);
    }
    fecharModalExcluirFixa();
    listarContasFixas();
    atualizarCalculos();
}

function fecharModalExcluirFixa() {
    document.getElementById('modal-excluir-fixa').style.display = 'none';
    fixaEditando = null;
}

function processarMensagem() {
    const input = document.getElementById('user-input');
    const texto = input.value.trim();
    if (!texto) return;
    if (transacaoPendente) {
        const nome = texto.trim();
        if (transacaoPendente.tipo === 'cartao') {
            if (!cartoes.some(c => c.nome === nome)) {
                cartoes.push({nome, diaFechamento: 7, diaVencimento: 15});
                localStorage.setItem('bankday_cartoes', JSON.stringify(cartoes));
            }
        } else {
            if (!contas.includes(nome)) {
                contas.push(nome);
                localStorage.setItem('bankday_contas', JSON.stringify(contas));
            }
        }
        if (transacaoPendente.parcelas > 1) {
            criarParcelas(transacaoPendente, nome);
        } else {
            transacaoPendente.conta = nome;
            transacoes.push(transacaoPendente);
        }
        localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
        adicionarMensagemNaTela(`${transacaoPendente.descricao} - R$ ${transacaoPendente.valor}`, transacaoPendente.id);
        removerMensagemSistema();
        atualizarCalculos();
        transacaoPendente = null;
        input.value = '';
        return;
    }
    const transacao = interpretarTexto(texto);
    if (!transacao.conta) {
        transacaoPendente = transacao;
        const tipoNome = transacao.tipo === 'cartao'? 'cartão' : 'conta';
        adicionarMensagemSistema(`Qual ${tipoNome}? Digite o nome:`);
        input.value = '';
        return;
    }
    if (transacao.parcelas > 1) {
        criarParcelas(transacao, transacao.conta);
        adicionarMensagemNaTela(`${transacao.descricao} - ${transacao.parcelas}x R$ ${transacao.valor}`, transacao.id);
    } else {
        transacoes.push(transacao);
        adicionarMensagemNaTela(`${transacao.descricao} - R$ ${transacao.valor}`, transacao.id);
    }
    localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
    atualizarCalculos();
    input.value = '';
}

function criarParcelas(transacaoBase, nomeConta) {
    const dataInicial = new Date();
    for (let i = 0; i < transacaoBase.parcelas; i++) {
        const dataParcela = new Date(dataInicial.getFullYear(), dataInicial.getMonth() + i, dataInicial.getDate());
      const parcela = {
    id: Date.now() + i,
    descricao: `${capitalizarPrimeira(transacaoBase.descricao)} ${i+1}/${transacaoBase.parcelas}`,
    valor: transacaoBase.valor,
    valorTotal: transacaoBase.valorTotal,
    tipo: 'cartao',
    categoria: transacaoBase.categoria,
    conta: nomeConta,
    parcelas: transacaoBase.parcelas,
    parcelaAtual: i + 1,
    valorParcela: transacaoBase.valor,
    data: dataParcela.toISOString()
};
        transacoes.push(parcela);
    }
}

function interpretarTexto(texto) {
    const id = Date.now() + Math.random();
    const t = texto.toLowerCase().trim();
    const [ano, mes] = mesAtual.split('-').map(Number);
    const original = texto.trim();

    const valorMatch = t.match(/(\d+[.,]?\d*)/);
    if (!valorMatch) return null;
    const valorTotal = parseFloat(valorMatch[0].replace(',', '.'));
    if (isNaN(valorTotal) || valorTotal <= 0) return null;

    let descLimpa = original.replace(valorMatch[0], '').trim();
    descLimpa = descLimpa.replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim();

    const entrada = /(recebi|recebimento|salario|salário|pix recebi|entrou|entrada|ganhei|vendi|renda)/.test(t);
    const cartao = /(cartao|cartão|credito|crédito|fatura)/.test(t);
    const tipo = entrada? 'entrada' : cartao? 'cartao' : 'saida';

    let parcelas = 1;
    const parcelaMatch = t.match(/(\d+)\s*x\b/);
    if (parcelaMatch) parcelas = parseInt(parcelaMatch[1]);

    const diaMatch = t.match(/dia\s+(\d{1,2})\b/);
    let dia = diaMatch? parseInt(diaMatch[1]) : new Date().getDate();
    if (dia > 31) dia = 31;
    if (dia < 1) dia = 1;

    let conta = contas[0];
    const bancoMatch = t.match(/@(\w+)|banco\s+(\w+)|conta\s+(\w+)/);
    if (bancoMatch) {
        const nomeBanco = bancoMatch[1] || bancoMatch[2] || bancoMatch[3];
        const contaExiste = contas.find(c => normalizarTexto(c).includes(normalizarTexto(nomeBanco)));
        if (contaExiste) conta = contaExiste;
    }

    const contaFixa = /(fixo|fixa|mensal|todo mes|todo mês)/.test(t);

    descLimpa = descLimpa
     .replace(/\b(recebi|gastei|paguei|cartao|cartão|credito|crédito|pix|entrada|saida|fixo|fixa|mensal|dia \d+|@\w+|banco \w+|conta \w+|\d+\s*x)\b/gi, '')
     .replace(/\s+/g, ' ')
     .trim();

    let descricao = capitalizarPrimeira(descLimpa) || 'Transação';
    if (descricao === 'Transação') {
        if (entrada) descricao = 'Recebimento';
        else if (cartao) descricao = 'Compra cartão';
        else descricao = 'Gasto';
    }

    const categoria = detectarCategoria(descricao);
    const data = new Date(ano, mes - 1, dia).toISOString();
    const valor = parcelas > 1? parseFloat((valorTotal / parcelas).toFixed(2)) : valorTotal;

   return {
    id, 
    descricao: capitalizarPrimeira(descricao), 
    valor, 
    valorTotal, 
    tipo, 
    categoria, 
    conta, 
    parcelas,
    valorParcela: valor, 
    data, 
    recorrente: contaFixa
};
}
function adicionarMensagemNaTela(texto, id) {
    const chat = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.id = `msg-${id}`;
    div.className = "bg-blue-600 text-white self-end p-3 rounded-2xl rounded-tr-none max-w-[85%] text-sm shadow-md message-fade cursor-pointer";
    div.onclick = () => abrirModal(id);
    div.innerText = texto;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    setTimeout(() => { if(div) div.remove(); }, 8000);
}

function adicionarMensagemSistema(texto) {
    removerMensagemSistema();
    const chat = document.getElementById('chat-box');
    const div = document.createElement('div');
    msgSistemaId = 'sys-' + Date.now();
    div.id = msgSistemaId;
    div.className = "bg-slate-600 text-white self-start p-3 rounded-2xl rounded-tl-none max-w-[85%] text-sm shadow-md message-fade";
    div.innerText = texto;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function removerMensagemSistema() {
    if (msgSistemaId) {
        const el = document.getElementById(msgSistemaId);
        if (el) el.remove();
        msgSistemaId = null;
    }
}

function atualizarCalculos() {
    let e = 0, s = 0, c = 0;
    const [ano, mesNum] = mesAtual.split('-').map(Number);
    const transacoesMes = transacoes.filter(t => {
        const dt = new Date(t.data);
        return dt.getMonth() === mesNum - 1 && dt.getFullYear() === ano;
    });
    transacoesMes.forEach(t => {
        if (t.tipo === 'entrada') e += t.valor;
        else if (t.tipo === 'saida') s += t.valor;
        else if (t.tipo === 'cartao') c += t.valor;
    });
    let saldoAnterior = 0;
    if (saldoProjetadoAtivo) {
        const mesAnterior = getMesAnterior();
        const dadosMesAnterior = JSON.parse(localStorage.getItem(`dados_${mesAnterior}`) || '{}');
        saldoAnterior = dadosMesAnterior.liquido || 0;
    }
    const saldo = e - s + saldoAnterior;
    const formatar = v => `R$ ${v.toFixed(2).replace('.',',')}`;
    document.getElementById('card-entradas').innerText = formatar(e);
    document.getElementById('card-saidas').innerText = formatar(s);
    document.getElementById('card-saldo').innerText = formatar(saldo);
    document.getElementById('card-cartoes').innerText = formatar(c);
    document.getElementById('card-liquido').innerText = formatar(saldo - c);
    salvarDadosMes({ entrada: e, saida: s, cartao: c, liquido: saldo - c });
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('theme-icon').className = isLight? 'fas fa-sun text-orange-500' : 'fas fa-moon text-blue-500';
}

function toggleVisibility() {
    document.querySelectorAll('.val-field').forEach(f => f.classList.toggle('hidden-val'));
    document.getElementById('eye-icon').classList.toggle('fa-eye-slash');
}

function abrirModal(id) {
    idEditando = id;
    const t = transacoes.find(x => x.id === id);
    document.getElementById('edit-desc').value = t.descricao;
    document.getElementById('edit-valor').value = t.valor;
    document.getElementById('edit-data').value = t.data.split('T')[0];
    document.getElementById('edit-tipo').value = t.tipo;
    const infoParc = document.getElementById('info-parcela');
    if (t.parcelas > 1) {
        infoParc.textContent = `${t.parcelas}x de R$ ${t.valorParcela.toFixed(2).replace('.',',')}`;
        infoParc.classList.remove('hidden');
    } else {
        infoParc.classList.add('hidden');
    }
    atualizarCategorias(t.categoria);
    atualizarContas(t.conta);
    document.getElementById('modal').style.display = 'flex';
}

function atualizarCategorias(selecionada = null) {
    const tipo = document.getElementById('edit-tipo').value;
    const select = document.getElementById('edit-categoria');
    select.innerHTML = '';
    CATEGORIAS[tipo].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === selecionada) opt.selected = true;
        select.appendChild(opt);
    });
}

function atualizarContas(selecionada = null) {
    const select = document.getElementById('edit-conta');
    select.innerHTML = '<option value="">Selecione...</option>';
    const grupoContas = document.createElement('optgroup');
    grupoContas.label = 'Contas';
    contas.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (normalizar(c) === normalizar(selecionada || '')) opt.selected = true;
        grupoContas.appendChild(opt);
    });
    select.appendChild(grupoContas);
    if (cartoes.length) {
        const grupoCartoes = document.createElement('optgroup');
        grupoCartoes.label = 'Cartões';
        cartoes
.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nome;
            opt.textContent = c.nome;
            if (c.nome === selecionada) opt.selected = true;
            grupoCartoes.appendChild(opt);
        });
        select.appendChild(grupoCartoes);
    }
}

function fecharModal() {
    const t = transacoes.find(x => x.id === idEditando);
    const novoTotal = parseFloat(document.getElementById('edit-valor').value) || 0;
    t.descricao = document.getElementById('edit-desc').value;
    t.valorTotal = novoTotal;
    t.valor = t.parcelas > 1? parseFloat((novoTotal / t.parcelas).toFixed(2)) : novoTotal;
    t.data = new Date(document.getElementById('edit-data').value).toISOString();
    t.tipo = document.getElementById('edit-tipo').value;
    t.categoria = document.getElementById('edit-categoria').value;
    t.conta = document.getElementById('edit-conta').value;
    localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
    atualizarCalculos();
    document.getElementById('modal').style.display = 'none';
}

function fecharModalSemSalvar() {
    document.getElementById('modal').style.display = 'none';
}

function excluirMensagem() {
    transacoes = transacoes.filter(x => x.id!== idEditando);
    localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
    const el = document.getElementById(`msg-${idEditando}`);
    if(el) el.remove();
    atualizarCalculos();
    document.getElementById('modal').style.display = 'none';
}

function abrirModalReset() {
    toggleMenu();
    document.getElementById('modal-reset').style.display = 'flex';
}

function fecharModalReset() {
    document.getElementById('modal-reset').style.display = 'none';
}

function confirmarReset(tipo) {
    if (tipo === 'transacoes') {
        if (!confirm('Apagar TODAS as transações?\nContas e cartões serão mantidos.')) return;
        transacoes = [];
        localStorage.setItem('bankday_transacoes', JSON.stringify(transacoes));
        atualizarCalculos();
        adicionarMensagemSistema('Transações apagadas.');
    } else {
        if (!confirm('APAGAR TUDO?\n\nIsso vai remover:\n- Transações\n- Contas e cartões\n- Contas fixas\n\nNão tem volta!')) return;
        transacoes = [];
        contas = ['Conta Principal'];
        cartoes = [];
        contasFixas = [];
        localStorage.clear();
        location.reload();
    }
    fecharModalReset();
}

function abrirExtrato() {
    setMenuAtivo('extrato');
    document.getElementById('menuDropdown').style.display = 'none';
    const catSelect = document.getElementById('filtro-categoria');
    catSelect.innerHTML = '<option value="">Todas categorias</option>';
    [...new Set(transacoes.map(t => t.categoria))].forEach(c => {
        if(c) catSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
    const contaSelect = document.getElementById('filtro-conta');
    contaSelect.innerHTML = '<option value="">Todas contas</option>';
    [...new Set([...contas,...cartoes.map(c=>c.nome)])].forEach(c => {
        if(c) contaSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
    document.getElementById('filtro-mes').value = mesAtual;
    filtrarExtrato();
    document.getElementById('modal-extrato').style.display = 'flex';
}

function fecharExtrato() {
    document.getElementById('modal-extrato').style.display = 'none';
}

function filtrarExtrato() {
    const tipo = document.getElementById('filtro-tipo').value;
    const cat = document.getElementById('filtro-categoria').value;
    const conta = document.getElementById('filtro-conta').value;
    const mes = document.getElementById('filtro-mes').value;
    let filtradas = transacoes;
    if (mes) {
        const [ano, mesNum] = mes.split('-').map(Number);
        filtradas = filtradas.filter(t => {
            const dt = new Date(t.data);
            return dt.getMonth() === mesNum - 1 && dt.getFullYear() === ano;
        });
    }
    if (tipo) filtradas = filtradas.filter(t => t.tipo === tipo);
    if (cat) filtradas = filtradas.filter(t => t.categoria === cat);
    if (conta) filtradas = filtradas.filter(t => t.conta === conta);
    filtradas.sort((a,b) => new Date(b.data) - new Date(a.data));
    const lista = document.getElementById('lista-extrato');
    let total = 0;
    if (filtradas.length === 0) {
        lista.innerHTML = '<p class="text-center text-slate-500 py-8">Nenhuma transação</p>';
    } else {
        lista.innerHTML = filtradas.map(t => {
            const cor = t.tipo === 'entrada'? 'text-emerald-500' : t.tipo === 'saida'? 'text-orange-500' : 'text-rose-500';
            const sinal = t.tipo === 'entrada'? '+' : '-';
            total += t.tipo === 'entrada'? t.valor : -t.valor;
            const dt = new Date(t.data);
            const dataStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
            return `
                <div class="bg-slate-800 light-mode:bg-slate-100 p-3 rounded-lg">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 cursor-pointer" onclick="editarDoExtrato(${t.id})">
                            <p class="font-bold text-sm text-white light-mode:text-slate-800">${t.descricao}</p>
                            <p class="text-xs text-slate-400">${dataStr} • ${t.categoria} • ${t.conta || 'Sem conta'}</p>
                        </div>
                        <div class="flex items-center gap-3 ml-2">
                            <p class="${cor} font-black">${sinal}R$ ${t.valor.toFixed(2).replace('.',',')}</p>
                            <button onclick="editarDoExtrato(${t.id})" class="text-blue-400 text-sm">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    document.getElementById('total-extrato').innerHTML = `Total: <span class="${total >= 0? 'text-emerald-500' : 'text-rose-500'}">R$ ${Math.abs(total).toFixed(2).replace('.',',')}</span>`;
}

function editarDoExtrato(id) {
    fecharExtrato();
    abrirModal(id);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    atualizarMes();
    aplicarVisualSaldoProjetado();
    atualizarCalculos();
});
