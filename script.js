const API_URL = "https://serviflex-production.up.railway.app/api/clientes";
const API_EMPRESAS_URL = "https://serviflex-production.up.railway.app/api/empresas";
const API_AGENDAMENTOS_URL = "https://serviflex-production.up.railway.app/api/agendamentos";

document.addEventListener("DOMContentLoaded", () => {
    inicializarTemaGlobal();
    const path = window.location.pathname;

    // Fluxo do Master Admin (SaaS Control)
    if (path.includes("master-admin.html")) {
        listarEmpresasMaster();
        document.getElementById("empresa-form").addEventListener("submit", salvarEmpresaMaster);
    }

    // Fluxo do CRM / Admin das Empresas
    if (path.includes("admin.html") || path.includes("clients.html") || path.includes("promotions.html")) {
        listarClientesAdmin();
        const f = document.getElementById("cliente-form"); if(f) f.addEventListener("submit", salvarClienteAdmin);
        const s = document.getElementById("search-input"); if(s) s.addEventListener("input", filtrarClientes);
    }

    // Fluxo da página de Agendamento do Cliente
    if (path.includes("appointments.html")) {
        carregarEmpresasSelect();
        listarAgendamentos();
        document.getElementById("agendamento-form").addEventListener("submit", salvarAgendamento);
    }
});

/* ================= EMPRESAS (MASTER GESTÃO) ================= */
async function listarEmpresasMaster() {
    try {
        const res = await fetch(API_EMPRESAS_URL);
        const data = await res.json();
        const tbody = document.getElementById("empresas-table-body");
        if(!tbody) return;
        tbody.innerHTML = "";
        data.forEach(e => {
            tbody.innerHTML += `<tr>
                <td>#00${e.id}</td>
                <td><strong>${e.nomeEmpresa}</strong></td>
                <td>${e.cnpj}</td>
                <td><span class="badge" style="background: #e0f2fe; color: #0369a1;">${e.plano}</span></td>
                <td><span style='color:#10b981; font-weight: 600;'><i class="fa-solid fa-circle-check"></i> Ativa no H2</span></td>
            </tr>`;
        });
    } catch (err) { console.error("Erro ao buscar empresas:", err); }
}

async function salvarEmpresaMaster(e) {
    e.preventDefault();
    const payload = { 
        nomeEmpresa: document.getElementById("nomeEmpresa").value, 
        cnpj: document.getElementById("cnpj").value, 
        plano: document.getElementById("plano").value 
    };
    await fetch(API_EMPRESAS_URL, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
    });
    document.getElementById("empresa-form").reset(); 
    listarEmpresasMaster();
}

async function carregarEmpresasSelect() {
    const select = document.getElementById("agendamento-empresa"); 
    if(!select) return;
    try {
        const res = await fetch(API_EMPRESAS_URL); 
        const data = await res.json(); 
        select.innerHTML = "";
        if(data.length === 0) {
            select.innerHTML = "<option value=''>Nenhuma empresa registrada</option>";
            return;
        }
        data.forEach(e => { 
            select.innerHTML += `<option value="${e.id}">${e.nomeEmpresa}</option>`; 
        });
    } catch(err) { console.error(err); }
}

