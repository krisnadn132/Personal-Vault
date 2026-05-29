        document.addEventListener('DOMContentLoaded', () => {

            /* =========================================
            A. CORE ARCHITECTURE & STATE
            ========================================= */
            const U_HASH = "S3Jpc25h";
            const P_HASH = "S3Jpc25hITMy";

            const STORAGE_KEY = 'krisnaVaultEnterpriseV6'; 
            
            const DEFAULT_DATA = {
                transactions: [],
                categories: {
                    income: ['Salary', 'Bonus', 'Business', 'Investment', 'Other'],
                    expense: ['Food', 'Transport', 'Rent', 'Shopping', 'Investment', 'Savings', 'Family', 'Dating', 'Other']
                },
                coins: ['BTC', 'ETH', 'SOL', 'USDT', 'BNB'],
                cryptoTrades: [], budgets: {}, savings: [], wishlist: [], subscriptions: [] 
            };
// ==========================================
// B. LIVE CRYPTO API (COINGECKO)
// ==========================================
const CryptoAPI = {
    // 1. Kamus Penerjemah: Simbol -> ID CoinGecko
    coinMap: {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'USDT': 'tether',
        'BNB': 'binancecoin'
    },
    // Tempat menyimpan harga secara sementara
    pricesUSD: {}, 

    // 2. Fungsi untuk mengambil harga dari internet
    async fetchPrices() {
        try {
            // Gabungkan semua ID koin menjadi satu teks (bitcoin,ethereum,solana,tether,binancecoin)
            const ids = Object.values(this.coinMap).join(',');
            
            // Hubungi API CoinGecko (Ambil harga dalam USD)
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
            
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            // 3. Format ulang data agar mudah dipanggil menggunakan simbol (Contoh: CryptoAPI.pricesUSD['BTC'])
            for (const [symbol, id] of Object.entries(this.coinMap)) {
                if (data[id] && data[id].usd) {
                    this.pricesUSD[symbol] = data[id].usd;
                }
            }
            console.log("✅ Harga Kripto Live berhasil di-update!", this.pricesUSD);
            return true;
        } catch (err) {
            console.error("❌ Gagal mengambil harga kripto:", err);
            // Jika tidak ada internet, setel harga default agar web tidak error
            this.pricesUSD = { 'BTC': 0, 'ETH': 0, 'SOL': 0, 'USDT': 0, 'BNB': 0 };
            return false;
        }
    }
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let u = btoa(document.getElementById('login-username').value);
    let p = btoa(document.getElementById('login-password').value);
    
    if (u === U_HASH && p === P_HASH) {
        // Tampilkan teks loading di tombol login agar user tahu
        const btnLogin = e.target.querySelector('button[type="submit"]');
        let oldText = btnLogin.innerText;
        btnLogin.innerText = "Syncing from Cloud...";
        btnLogin.disabled = true;

        await AppState.init(); // Tunggu data selesai disinkronisasi
        
        // Sembunyikan layar login dan render UI aplikasi
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'flex';
        Render.initTimeMachine();
        Render.all();
        
        // Kembalikan tombol login seperti semula untuk dipakai jika logout
        btnLogin.innerText = oldText;
        btnLogin.disabled = false;
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
});

const AppState = {
    data: null,
    selectedMonth: new Date().toISOString().substring(0, 7), 
    
    // --- 1. Fungsi Ambil Kunci GitHub dari Penyimpanan Lokal Browser ---
    getGitHubConfig() {
        return {
            token: localStorage.getItem('vault_gh_token') || '',
            gistId: localStorage.getItem('vault_gh_gist_id') || ''
        };
    },

    // --- 2. Fungsi Ambil Data dari GitHub ---
    async loadFromGitHub() {
        const { token, gistId } = this.getGitHubConfig();
        if (!token || !gistId) return false;

        try {
            console.log("Mencoba sinkronisasi dari Cloud GitHub...");
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (!res.ok) throw new Error('Gagal menghubungi GitHub API');
            
            const gist = await res.json();
            const content = gist.files['vault_data.json'].content;
            
            if (content && content.trim() !== "") {
                this.data = JSON.parse(content);
                return true; // Berhasil load dari cloud
            }
        } catch (error) {
            console.error('GitHub Sync Error:', error);
            return false;
        }
        return false;
    },

    // --- 3. Fungsi Inisiasi (Dimodifikasi Menjadi Asinkronus) ---
    async init() {
        // Coba unduh data dari GitHub Cloud terlebih dahulu
        let cloudSuccess = await this.loadFromGitHub();
        
        // Jika belum ada konfigurasi cloud atau koneksi mati, gunakan data localStorage
        if (!cloudSuccess) {
            try { this.data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_DATA; } 
            catch { this.data = DEFAULT_DATA; }
        }
        
        // Validasi kelengkapan data bawaan
        if (!Array.isArray(this.data.transactions)) this.data.transactions = [];
        if (!Array.isArray(this.data.cryptoTrades)) this.data.cryptoTrades = [];
        if (!Array.isArray(this.data.savings)) this.data.savings = [];
        if (!Array.isArray(this.data.wishlist)) this.data.wishlist = [];
        if (!Array.isArray(this.data.subscriptions)) this.data.subscriptions = [];
        if (!this.data.budgets || typeof this.data.budgets !== 'object') this.data.budgets = {};
        
        if (!this.data.categories) this.data.categories = DEFAULT_DATA.categories;
        if (!Array.isArray(this.data.categories.income)) this.data.categories.income = DEFAULT_DATA.categories.income;
        if (!Array.isArray(this.data.categories.expense)) this.data.categories.expense = DEFAULT_DATA.categories.expense;
        if (!Array.isArray(this.data.coins)) this.data.coins = DEFAULT_DATA.coins;
    },
    
    // --- 4. Fungsi Simpan (Menyimpan secara lokal & Lempar ke Cloud) ---
// --- 4. Fungsi Simpan (Menyimpan secara lokal & Lempar ke Cloud) ---
    async save() { 
        // 1. Simpan ke Local Storage untuk keamanan offline
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); 
        
        // 2. Kirim update ke GitHub dan paksa browser menunggunya
        const { token, gistId } = this.getGitHubConfig();
        if (token && gistId) {
            try {
                const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: { 'vault_data.json': { content: JSON.stringify(this.data, null, 2) } }
                    })
                });
                if(res.ok) console.log('Sukses tersimpan ke GitHub Cloud!');
            } catch(err) {
                console.error('Gagal menyimpan ke GitHub:', err);
            }
        }
    }
};

            /* =========================================
               B. UTILITIES & MODAL ENGINE
               ========================================= */
            const Util = {
                escapeHTML: (str) => {
                    if(!str) return '';
                    let div = document.createElement('div'); div.appendChild(document.createTextNode(str));
                    return div.innerHTML;
                },
                idr: (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v).replace('Rp', 'Rp '),
                usd: (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v),
                coinQty: (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v),
                date: () => new Date().toISOString().split('T')[0],
                todayStr: () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                id: (p) => p + Date.now() + Math.floor(Math.random()*1000)
            };

            // Time Machine Logic Filter
            const Filter = {
                getMode: () => document.getElementById('filter-mode').value,
                getYear: () => document.getElementById('filter-year').value,
                getMonth: () => document.getElementById('filter-month').value,
                getStart: () => document.getElementById('filter-start').value,
                getEnd: () => document.getElementById('filter-end').value,
                
                isMatch: (dateStr) => {
                    if (Filter.getMode() === 'range') {
                        let s = Filter.getStart();
                        let e = Filter.getEnd();
                        if (!s && !e) return true; // Tampilkan semua jika tidak ada yang dipilih
                        if (s && e) return dateStr >= s && dateStr <= e;
                        if (s) return dateStr >= s;
                        if (e) return dateStr <= e;
                    } else {
                        let y = Filter.getYear(); let m = Filter.getMonth();
                        if (y === 'all') return true;
                        if (m === 'all') return dateStr.startsWith(y);
                        return dateStr.startsWith(`${y}-${m}`);
                    }
                },
                getEndDate: () => {
                    if (Filter.getMode() === 'range') {
                        let e = Filter.getEnd();
                        return e ? e : '9999-12-31';
                    }
                    let y = Filter.getYear(); let m = Filter.getMonth();
                    if (y === 'all') return '9999-12-31';
                    if (m === 'all') return `${y}-12-31`;
                    return `${y}-${m}-31`; 
                },
                getSummaryText: () => {
                    if (Filter.getMode() === 'range') {
                        let s = Filter.getStart();
                        let e = Filter.getEnd();
                        if (!s && !e) return "All Time (Range)";
                        if (s && e) return `${s} s/d ${e}`;
                        if (s) return `Mulai ${s}`;
                        if (e) return `Sampai ${e}`;
                    }
                    let y = Filter.getYear(); let m = Filter.getMonth();
                    if (y === 'all') return "All Time";
                    if (m === 'all') return `Year ${y}`;
                    let mName = document.querySelector(`#filter-month option[value="${m}"]`).innerText;
                    return `${mName} ${y}`;
                }
            };

            const isZero = (val) => Math.abs(val) < Number.EPSILON || val < 0.000001;

            const DOM = { views: document.querySelectorAll('.view-section'), navs: document.querySelectorAll('.nav-link'), toast: document.getElementById('toast-container') };

            const UI = {
                toast: (msg, type='success') => {
                    const t = document.createElement('div'); t.className = 'toast'; 
                    t.style.borderLeftColor = `var(--${type})`;
                    t.innerHTML = `<span class="material-icons-round" style="color:var(--${type}); font-size:24px;">${type==='success'?'check_circle':'error'}</span> <span style="font-weight:600; font-size:0.95rem;">${msg}</span>`;
                    DOM.toast.appendChild(t); setTimeout(() => t.remove(), 4000);
                },
                modal: {
                    container: document.getElementById('modal-container'),
                    title: document.getElementById('modal-title'),
                    body: document.getElementById('modal-body'),
                    actions: document.getElementById('modal-actions'),
                    show({ title, icon, bodyHTML, buttons }) {
                        this.title.innerHTML = `<span class="material-icons-round" style="color:var(--primary); font-size:30px;">${icon || 'info'}</span> ${title}`;
                        this.body.innerHTML = bodyHTML;
                        this.actions.innerHTML = '';
                        buttons.forEach(btn => {
                            const b = document.createElement('button');
                            b.className = `btn-modal ${btn.class || 'btn-primary'}`;
                            b.type = 'button';
                            b.innerText = btn.text;
                            b.onclick = () => { if(btn.onClick) btn.onClick(); this.close(); };
                            this.actions.appendChild(b);
                        });
                        this.container.classList.add('active');
                    },
                    close() { this.container.classList.remove('active'); }
                },
                bindFormatHelper: (inputId, helperId) => {
                    document.getElementById(inputId).addEventListener('input', (e) => {
                        let val = Number(e.target.value);
                        document.getElementById(helperId).innerText = (val && Number.isFinite(val) && val > 0) ? Util.idr(val) : '';
                    });
                }
            };

            UI.modal.container.addEventListener('click', (e) => { if(e.target === UI.modal.container) UI.modal.close(); });

            UI.bindFormatHelper('add-amount', 'helper-add-amount');
            UI.bindFormatHelper('bud-amount', 'helper-bud-amount');
            UI.bindFormatHelper('sub-price', 'helper-sub-price');
            UI.bindFormatHelper('sav-target', 'helper-sav-target');
            UI.bindFormatHelper('wish-price', 'helper-wish-price');

            /* =========================================
               C. CHART ENGINE
               ========================================= */
            const Charts = {
                inst: { dash: null, pie: null, detail: null },
                getColors() { return document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#475569'; },
                getGridColor() { return document.body.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; },
                init() {
                    Chart.defaults.color = this.getColors();
                    Chart.defaults.font.family = 'Inter';
                    this.renderDash();
                    this.renderPie();
                },
                renderDash() {
                    let ctx1 = document.getElementById('dashboardChart');
                    if(!ctx1 || ctx1.offsetParent === null) return; 

                    if(this.inst.dash) this.inst.dash.destroy();
                    let dMap = {};
                    let y = Filter.getYear(); let m = Filter.getMonth();
                    
                    let filteredTxs = AppState.data.transactions.filter(t => Filter.isMatch(t.date));
                    filteredTxs.forEach(t => {
                        let key;
                        if (Filter.getMode() === 'range') {
                            key = t.date; // Jika range, pisahkan batang diagram per hari persis
                        } else {
                            if (y === 'all') { key = t.date.substring(0, 4); } 
                            else if (m === 'all') { key = t.date.substring(5, 7); } 
                            else { key = t.date.substring(8, 10); } 
                        }
                        if(!dMap[key]) dMap[key] = { i:0, e:0 };
                        t.type === 'income' ? dMap[key].i += t.amount : dMap[key].e += t.amount;
                    });
                    
                    if(Object.keys(dMap).length > 0) {
                        let sortedKeys = Object.keys(dMap).sort((a,b) => parseInt(a) - parseInt(b));
                        let labels = sortedKeys.map(k => {
                            if(y === 'all') return k;
                            if(m === 'all') {
                                let dt = new Date(`${y}-${k}-01`);
                                return dt.toLocaleString('en-US', {month:'short'});
                            }
                            return `${k} ${new Date(y+'-'+m+'-01').toLocaleString('en-US', {month:'short'})}`;
                        });

                        let incData = sortedKeys.map(k => dMap[k].i);
                        let expData = sortedKeys.map(k => dMap[k].e);

                        this.inst.dash = new Chart(ctx1, {
                            type: 'bar',
                            data: { labels: labels, datasets: [{ label:'Income', data: incData, backgroundColor:'#10b981', borderRadius:6, hoverBackgroundColor: '#059669'}, { label:'Expense', data: expData, backgroundColor:'#ef4444', borderRadius:6, hoverBackgroundColor: '#dc2626'}] },
                            options: { 
                                responsive:true, maintainAspectRatio:false, interaction: { mode: 'index', intersect: false }, 
                                plugins: { 
                                    legend: { position: 'bottom' }, 
                                    tooltip: { 
                                        padding: 12, cornerRadius: 8,
                                        callbacks: {
                                            label: function(context) {
                                                let label = context.dataset.label || '';
                                                let val = context.raw || 0;
                                                let idx = context.dataIndex;
                                                let i = context.chart.data.datasets[0].data[idx];
                                                let e = context.chart.data.datasets[1].data[idx];
                                                let total = i + e;
                                                let pct = total > 0 ? ((val/total)*100).toFixed(1) : 0;
                                                return `${label}: Rp ${val.toLocaleString('id-ID')} (${pct}%)`;
                                            }
                                        }
                                    } 
                                }, 
                                scales: {y:{display:false, grid:{display:false}}, x:{grid:{display:false}}} 
                            }
                        });
                    }
                },
                renderPie() {
                    let ctxPie = document.getElementById('expensePieChart');
                    if(!ctxPie || ctxPie.offsetParent === null) return;

                    if(this.inst.pie) this.inst.pie.destroy();
                    let expMap = {};
                    let totalExp = 0;
                    AppState.data.transactions.forEach(t => { 
                        if(t.type === 'expense' && Filter.isMatch(t.date)) {
                            expMap[t.category] = (expMap[t.category] || 0) + t.amount; 
                            totalExp += t.amount;
                        }
                    });
                    
                    if(Object.keys(expMap).length > 0) {
                        let strokeColor = document.body.getAttribute('data-theme')==='dark' ? '#1e293b' : '#ffffff';
                        
                        let labels = Object.keys(expMap).map(k => {
                            let pct = totalExp > 0 ? ((expMap[k]/totalExp)*100).toFixed(1) : 0;
                            return `${k} (${pct}%)`;
                        });

                        this.inst.pie = new Chart(ctxPie, {
                            type: 'doughnut',
                            data: { labels: labels, datasets: [{ data: Object.values(expMap), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b'], borderWidth: 3, borderColor: strokeColor, hoverOffset: 8 }] },
                            options: { responsive:true, maintainAspectRatio:false, cutout: '65%', plugins: { legend: { position: 'right', labels:{boxWidth:12} }, tooltip: { padding: 12, callbacks: { label: function(c) { return `Rp ${c.raw.toLocaleString('id-ID')}`; } } } } }
                        });
                    }
                },
                renderDetail() {
                    let ctx2 = document.getElementById('analyticsDetailChart');
                    if(!ctx2 || ctx2.offsetParent === null) return;

                    if(this.inst.detail) this.inst.detail.destroy();
                    const cat = document.getElementById('ana-category').value;
                    if(!cat) return;

                    let dMap = {};
                    [...AppState.data.transactions].filter(t => t.category === cat && Filter.isMatch(t.date)).reverse().forEach(t => {
                        let key = (Filter.getMode() === 'range' || Filter.getYear() !== 'all') ? t.date : t.date.substring(0,7);
                        dMap[key] = (dMap[key] || 0) + t.amount;
                    });

                    let isInc = AppState.data.categories.income.includes(cat);
                    let color = isInc ? '#10b981' : '#f59e0b';

                    this.inst.detail = new Chart(ctx2, {
                        type: 'line',
                        data: { labels: Object.keys(dMap).length ? Object.keys(dMap) : ['No Data'], datasets: [{ label: cat, data: Object.values(dMap).length ? Object.values(dMap) : [0], borderColor: color, backgroundColor: color+'33', fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6 }] },
                        options: { responsive:true, maintainAspectRatio:false, interaction: { mode: 'index', intersect: false }, plugins:{legend:{display:false}, tooltip: { padding: 10 }}, scales:{y:{grid:{color: this.getGridColor()}}, x:{grid:{display:false}}} }
                    });
                }
            };

            /* =========================================
               TRANSACTION TYPE ↔ CATEGORY SYNC ENGINE 
               ========================================= */
            const txTypeSelect = document.getElementById('add-type');
            const txCategorySelect = document.getElementById('add-category');
            const txForm = document.getElementById('form-add-tx');

            function renderCategoryByType(type) {
                const categories = AppState.data.categories[type] || [];
                txCategorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
                txCategorySelect.selectedIndex = 0; 
            }

            txTypeSelect.addEventListener('change', () => {
                renderCategoryByType(txTypeSelect.value);
            });

            /* =========================================
               D. RENDER MODULES
               ========================================= */
            const Render = {
                initTimeMachine() {
                    let years = new Set();
                    let curY = new Date().getFullYear().toString();
                    years.add(curY);
                    AppState.data.transactions.forEach(t => years.add(t.date.substring(0,4)));
                    AppState.data.cryptoTrades.forEach(t => years.add(t.date.substring(0,4)));
                    
                    let sortedYears = Array.from(years).sort((a,b)=>b-a);
                    let ySelect = document.getElementById('filter-year');
                    ySelect.innerHTML = `<option value="all">All Time</option>` + sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
                    
                    ySelect.value = curY;
                    document.getElementById('filter-month').value = new Date().toISOString().substring(5,7);
                },

                all() {
                    // Update tanggal hari ini di bawah tulisan Dashboard Overview
                    const dateEl = document.getElementById('current-date');
                    if (dateEl) dateEl.innerText = Util.todayStr();

                    this.updateDropdowns();
                    this.fiatAndNetWorth(); 
                    this.crypto(); 
                    this.budget(); 
                    this.subscriptions(); 
                    this.savings(); 
                    this.analytics(); 
                    this.settings();
                    this.financialInsight(); 
                    Charts.init();
                },
                
                updateDropdowns() {
                    renderCategoryByType(txTypeSelect.value);
                    document.getElementById('bud-cat').innerHTML = AppState.data.categories.expense.map(c=>`<option value="${c}">${c}</option>`).join('');
                    document.getElementById('ana-category').innerHTML = [...AppState.data.categories.income, ...AppState.data.categories.expense].map(c=>`<option value="${c}">${c}</option>`).join('');
                    document.getElementById('cry-coin').innerHTML = AppState.data.coins.map(c=>`<option value="${c}">${c}</option>`).join('');
                },
                
                financialInsight() {
                    let i = 0, e = 0;
                    AppState.data.transactions.forEach(t => {
                        if(Filter.isMatch(t.date)) t.type === 'income' ? i+=t.amount : e+=t.amount;
                    });
                    
                    let msg = ""; let color = "var(--primary)"; let icon = "psychology";
                    if(i === 0 && e === 0) {
                        msg = "No transactions found for this period. Start logging your finances to get AI insights.";
                        color = "var(--text-muted)";
                    } else if(e > i) {
                        msg = `<strong>Deficit Alert!</strong> Your expenses (${Util.idr(e)}) have exceeded your income this period. Immediately cut back on unnecessary spending.`;
                        color = "var(--danger)"; icon = "warning";
                    } else {
                        let savingRate = ((i - e) / i * 100).toFixed(1);
                        if(savingRate >= 20) {
                            msg = `<strong>Excellent Health!</strong> You have maintained a <em>Savings Rate</em> of <strong>${savingRate}%</strong>. Keep up the great work!`;
                            color = "var(--success)"; icon = "verified";
                        } else {
                            msg = `<strong>Fair Condition.</strong> Your <em>Savings Rate</em> is <strong>${savingRate}%</strong>. Try to optimize expenses to save more than 20%.`;
                            color = "var(--warning)"; icon = "lightbulb";
                        }
                    }
                    
                    let banner = document.getElementById('financial-insight');
                    banner.style.borderLeftColor = color;
                    banner.querySelector('.icon-box').style.background = color;
                    banner.querySelector('.icon-box').innerHTML = `<span class="material-icons-round">${icon}</span>`;
                    document.getElementById('insight-message').innerHTML = msg;
                },

                fiatAndNetWorth() {
                    let i = 0, e = 0; let html = '';
                    let filteredTxs = AppState.data.transactions.filter(t => Filter.isMatch(t.date));
                    
                    filteredTxs.forEach(t => {
                        t.type === 'income' ? i+=t.amount : e+=t.amount;
                        html += `<tr><td>${t.date}</td><td><span class="badge ${t.type==='income'?'badge-income':'badge-expense'}">${t.type}</span></td><td><strong>${t.category}</strong></td><td>${t.note?Util.escapeHTML(t.note):'-'}</td><td class="${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'} ${Util.idr(t.amount)}</td><td><button type="button" data-act="del-tx" data-id="${t.id}" style="color:var(--danger); display:flex; align-items:center;" title="Delete"><span class="material-icons-round" style="font-size:22px;">delete</span></button></td></tr>`;
                    });
                    
                    document.getElementById('dash-income').innerText = Util.idr(i);
                    document.getElementById('dash-expense').innerText = Util.idr(e);
                    document.getElementById('tbody-fiat-history').innerHTML = html || '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No transaction data stored for this period.</td></tr>';
                    document.getElementById('summary-tx').innerText = `Viewing: ${Filter.getSummaryText()}`;

                    let cumulativeTxs = AppState.data.transactions.filter(t => t.date <= Filter.getEndDate());
                    let cI = 0, cE = 0;
                    cumulativeTxs.forEach(t => { t.type === 'income' ? cI+=t.amount : cE+=t.amount; });
                    let fiatBal = cI - cE;
                    
                    let balEl = document.getElementById('dash-balance');
                    balEl.innerText = Util.idr(fiatBal);
                    balEl.style.color = fiatBal < 0 ? 'var(--danger)' : 'var(--text-main)';

                    let usdToIdrRate = 15500;
                    let cryptoCapital = 0, cryptoPnl = 0;
                    let port = {}; 
                    
                    let chronoTrades = [...AppState.data.cryptoTrades]
                        .filter(t => t.date <= Filter.getEndDate())
                        .sort((a,b) => {
                            let da = new Date(a.date).getTime() || 0;
                            let db = new Date(b.date).getTime() || 0;
                            if(da === db) return (a.timestamp||0) - (b.timestamp||0);
                            return da - db;
                        });

                    chronoTrades.forEach(t => {
                        if(!port[t.coin]) port[t.coin] = { h:0, c:0, p:0 };
                        let p = port[t.coin];
                        if(t.type === 'buy') { 
                            p.h += t.amount; p.c += t.total; 
                        } else if (t.type === 'sell') { 
                            if(p.h > 0) { 
                                let avg = p.c / p.h; 
                                let costOfSold = t.amount * avg; 
                                
                                if(t.amount >= p.h - 0.00001) { 
                                    costOfSold = p.c; p.h = 0; p.c = 0;
                                } else {
                                    p.h -= t.amount; p.c -= costOfSold;
                                }
                                p.p += (t.total - costOfSold); 
                            } 
                        }
                    });
                    // ==========================================
                    // 🌟 KODINGAN BARU: HITUNG HARGA LIVE COINGECKO
                    // ==========================================
                    let totalLiveValueUSD = 0;
                    
                    for (let coin in port) {
                        let amountDiTangan = port[coin].h;
                        
                        if (amountDiTangan > 0) {
                            let hargaLive = CryptoAPI.pricesUSD[coin] || 0;

                            totalLiveValueUSD += (amountDiTangan * hargaLive);
                            //Untuk mencetak harga koin satu per satu ke tab Console
                            console.log(`${coin}: ${amountDiTangan} koin x $${hargaLive} = $${amountDiTangan * hargaLive}`);
                        }
                    }

                    // Tampilkan ke layar 
                    // (Ganti 'summary-crypto' dengan ID kotak total Kripto yang ada di HTML Anda)
                    const elTotal = document.getElementById('crypto-capital');
                    if(elTotal) {
                        elTotal.innerHTML = `Live Value: <strong>$ ${totalLiveValueUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>`;
                    }

                    Object.values(port).forEach(val => { cryptoCapital += val.c; cryptoPnl += val.p; });
                    
                    let netWorth = fiatBal + ((cryptoCapital + cryptoPnl) * usdToIdrRate);
                    let netEl = document.getElementById('dash-networth');
                    netEl.innerText = Util.idr(netWorth);
                    netEl.style.color = netWorth < 0 ? 'var(--danger)' : 'var(--text-main)';
                },

                budget() {
                    const actuals = {};
                    AppState.data.transactions.forEach(t => { 
                        if(t.type === 'expense' && Filter.isMatch(t.date)) {
                            actuals[t.category] = (actuals[t.category] || 0) + t.amount; 
                        }
                    });

                    let plansHtml = ''; let progHtml = '';
                    let totTarget = 0; let totActual = 0;

                    Object.keys(AppState.data.budgets).forEach(cat => {
                        let planAmt = AppState.data.budgets[cat]; let actAmt = actuals[cat] || 0;
                        totTarget += planAmt; totActual += actAmt;

                        let pct = Math.min((actAmt / planAmt) * 100, 100).toFixed(0);
                        let isOvr = actAmt > planAmt; let barColor = isOvr ? 'var(--danger)' : (pct > 80 ? 'var(--warning)' : 'var(--primary)');

                        plansHtml += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem; border-bottom:1px solid var(--border); padding-bottom:12px; padding-top:4px;"><span><strong>${cat}</strong></span> <div style="display:flex; align-items:center; gap:10px;">${Util.idr(planAmt)} <button type="button" data-act="del-bud" data-cat="${cat}" style="color:var(--danger); display:flex;"><span class="material-icons-round" style="font-size:20px;">cancel</span></button></div></div>`;
                        
                        progHtml += `<div>
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:8px;"><span>${cat}</span> <span style="color:${isOvr?'var(--danger)':'var(--text-main)'}">${Util.idr(actAmt)} / ${Util.idr(planAmt)} (${pct}%)</span></div>
                            <div class="prog-container"><div class="prog-bar" style="width:${pct}%; background:${barColor};"></div></div>
                        </div>`;
                    });

                    document.getElementById('list-budget-plans').innerHTML = plansHtml || '<p style="color:var(--text-muted); font-size: 0.9rem;">No active budget limits.</p>';
                    document.getElementById('budget-progress-container').innerHTML = progHtml || '<p style="color:var(--text-muted); font-size: 0.9rem;">Create a target limit to see progress.</p>';
                    document.getElementById('summary-budget').innerText = `Total Target: ${Util.idr(totTarget)} | Spent: ${Util.idr(totActual)}`;
                },

                subscriptions() {
                    let totalMonthly = 0;
                    let html = AppState.data.subscriptions.map(s => {
                        let monthlyCost = s.cycle === 'yearly' ? s.price / 12 : s.price;
                        if(s.active) totalMonthly += monthlyCost;
                        
                        return `<tr>
                            <td><strong>${Util.escapeHTML(s.name)}</strong></td>
                            <td>${Util.idr(s.price)}</td>
                            <td><span class="badge ${s.cycle==='yearly'?'badge-buy':'badge-expense'}">${s.cycle}</span></td>
                            <td style="font-weight:600; color:var(--text-main)">${Util.idr(monthlyCost)} / mo</td>
                            <td style="white-space:nowrap;">
                                ${s.active ? `<button type="button" data-act="pay-sub" data-id="${s.id}" class="badge badge-pay" style="margin-right:12px;" title="Record Expense Now"><span class="material-icons-round" style="font-size:12px; vertical-align:middle;">payment</span> PAY NOW</button>` : ''}
                                <button type="button" data-act="toggle-sub" data-id="${s.id}" class="badge ${s.active?'badge-active':'badge-inactive'}" style="margin-right:8px; width:70px;">${s.active?'ACTIVE':'PAUSED'}</button>
                                <button type="button" data-act="del-sub" data-id="${s.id}" style="color:var(--danger); vertical-align:middle;" title="Delete"><span class="material-icons-round" style="font-size:22px;">delete</span></button>
                            </td>
                        </tr>`;
                    }).join('');

                    let activeCount = AppState.data.subscriptions.filter(x=>x.active).length;
                    let pausedCount = AppState.data.subscriptions.length - activeCount;
                    
                    document.getElementById('tbody-subs').innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px;">No recurring bills recorded.</td></tr>';
                    document.getElementById('sub-monthly-cost').innerText = Util.idr(totalMonthly);
                    document.getElementById('summary-subs').innerText = `Active: ${activeCount} | Paused: ${pausedCount}`;
                },

                savings() {
                    let totTarget = 0; let totCurrent = 0;
                    let sHtml = AppState.data.savings.map(s => {
                        totTarget += s.target; totCurrent += s.current;
                        let pct = Math.min((s.current / s.target)*100, 100).toFixed(0);
                        return `<tr><td><strong style="font-size:1.05rem;">${Util.escapeHTML(s.name)}</strong><br><span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">${Util.idr(s.current)} / ${Util.idr(s.target)} (${pct}%)</span><div class="prog-container" style="margin-top:10px;"><div class="prog-bar" style="width:${pct}%; background:var(--success);"></div></div></td>
                        <td style="white-space:nowrap; vertical-align:middle;"><button type="button" data-act="add-sav" data-id="${s.id}" style="color:var(--primary); margin-right:10px; background:var(--primary-light); padding:10px; border-radius:8px;" title="Add Funds"><span class="material-icons-round" style="font-size:20px;">add</span></button> <button type="button" data-act="del-sav" data-id="${s.id}" style="color:var(--danger); padding:8px;" title="Delete"><span class="material-icons-round" style="font-size:22px;">delete</span></button></td></tr>`;
                    }).join('');
                    
                    document.getElementById('tbody-savings').innerHTML = sHtml || '<tr><td colspan="2" style="text-align:center; padding:30px;">No savings goals created.</td></tr>';
                    document.getElementById('summary-sav').innerText = `Total Saved: ${Util.idr(totCurrent)} / ${Util.idr(totTarget)}`;

                    let totWish = 0;
                    let wHtml = AppState.data.wishlist.map(w => {
                        let isBought = w.status === 'bought';
                        if(!isBought) totWish += w.price;
                        let linkHTML = w.link ? `<a href="${Util.escapeHTML(w.link)}" target="_blank" style="font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:4px;"><span class="material-icons-round" style="font-size:16px;">open_in_new</span> Open Link</a>` : '-';
                        
                        return `<tr><td><strong style="text-decoration:${isBought?'line-through':'none'}; font-size:1rem;">${Util.escapeHTML(w.name)}</strong><br><span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">${Util.idr(w.price)}</span></td>
                        <td>${linkHTML}</td>
                        <td style="white-space:nowrap;">
                            ${!isBought ? `<button type="button" data-act="buy-wish" data-id="${w.id}" class="badge badge-buy" style="border:none; margin-right:12px; cursor:pointer;">MARK BOUGHT</button>` : `<span class="badge" style="background:var(--border); color:var(--text-muted); margin-right:12px;">PURCHASED</span>`}
                            <button type="button" data-act="del-wish" data-id="${w.id}" style="color:var(--danger); vertical-align:middle;" title="Delete"><span class="material-icons-round" style="font-size:22px;">delete</span></button>
                        </td></tr>`;
                    }).join('');
                    document.getElementById('tbody-wishlist').innerHTML = wHtml || '<tr><td colspan="3" style="text-align:center; padding:30px;">Your wishlist is empty.</td></tr>';
                    document.getElementById('summary-wish').innerText = `Total Pending Cost: ${Util.idr(totWish)}`;
                },

                crypto() {
                    let port = {}; let tCost = 0; let gPnl = 0;
                    
                    let chronoTrades = [...AppState.data.cryptoTrades]
                        .filter(t => t.date <= Filter.getEndDate())
                        .sort((a,b) => {
                            let da = new Date(a.date).getTime() || 0;
                            let db = new Date(b.date).getTime() || 0;
                            if(da === db) return (a.timestamp||0) - (b.timestamp||0);
                            return da - db;
                        });

                    chronoTrades.forEach(t => {
                        if(!port[t.coin]) port[t.coin] = { h:0, c:0, p:0 };
                        let p = port[t.coin];
                        if(t.type === 'buy') { 
                            p.h += t.amount; p.c += t.total; 
                        } else if (t.type === 'sell') { 
                            if(p.h > 0) { 
                                let avg = p.c / p.h; 
                                let costOfSold = t.amount * avg; 
                                if(t.amount >= p.h - 0.00001) { 
                                    costOfSold = p.c; p.h = 0; p.c = 0;
                                } else {
                                    p.h -= t.amount; p.c -= costOfSold;
                                }
                                p.p += (t.total - costOfSold); 
                            } 
                        }
                    });

                    // 1. Render/Cetak Tabel Daftar Koin ke Layar
                    let pHtml = '';
                    Object.keys(port).forEach(coin => {
                        let p = port[coin]; gPnl += p.p;
                        if(p.h > 0 || !isZero(p.p)) {
                            let avg = p.h > 0 ? p.c / p.h : 0; 
                            tCost += p.c;
                            pHtml += `<tr><td><span class="badge" style="background:var(--border); color:var(--text-main); font-size:0.85rem;">${coin}</span></td><td><strong>${Util.coinQty(p.h)}</strong></td><td>${Util.usd(avg)}</td><td><strong>${Util.usd(p.c)}</strong></td><td style="color:${p.p>0?'var(--success)':(p.p<0?'var(--danger)':'var(--text-main)')}; font-weight:800;">${p.p>0?'+':''}${Util.usd(p.p)}</td></tr>`;
                        }
                    });

                    document.getElementById('tbody-crypto-portfolio').innerHTML = pHtml || '<tr><td colspan="5" style="text-align:center; padding:20px;">No active assets in portfolio for this period.</td></tr>';
                    document.getElementById('crypto-capital').innerText = Util.usd(tCost);

                    // 2. Kalkulasi Harga Live dari CoinGecko (Anti-Macet)
                    try {
                        let totalLiveValueUSD = 0;
                        for (let coin in port) {
                            let amountDiTangan = port[coin].h || 0; 
                            if (amountDiTangan > 0) {
                                let hargaLive = 0;
                                if (typeof CryptoAPI !== 'undefined' && CryptoAPI.pricesUSD) {
                                    hargaLive = CryptoAPI.pricesUSD[coin] || 0;
                                }
                                totalLiveValueUSD += (amountDiTangan * hargaLive);
                            }
                        }
                        const elTotal = document.getElementById('crypto-net-worth');
                        if (elTotal) {
                            elTotal.innerText = `$ ${totalLiveValueUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                        }
                    } catch (err) {
                        console.log("Kalkulasi Live Harga dilewati", err);
                    }
                },

                analytics() {
                    let tMap = {}; let inc = 0, exp = 0;
                    AppState.data.transactions.forEach(t => {
                        let m = t.date.substring(0,7); if(!tMap[m]) tMap[m] = 1;
                        if(Filter.isMatch(t.date)) {
                            t.type==='income' ? inc+=t.amount : exp+=t.amount;
                        }
                    });
                    
                    let moCount = Filter.getYear() !== 'all' && Filter.getMonth() !== 'all' ? 1 : (Object.keys(tMap).length || 1);
                    let displayInc = Filter.getMonth() !== 'all' ? inc : inc/moCount;
                    let displayExp = Filter.getMonth() !== 'all' ? exp : exp/moCount;
                    let titleLabel = Filter.getMonth() !== 'all' ? 'Total' : 'Avg';

                    document.getElementById('analytic-stats').innerHTML = `
                        <div class="stat-card" style="border-left:4px solid var(--success)"><div class="stat-icon" style="background:var(--success)"><span class="material-icons-round">arrow_downward</span></div><div class="stat-info"><h3 title="Income">${titleLabel} Income</h3><h2>${Util.idr(displayInc)}</h2></div></div>
                        <div class="stat-card" style="border-left:4px solid var(--danger)"><div class="stat-icon" style="background:var(--danger)"><span class="material-icons-round">arrow_upward</span></div><div class="stat-info"><h3 title="Expense">${titleLabel} Expense</h3><h2>${Util.idr(displayExp)}</h2></div></div>
                        <div class="stat-card" style="border-left:4px solid var(--info)"><div class="stat-icon" style="background:var(--info)"><span class="material-icons-round">calendar_today</span></div><div class="stat-info"><h3 title="Time Filter">Period</h3><h2>${Filter.getSummaryText()}</h2></div></div>
                        <div class="stat-card" style="border-left:4px solid var(--primary)"><div class="stat-icon" style="background:var(--primary)"><span class="material-icons-round">receipt_long</span></div><div class="stat-info"><h3 title="Total Record Transaksi">Transactions</h3><h2>${AppState.data.transactions.filter(t=>Filter.isMatch(t.date)).length} Trx</h2></div></div>
                    `;
                },

                settings() {
                    const rTag = (arr, id, mType, sType) => {
                        document.getElementById(id).innerHTML = arr.map((item, i) => 
                            `<div style="display:flex; align-items:center; gap:8px; background:var(--bg-body); border:1px solid var(--border); padding:6px 14px; border-radius:20px; font-size:0.85rem; font-weight:600;">${Util.escapeHTML(item)} <button type="button" data-act="del-setting" data-idx="${i}" data-m="${mType}" data-s="${sType||''}" style="color:var(--danger); display:flex;"><span class="material-icons-round" style="font-size:16px;">close</span></button></div>`
                        ).join('');
                    };
                    rTag(AppState.data.categories.expense, 'list-cat-expense', 'categories', 'expense');
                    rTag(AppState.data.categories.income, 'list-cat-income', 'categories', 'income');
                    rTag(AppState.data.coins, 'list-coins', 'coins', null);
                }
            };

            /* =========================================
               E. EVENT LISTENERS
               ========================================= */
            
            document.getElementById('btn-toggle-pwd').addEventListener('click', function() {
                let pwdInput = document.getElementById('login-password');
                let icon = this.querySelector('.material-icons-round');
                if(pwdInput.type === 'password') { pwdInput.type = 'text'; icon.textContent = 'visibility_off'; } 
                else { pwdInput.type = 'password'; icon.textContent = 'visibility'; }
            });

            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                let u = btoa(document.getElementById('login-username').value);
                let p = btoa(document.getElementById('login-password').value);
                
                if (u === U_HASH && p === P_HASH) {
                    // Tampilkan teks loading di tombol login agar user tahu
                    const btnLogin = e.target.querySelector('button[type="submit"]');
                    let oldText = btnLogin.innerText;
                    btnLogin.innerText = "Syncing from Cloud...";
                    btnLogin.disabled = true;

                    try {
                        // 1. Tunggu sinkronisasi data utama (Lokal / GitHub)
                        await AppState.init(); 
                        
                        // 2. Tarik harga kripto secara "diam-diam" di latar belakang (Tanpa await!)
                        if (typeof CryptoAPI !== 'undefined') {
                            CryptoAPI.fetchPrices().then(() => {
                                // Update/Refresh angka di layar secara otomatis jika harga sukses ditarik
                                if (typeof Render !== 'undefined') {
                                    Render.fiatAndNetWorth();
                                    if (typeof Render.crypto === 'function') Render.crypto();
                                }
                            }).catch(err => console.log("Abaikan error kripto", err));
                        }
                    } catch (error) {
                        console.error("Sistem memaksa masuk melewati error:", error);
                    } finally {
                        // 3. WAJIB BERJALAN: Sembunyikan layar login dan render UI aplikasi!
                        // Dengan cara ini, aplikasi PASTI terbuka meskipun internet sedang ngadat.
                        document.getElementById('login-screen').style.display = 'none';
                        document.getElementById('app-wrapper').style.display = 'flex';
                        Render.initTimeMachine();
                        Render.all();
                        
                        // Kembalikan tombol login seperti semula
                        btnLogin.innerText = oldText;
                        btnLogin.disabled = false;
                        document.getElementById('login-username').value = '';
                        document.getElementById('login-password').value = '';
                    }
                } else {
                    document.getElementById('login-error').style.display = 'block';
                }
            });

            document.getElementById('btn-logout').addEventListener('click', () => {
                UI.modal.show({ title: 'Lock Vault?', icon: 'lock', bodyHTML: 'Your session will end and the application will be locked.', buttons: [
                    {text: 'Cancel', class: 'btn-cancel'},
                    {text: 'Lock Now', class: 'btn-danger', onClick: () => { location.reload(); }}
                ]});
            });

            DOM.navs.forEach(l => l.addEventListener('click', e => {
                e.preventDefault(); 
                DOM.views.forEach(v=>v.classList.remove('active')); 
                DOM.navs.forEach(n=>n.classList.remove('active'));
                
                let target = e.currentTarget.dataset.target;
                document.getElementById(target).classList.add('active');
                e.currentTarget.classList.add('active'); 
                document.getElementById('page-title').innerText = e.currentTarget.dataset.title;
                
                if(target === 'view-analytics') { setTimeout(() => Charts.renderDetail(), 50); }
                if(target === 'view-dashboard') { setTimeout(() => { Charts.renderDash(); Charts.renderPie(); Render.financialInsight(); }, 50); }
            }));

            // TIME MACHINE LISTENER
            // TIME MACHINE LISTENER
            const triggerTimeMachine = () => {
                let mode = Filter.getMode();
                let monthSelect = document.getElementById('filter-month');
                let yearSelect = document.getElementById('filter-year');
                let rangeInputs = document.getElementById('filter-range-inputs');

                if (mode === 'range') {
                    yearSelect.style.display = 'none';
                    monthSelect.style.display = 'none';
                    rangeInputs.style.display = 'flex';
                } else {
                    yearSelect.style.display = 'inline-block';
                    monthSelect.style.display = 'inline-block';
                    rangeInputs.style.display = 'none';
                    
                    let y = Filter.getYear();
                    if(y === 'all') {
                        monthSelect.value = 'all';
                        monthSelect.disabled = true;
                        monthSelect.style.opacity = '0.5';
                    } else {
                        monthSelect.disabled = false;
                        monthSelect.style.opacity = '1';
                    }
                }
                
                let y = Filter.getYear(); let m = Filter.getMonth();
                AppState.selectedMonth = (mode === 'monthly' && y !== 'all' && m !== 'all') ? `${y}-${m}` : '0000-00';
                Render.all();
                UI.toast(`Viewing Data: ${Filter.getSummaryText()}`, 'success');
            };

document.getElementById('filter-mode').addEventListener('change', triggerTimeMachine);
document.getElementById('filter-year').addEventListener('change', triggerTimeMachine);
document.getElementById('filter-month').addEventListener('change', triggerTimeMachine);
document.getElementById('filter-start').addEventListener('change', triggerTimeMachine);
document.getElementById('filter-end').addEventListener('change', triggerTimeMachine);

            document.getElementById('filter-year').addEventListener('change', triggerTimeMachine);
            document.getElementById('filter-month').addEventListener('change', triggerTimeMachine);

            document.getElementById('btn-theme-toggle').addEventListener('click', () => {
                let isD = document.body.getAttribute('data-theme') === 'dark';
                document.body.setAttribute('data-theme', isD ? 'light' : 'dark');
                document.getElementById('theme-icon').innerText = isD ? 'dark_mode' : 'light_mode';
                Charts.init();
                Charts.renderDetail(); 
            });

            document.getElementById('ana-category').addEventListener('change', () => Charts.renderDetail());

            /* =========================================
               FORM SUBMITS WITH DEFENSIVE CHECKS
               ========================================= */
            
            document.getElementById('form-add-tx').addEventListener('submit', e => {
                e.preventDefault();
                let amt = Number(document.getElementById('add-amount').value);
                if (!Number.isFinite(amt) || amt <= 0) return UI.toast('Invalid amount', 'error');
                
                let type = document.getElementById('add-type').value;
                let category = document.getElementById('add-category').value;
                if (!AppState.data.categories[type].includes(category)) return UI.toast('Category mismatch!', 'error');

                let inputDate = document.getElementById('add-date').value;
                AppState.data.transactions.push({ id: Util.id('TX'), date: inputDate, timestamp: Date.now(), type: type, category: category, amount: amt, note: document.getElementById('add-note').value });
                
                AppState.data.transactions.sort((a, b) => {
                    let da = new Date(a.date).getTime() || 0;
                    let db = new Date(b.date).getTime() || 0;
                    if(db - da === 0) return (b.timestamp||0) - (a.timestamp||0);
                    return db - da;
                });

                AppState.save(); 
                e.target.reset(); 
                document.getElementById('add-date').value = inputDate; 
                document.getElementById('helper-add-amount').innerText = '';
                
                document.getElementById('add-type').value = 'expense';
                renderCategoryByType('expense');

                Render.initTimeMachine(); 
                Render.all(); 
                UI.toast('Transaction Saved');
            });

            document.getElementById('form-budget').addEventListener('submit', e => {
                e.preventDefault(); 
                let amt = Number(document.getElementById('bud-amount').value);
                if (!Number.isFinite(amt) || amt <= 0) return UI.toast('Invalid limit amount', 'error');

                AppState.data.budgets[document.getElementById('bud-cat').value] = amt;
                AppState.save(); e.target.reset(); document.getElementById('helper-bud-amount').innerText = ''; Render.budget(); UI.toast('Target Budget Updated');
            });

            document.getElementById('form-add-sub').addEventListener('submit', e => {
                e.preventDefault(); 
                let prc = Number(document.getElementById('sub-price').value);
                if (!Number.isFinite(prc) || prc <= 0) return UI.toast('Invalid bill amount', 'error');

                AppState.data.subscriptions.push({ id: Util.id('SUB'), name: document.getElementById('sub-name').value, price: prc, cycle: document.getElementById('sub-cycle').value, active: true });
                AppState.save(); e.target.reset(); document.getElementById('helper-sub-price').innerText = ''; Render.subscriptions(); UI.toast('Subscription Added');
            });

            document.getElementById('form-add-saving').addEventListener('submit', e => {
                e.preventDefault(); 
                let tgt = Number(document.getElementById('sav-target').value);
                if (!Number.isFinite(tgt) || tgt <= 0) return UI.toast('Invalid target amount', 'error');

                AppState.data.savings.push({ id: Util.id('SAV'), name: document.getElementById('sav-name').value, target: tgt, current: 0 });
                AppState.save(); e.target.reset(); document.getElementById('helper-sav-target').innerText = ''; Render.savings(); UI.toast('Savings Goal Created');
            });

            document.getElementById('form-add-wishlist').addEventListener('submit', e => {
                e.preventDefault(); 
                let prc = Number(document.getElementById('wish-price').value);
                if (!Number.isFinite(prc) || prc <= 0) return UI.toast('Invalid estimated price', 'error');

                let linkUrl = document.getElementById('wish-link').value;
                AppState.data.wishlist.push({ id: Util.id('WSH'), name: document.getElementById('wish-name').value, price: prc, link: linkUrl, status: 'pending' });
                AppState.save(); e.target.reset(); document.getElementById('helper-wish-price').innerText = ''; Render.savings(); UI.toast('Wishlist Item Added');
            });

            const calcCry = () => {
                let amt = Number(document.getElementById('cry-amount').value || 0);
                let prc = Number(document.getElementById('cry-price').value || 0);
                document.getElementById('cry-total-calc').innerText = (Number.isFinite(amt) && Number.isFinite(prc)) ? Util.usd(amt * prc) : '$ 0.00';
            };
            document.getElementById('cry-amount').addEventListener('input', calcCry);
            document.getElementById('cry-price').addEventListener('input', calcCry);

            document.getElementById('form-add-crypto').addEventListener('submit', e => {
                e.preventDefault();
                let amt = Number(document.getElementById('cry-amount').value); 
                let prc = Number(document.getElementById('cry-price').value);
                if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(prc) || prc <= 0) return UI.toast('Invalid amount/price', 'error');

                let inputDate = document.getElementById('cry-date').value;
                let type = document.getElementById('cry-type').value; let coin = document.getElementById('cry-coin').value;
                
                if(type === 'sell') {
                    let port = {}; AppState.data.cryptoTrades.forEach(t=>{ if(!port[t.coin])port[t.coin]=0; t.type==='buy'?port[t.coin]+=t.amount:port[t.coin]-=t.amount; });
                    if(amt > (port[coin]||0) + Number.EPSILON) {
                        return UI.modal.show({ title: 'Invalid Trade', icon: 'error', bodyHTML: `Insufficient Crypto Balance! You only have <strong>${Util.coinQty(port[coin]||0)} ${coin}</strong>.`, buttons: [{text:'Close', class:'btn-cancel'}]});
                    }
                }
                
                AppState.data.cryptoTrades.push({ id: Util.id('CRY'), date: inputDate, timestamp: Date.now(), type: type, coin: coin, amount: amt, price: prc, total: amt * prc });
                
                AppState.data.cryptoTrades.sort((a, b) => {
                    let da = new Date(a.date).getTime() || 0;
                    let db = new Date(b.date).getTime() || 0;
                    if(db - da === 0) return (b.timestamp||0) - (a.timestamp||0);
                    return db - da;
                });

                AppState.save(); e.target.reset(); document.getElementById('cry-date').value = inputDate; document.getElementById('cry-total-calc').innerText = '$ 0.00'; 
                Render.initTimeMachine();
                Render.crypto(); Render.fiatAndNetWorth(); UI.toast('Trade Execution Logged');
            });

            const bindSet = (fId, iId, mType, sType) => {
                document.getElementById(fId).addEventListener('submit', e => {
                    e.preventDefault(); let val = document.getElementById(iId).value.trim(); if(mType==='coins') val=val.toUpperCase();
                    if(!val) return; let tArr = sType ? AppState.data[mType][sType] : AppState.data[mType];
                    if(tArr.includes(val)) return UI.toast('Item already exists!', 'error');
                    tArr.push(val); document.getElementById(iId).value='';
                    AppState.save(); Render.settings(); Render.updateDropdowns(); UI.toast(`Item ${val} Added`);
                });
            };
            bindSet('form-setting-expense', 'new-cat-expense', 'categories', 'expense');
            bindSet('form-setting-income', 'new-cat-income', 'categories', 'income');
            bindSet('form-setting-coin', 'new-coin', 'coins', null);

            // --- Button Delegations ---
            document.body.addEventListener('click', e => {
                let btn = e.target.closest('button'); if(!btn || !btn.dataset.act) return;
                let act = btn.dataset.act, id = btn.dataset.id;

                if(act === 'del-tx') {
                    UI.modal.show({ title: 'Delete Transaction?', icon: 'warning', bodyHTML: 'Are you sure you want to delete this record? Your balance will automatically adjust.', buttons: [
                        {text: 'Cancel', class: 'btn-cancel'},
                        {text: 'Yes, Delete', class: 'btn-danger', onClick: () => { AppState.data.transactions = AppState.data.transactions.filter(t=>t.id!==id); AppState.save(); Render.all(); UI.toast('Transaction Deleted'); }}
                    ]});
                }
                
                if(act === 'del-cry') {
                    UI.modal.show({ title: 'Delete Trade?', icon: 'warning', bodyHTML: 'Are you sure you want to delete this crypto execution log? Portfolio Capital & PnL will be recalculated.', buttons: [
                        {text: 'Cancel', class: 'btn-cancel'},
                        {text: 'Yes, Delete', class: 'btn-danger', onClick: () => { AppState.data.cryptoTrades = AppState.data.cryptoTrades.filter(t=>t.id!==id); AppState.save(); Render.crypto(); Render.fiatAndNetWorth(); UI.toast('Trade Deleted'); }}
                    ]});
                }
                
                if(act === 'del-bud') { delete AppState.data.budgets[btn.dataset.cat]; AppState.save(); Render.budget(); }
                if(act === 'del-sav') { AppState.data.savings = AppState.data.savings.filter(s=>s.id!==id); AppState.save(); Render.savings(); }
                
                if(act === 'del-wish') { 
                    AppState.data.wishlist = AppState.data.wishlist.filter(w=>w.id!==id); 
                    AppState.save(); Render.all(); UI.toast('Wishlist Item Deleted'); 
                }

                if(act === 'del-sub') { AppState.data.subscriptions = AppState.data.subscriptions.filter(s=>s.id!==id); AppState.save(); Render.subscriptions(); }
                
                if(act === 'toggle-sub') {
                    let s = AppState.data.subscriptions.find(x=>x.id===id); s.active = !s.active;
                    AppState.save(); Render.subscriptions(); UI.toast(s.active ? 'Subscription Activated' : 'Subscription Paused');
                }

                if(act === 'pay-sub') {
                    let s = AppState.data.subscriptions.find(x=>x.id===id);
                    UI.modal.show({ title: 'Pay this Bill?', icon: 'payment', bodyHTML: `The system will auto-record an expense of <strong>${Util.idr(s.price)}</strong> into your Fiat Transactions for <strong>TODAY</strong>. Proceed?`, buttons: [
                        {text: 'Cancel', class: 'btn-cancel'},
                        {text: 'Pay Now', class: 'btn-primary', style: 'background: var(--purple)', onClick: () => {
                            let todayDate = Util.date();
                            AppState.data.transactions.push({ id: Util.id('TX'), date: todayDate, timestamp: Date.now(), type: 'expense', category: 'Utility', amount: s.price, note: `Auto-Pay Bill: ${s.name}` });
                            AppState.data.transactions.sort((a, b) => { let da = new Date(a.date).getTime()||0; let db = new Date(b.date).getTime()||0; if(db-da===0) return (b.timestamp||0)-(a.timestamp||0); return db-da; });
                            
                            let curMonth = todayDate.substring(0, 7);
                            document.getElementById('filter-year').value = curMonth.substring(0,4);
                            document.getElementById('filter-month').value = curMonth.substring(5,7);
                            document.getElementById('filter-month').disabled = false;
                            document.getElementById('filter-month').style.opacity = '1';
                            AppState.selectedMonth = curMonth;
                            
                            AppState.save(); Render.all(); UI.toast(`Paid successfully! Jumped to current month.`);
                        }}
                    ]});
                }

                if(act === 'del-setting') {
                    let { m, s, idx } = btn.dataset; let tArr = s ? AppState.data[m][s] : AppState.data[m];
                    if(tArr.length <= 1) return UI.toast('Warning: At least 1 item is required.', 'error');
                    
                    let deletedItem = tArr[idx];
                    tArr.splice(idx, 1); 
                    
                    if (m === 'categories' && s === 'expense' && AppState.data.budgets[deletedItem]) {
                        delete AppState.data.budgets[deletedItem];
                    }
                    
                    AppState.save(); Render.settings(); Render.updateDropdowns(); Render.budget();
                }

                if(act === 'add-sav') {
                    let s = AppState.data.savings.find(x=>x.id===id);
                    UI.modal.show({
                        title: `Add Funds: ${Util.escapeHTML(s.name)}`, icon: 'add_circle',
                        bodyHTML: `<p>Current Progress: ${Util.idr(s.current)} / ${Util.idr(s.target)}</p><br><div class="form-group"><input type="number" id="modal-sav-input" class="form-control" placeholder="Amount Added (IDR)" min="1"><span class="format-helper" id="helper-modal-sav" style="display:block; margin-top:4px;"></span></div>`,
                        buttons: [
                            {text: 'Cancel', class: 'btn-cancel'},
                            {text: 'Add Funds', class: 'btn-primary', onClick: () => {
                                let amt = Number(document.getElementById('modal-sav-input').value);
                                if (!Number.isFinite(amt) || amt <= 0) return UI.toast('Invalid Amount', 'error');
                                s.current += amt; AppState.save(); Render.savings(); UI.toast('Funds Added Successfully');
                            }}
                        ]
                    });
                    setTimeout(() => UI.bindFormatHelper('modal-sav-input', 'helper-modal-sav'), 100);
                }
                
                if(act === 'buy-wish') {
                    let w = AppState.data.wishlist.find(x=>x.id===id);
                    UI.modal.show({ title: 'Mark as Bought?', icon: 'shopping_bag', bodyHTML: `Did you purchase <strong>${Util.escapeHTML(w.name)}</strong> for ${Util.idr(w.price)}?<br><br><span style="font-size:0.85rem; color:var(--text-muted);">This will automatically log a "Shopping" expense for <strong>TODAY</strong>.</span>`, buttons: [
                        {text: 'Cancel', class: 'btn-cancel'},
                        {text: 'Confirm Purchase', class: 'btn-success', style:'background:var(--success);', onClick: () => {
                            w.status = 'bought';
                            let todayDate = Util.date();
                            AppState.data.transactions.push({ id: Util.id('TX'), date: todayDate, timestamp: Date.now(), type: 'expense', category: 'Shopping', amount: w.price, note: `Wishlist: ${w.name}` });
                            AppState.data.transactions.sort((a, b) => { let da = new Date(a.date).getTime()||0; let db = new Date(b.date).getTime()||0; if(db-da===0) return (b.timestamp||0)-(a.timestamp||0); return db-da; }); 
                            
                            let curMonth = todayDate.substring(0, 7);
                            document.getElementById('filter-year').value = curMonth.substring(0,4);
                            document.getElementById('filter-month').value = curMonth.substring(5,7);
                            document.getElementById('filter-month').disabled = false;
                            document.getElementById('filter-month').style.opacity = '1';
                            AppState.selectedMonth = curMonth;

                            AppState.save(); Render.all(); UI.toast(`Enjoy your new ${w.name}! Jumped to current month.`);
                        }}
                    ]});
                }
            });

            // Wipe Data
            document.getElementById('btn-reset-data').addEventListener('click', () => { 
                UI.modal.show({ 
                    title: 'WIPE ALL DATA', 
                    icon: 'warning', 
                    bodyHTML: '<p style="color:var(--danger); font-weight:bold;">WARNING!</p><p>Type "WIPE" below if you want to permanently format/delete the entire application data.</p><div class="form-group" style="margin-top:16px;"><input type="text" id="modal-wipe-input" class="form-control" placeholder="WIPE"></div>', 
                    buttons: [
                        { text: 'Cancel', class: 'btn-cancel' },
                        { 
                            text: 'Destroy Data', 
                            class: 'btn-danger', 
                            onClick: async () => {
                                // Ambil teks yang diketik pengguna
                                const confirmText = document.getElementById('modal-wipe-input').value;
                                
                                // Cek apakah pengguna mengetik WIPE dengan benar
                                if (confirmText === 'WIPE') {
                                    // 1. Timpa data saat ini dengan data bawaan yang kosong
                                    AppState.data = (typeof structuredClone === 'function') ? structuredClone(DEFAULT_DATA) : JSON.parse(JSON.stringify(DEFAULT_DATA));
                                    
                                    // 2. Simpan data kosong ini ke Lokal DAN timpa ke Cloud (GitHub)
                                    await AppState.save();
                                    
                                    // 3. Beri notifikasi dan refresh
                                    UI.toast('All data has been permanently wiped!', 'success');
                                    setTimeout(() => location.reload(), 1500);
                                } else {
                                    // Jika salah ketik, batalkan dan beri tahu
                                    UI.toast('Penghapusan dibatalkan. Anda harus mengetik WIPE dengan huruf besar.', 'error');
                                }
                            }
                        }
                    ]
                });
            });
            // Export CSV
            document.getElementById('btn-export-csv').addEventListener('click', () => {
                if(!AppState.data.transactions.length) return UI.toast('No transaction data to export', 'error');
                
                let csvContent = "Date,Type,Category,Amount,Note\n" + AppState.data.transactions.map(t => {
                    let safeNote = t.note ? t.note.replace(/"/g, '""').replace(/\n/g, ' ') : '';
                    return `${t.date},${t.type},${t.category},${t.amount},"${safeNote}"`;
                }).join("\n");
                
                let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                let url = URL.createObjectURL(blob);
                const l = document.createElement("a"); 
                l.href = url; 
                l.download = `KrisnaVault_Transactions_${Util.date()}.csv`; 
                document.body.appendChild(l); l.click(); l.remove();
                URL.revokeObjectURL(url);
                UI.toast('CSV Export Downloaded!', 'success');
            });

            // Export JSON
            document.getElementById('btn-export-json').addEventListener('click', () => {
                let dataStr = JSON.stringify(AppState.data, null, 2);
                let blob = new Blob([dataStr], {type: "application/json"});
                let url  = URL.createObjectURL(blob);
                const l = document.createElement("a"); l.href = url; l.download = `KrisnaVault_Backup_${Util.date()}.json`;
                document.body.appendChild(l); l.click(); l.remove();
                URL.revokeObjectURL(url);
                UI.toast('Full Backup Downloaded!', 'success');
            });

            document.getElementById('btn-trigger-import').addEventListener('click', () => {
                document.getElementById('file-import-json').click();
            });

            document.getElementById('file-import-json').addEventListener('change', (e) => {
                let file = e.target.files[0];
                if (!file) return;
                let reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        let importedData = JSON.parse(event.target.result);
                        if(importedData && importedData.transactions && importedData.categories) {
                            UI.modal.show({ title: 'Confirm Restore', icon: 'cloud_upload', bodyHTML: 'Are you sure you want to overwrite current data with the Backup file? This cannot be undone.', buttons: [
                                {text: 'Cancel', class: 'btn-cancel'},
                                {text: 'Start Restore', class: 'btn-primary', onClick: () => {
                                    AppState.data = (typeof structuredClone === 'function') ? structuredClone(importedData) : JSON.parse(JSON.stringify(importedData));
                                    AppState.save();
                                    UI.toast('Data Restored Successfully! Refreshing system...', 'success');
                                    setTimeout(() => location.reload(), 1500);
                                }}
                            ]});
                        } else { UI.toast('Invalid / Corrupted JSON File', 'error'); }
                    } catch (err) { UI.toast('Failed to read Backup file', 'error'); }
                };
                reader.readAsText(file);
                e.target.value = ''; 
            });
// ==========================================
// KODE UNTUK MENGAKTIFKAN PREVIEW RUPIAH (IDR)
// ==========================================
if (typeof UI !== 'undefined' && UI.bindFormatHelper) {
    UI.bindFormatHelper('add-amount', 'helper-add-amount');
    UI.bindFormatHelper('bud-amount', 'helper-bud-amount');
    UI.bindFormatHelper('sub-price', 'helper-sub-price');
    UI.bindFormatHelper('sav-target', 'helper-sav-target');
    UI.bindFormatHelper('wish-price', 'helper-wish-price');
    console.log("Fitur Preview Rupiah Berhasil Diaktifkan!");
}
// Tampilkan konfigurasi Token yang sedang aktif di menu Settings
document.getElementById('gh-token').value = localStorage.getItem('vault_gh_token') || '';
document.getElementById('gh-gist-id').value = localStorage.getItem('vault_gh_gist_id') || '';

// Menyimpan konfigurasi Token ke HP/Laptop Lokal
document.getElementById('btn-save-gh').addEventListener('click', async () => {
    const token = document.getElementById('gh-token').value.trim();
    const gistId = document.getElementById('gh-gist-id').value.trim();
    
    if(!token || !gistId) {
        UI.toast('Token dan Gist ID tidak boleh kosong!', 'error');
        return;
    }

    localStorage.setItem('vault_gh_token', token);
    localStorage.setItem('vault_gh_gist_id', gistId);
    
    UI.toast('Konfigurasi Cloud berhasil disimpan! Reloading...', 'success');
    
    // Paksa aplikasi melakukan sinkronisasi dengan konfigurasi baru
    await AppState.init();
    Render.all();
});
        });