/* ================= CLIENTES (CRM GESTÃO) ================= */
async function listarClientesAdmin() {
    try {
        const res = await fetch(API_URL); 
        const data = await res.json();
        const tbody = document.getElementById("clientes-table-body"); 
        if(!tbody) return; 
        tbody.innerHTML = "";
        
        data.forEach(c => {
            tbody.innerHTML += `<tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.telefone}</td>
                <td>${c.email}</td>
                <td><i class="fa-solid fa-bolt" style="color:#eab308"></i> ${c.points} XP</td>
                <td><span class="badge badge-${(c.nivelFidelidade || "bronze").toLowerCase()">${c.nivelFidelidade}</span></td>
                <td>${c.diasDesdeUltimaVisita} dias</td>
                <td class="action-buttons">
                    <button class="btn-ia-fid" onclick="dispararIA(${c.id}, 'fidelidade')"><i class="fa-solid fa-brain"></i> IA Fidelidade</button>
                    <button class="btn-ia-ret" onclick="dispararIA(${c.id}, 'inativo')"><i class="fa-solid fa-ghost"></i> IA Retenção</button>
                    <button class="btn-del" onclick="deletarCliente(${c.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });

        if(document.getElementById("total-clientes")) {
            document.getElementById("total-clientes").innerText = data.length;
            document.getElementById("clientes-gold").innerText = data.filter(c => c.nivelFidelidade === "GOLD").length;
            document.getElementById("faturamento-simulado").innerText = "R$ " + (data.reduce((s, c) => s + c.points, 0) * 5.50).toFixed(2);
        }
    } catch (err) { console.error("Erro ao listar clientes:", err); }
}

async function salvarClienteAdmin(e) {
    e.preventDefault();
    const payload = { 
        nome: document.getElementById("nome").value, 
        telefone: document.getElementById("telefone").value, 
        email: document.getElementById("email").value, 
        points: parseInt(document.getElementById("pontos").value) || 0, 
        diasDesdeUltimaVisita: parseInt(document.getElementById("dias").value) || 0 
    };
    
    await fetch(API_URL, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
    });
    document.getElementById("cliente-form").reset(); 
    listarClientesAdmin();
}

async function deletarCliente(id) { 
    if(confirm("Deseja realmente remover este cliente do banco de dados?")) { 
        await fetch(`${API_URL}/${id}`, { method: "DELETE" }); 
        listarClientesAdmin(); 
    } 
}

/* ================= FUNÇÃO DISPARAR IA ATUALIZADA ================= */
async function dispararIA(id, tipo) {
    try {
        // 1. Busca a mensagem gerada dinamicamente pelo endpoint cognitivo do Java
        const resMsg = await fetch(`${API_URL}/${id}/mensagem-ia?tipo=${tipo}`); 
        if (!resMsg.ok) throw new Error("A API Java retornou um erro ao processar a IA.");
        const txt = await resMsg.text();
        
        // 2. Busca a lista para obter o telefone real salvo do cliente
        const resC = await fetch(API_URL); 
        const clientes = await resC.json(); 
        const c = clientes.find(item => item.id === id);
        
        if (!c) { 
            alert("⚠️ Cliente não localizado no banco H2."); 
            return; 
        }
        
        // 3. Alerta de sucesso exibindo o poder do algoritmo no seu TCC
        alert(`🤖 Mensagem Cognitiva Criada pelo Java:\n\n"${txt}"`);
        
        // 4. Abre o WhatsApp com o texto já embutido de forma limpa
        window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(c.telefone)}&text=${encodeURIComponent(txt)}`, "_blank");
    } catch (err) { 
        console.error(err); 
        alert("⚠️ Erro crítico: Certifique-se de que o seu ClienteController possui o método mapeando a rota '/{id}/mensagem-ia' e que o Spring Boot está ativo!");
    }
}

/* ================= AGENDAMENTOS ================= */
async function listarAgendamentos() {
    try {
        const res = await fetch(API_AGENDAMENTOS_URL); 
        const data = await res.json();
        const tbody = document.getElementById("agendamentos-table-body"); 
        if(!tbody) return; 
        tbody.innerHTML = "";
        data.forEach(a => { 
            tbody.innerHTML += `<tr>
                <td><strong>${a.data}</strong></td>
                <td>${a.hora}</td>
                <td>${a.servico}</td>
                <td><span style="color:#10b981;"><i class="fa-solid fa-calendar-check"></i> Agendado</span></td>
            </tr>`; 
        });
    } catch(err) { console.error(err); }
}

async function salvarAgendamento(e) {
    e.preventDefault();
    const idEmpresa = document.getElementById("agendamento-empresa").value;
    if(!idEmpresa) { alert("Por favor, selecione uma empresa válida."); return; }

    const payload = { 
        data: document.getElementById("agendamento-data").value, 
        hora: document.getElementById("agendamento-hora").value, 
        servico: document.getElementById("agendamento-servico").value, 
        empresa: { id: parseInt(idEmpresa) } 
    };
    
    await fetch(API_AGENDAMENTOS_URL, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
    });
    
    document.getElementById("agendamento-form").reset(); 
    alert("📅 Perfeito! O seu horário foi reservado e guardado com sucesso!"); 
    listarAgendamentos();
}

function filtrarClientes() {
    const b = document.getElementById("search-input").value.toLowerCase();
    document.querySelectorAll("#clientes-table-body tr").forEach(r => {
        const nomeCelua = r.querySelector("td strong");
        if(nomeCelua) {
            r.style.display = nomeCelua.innerText.toLowerCase().includes(b) ? "" : "none";
        }
    });
}

function inicializarTemaGlobal() {
    const t = document.querySelector('.theme-switch input'); 
    if(t) {
        t.addEventListener('change', e => {
            document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
        });
    }
}
