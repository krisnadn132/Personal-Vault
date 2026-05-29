/* =========================================
   PERSONAL VAULT
   MAIN APPLICATION ENGINE
   ========================================= */


/* =========================================
   GLOBAL APPLICATION STATE
   ========================================= */

const AppState = {

    authenticated: false,

    currentView: 'dashboard',

    currentTheme: 'dark',

    transactions: [],

    subscriptions: [],

    savingsGoals: [],

    wishlist: [],

    budgets: [],

    cryptoAssets: [],

    charts: {}

};


/* =========================================
   UTILITIES
   ========================================= */

const Util = {

    formatCurrency(value) {

        return new Intl.NumberFormat(
            'id-ID',
            {
                style: 'currency',
                currency: 'IDR'
            }
        ).format(value);

    },

    formatDate(date) {

        return new Date(date)
            .toLocaleDateString('id-ID');

    },

    generateId() {

        return crypto.randomUUID();

    }

};


/* =========================================
   LOCAL STORAGE ENGINE
   ========================================= */

function saveApplicationData() {

    localStorage.setItem(
        'personal_vault_data',
        JSON.stringify(AppState)
    );

}


function loadApplicationData() {

    const savedData =
        localStorage.getItem(
            'personal_vault_data'
        );

    if (!savedData) return;

    try {

        const parsed =
            JSON.parse(savedData);

        Object.assign(
            AppState,
            parsed
        );

    } catch (error) {

        console.error(
            'Failed to load storage:',
            error
        );

    }

}


/* =========================================
   AUTHENTICATION ENGINE
   ========================================= */

function initializeAuth() {

    bindLoginForm();

    bindLogoutButton();

    bindPasswordToggle();

}


function bindLoginForm() {

    const form =
        document.getElementById(
            'loginForm'
        );

    if (!form) return;

    form.addEventListener(
        'submit',
        authenticateUser
    );

}


function authenticateUser(event) {

    event.preventDefault();

    const username =
        document.getElementById(
            'login-username'
        ).value.trim();

    const password =
        document.getElementById(
            'login-password'
        ).value.trim();

    if (
        username === 'admin' &&
        password === 'admin'
    ) {

        AppState.authenticated = true;

        hideLoginError();

        showApplication();

        showToast(
            'Authentication Success'
        );

        return;

    }

    showLoginError();

}


function showApplication() {

    const loginScreen =
        document.getElementById(
            'login-screen'
        );

    const appWrapper =
        document.getElementById(
            'app-wrapper'
        );

    if (loginScreen) {

        loginScreen.style.display =
            'none';

    }

    if (appWrapper) {

        appWrapper.style.display =
            'flex';

    }

}


function showLoginError() {

    const error =
        document.getElementById(
            'login-error'
        );

    if (!error) return;

    error.style.display = 'block';

}


function hideLoginError() {

    const error =
        document.getElementById(
            'login-error'
        );

    if (!error) return;

    error.style.display = 'none';

}


function bindLogoutButton() {

    const button =
        document.getElementById(
            'btn-logout'
        );

    if (!button) return;

    button.addEventListener(
        'click',
        logout
    );

}


function logout() {

    AppState.authenticated = false;

    location.reload();

}


function bindPasswordToggle() {

    const button =
        document.getElementById(
            'btn-toggle-pwd'
        );

    const input =
        document.getElementById(
            'login-password'
        );

    if (!button || !input) return;

    button.addEventListener(
        'click',
        () => {

            const icon =
                button.querySelector(
                    '.material-icons-round'
                );

            if (
                input.type === 'password'
            ) {

                input.type = 'text';

                if (icon) {

                    icon.textContent =
                        'visibility_off';

                }

            } else {

                input.type = 'password';

                if (icon) {

                    icon.textContent =
                        'visibility';

                }

            }

        }
    );

}


/* =========================================
   TOAST ENGINE
   ========================================= */

function showToast(message) {

    console.log(message);

}


/* =========================================
   THEME ENGINE
   ========================================= */

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            'theme'
        );

    if (!savedTheme) return;

    document.body.setAttribute(
        'data-theme',
        savedTheme
    );

}


function bindThemeToggle() {

    const button =
        document.getElementById(
            'btn-theme-toggle'
        );

    if (!button) return;

    button.addEventListener(
        'click',
        toggleTheme
    );

}


function toggleTheme() {

    const currentTheme =
        document.body.getAttribute(
            'data-theme'
        );

    const nextTheme =
        currentTheme === 'dark'
            ? 'light'
            : 'dark';

    document.body.setAttribute(
        'data-theme',
        nextTheme
    );

    localStorage.setItem(
        'theme',
        nextTheme
    );

}


/* =========================================
   NAVIGATION ENGINE
   ========================================= */

function bindNavigationEvents() {

    const navLinks =
        document.querySelectorAll(
            '.nav-link'
        );

    navLinks.forEach(link => {

        link.addEventListener(
            'click',
            (event) => {

                event.preventDefault();

                const target =
                    link.dataset.target;

                switchView(target);

            }
        );

    });

}


function switchView(viewId) {

    document
        .querySelectorAll('.view-section')
        .forEach(section => {

            section.classList.remove(
                'active-view'
            );

        });

    const target =
        document.getElementById(viewId);

    if (target) {

        target.classList.add(
            'active-view'
        );

    }

}


/* =========================================
   DASHBOARD ENGINE
   ========================================= */

function initializeDashboard() {

    renderDashboard();

    initializeCharts();

}


function renderDashboard() {

    updateDashboardStats();

}


function updateDashboardStats() {

    const totalBalance =
        document.getElementById(
            'total-balance'
        );

    const totalIncome =
        document.getElementById(
            'total-income'
        );

    const totalExpense =
        document.getElementById(
            'total-expense'
        );

    if (totalBalance) {

        totalBalance.innerText =
            Util.formatCurrency(0);

    }

    if (totalIncome) {

        totalIncome.innerText =
            Util.formatCurrency(0);

    }

    if (totalExpense) {

        totalExpense.innerText =
            Util.formatCurrency(0);

    }

}


/* =========================================
   CHART ENGINE
   ========================================= */

function initializeCharts() {

    initializeExpenseChart();

    initializeTrendChart();

}


function initializeExpenseChart() {

    const canvas =
        document.getElementById(
            'expense-chart'
        );

    if (!canvas) return;

    AppState.charts.expense =
        new Chart(canvas, {

            type: 'doughnut',

            data: {

                labels: [
                    'Food',
                    'Transport',
                    'Bills'
                ],

                datasets: [
                    {
                        data: [40, 30, 30]
                    }
                ]

            }

        });

}


function initializeTrendChart() {

    const canvas =
        document.getElementById(
            'trend-chart'
        );

    if (!canvas) return;

    AppState.charts.trend =
        new Chart(canvas, {

            type: 'line',

            data: {

                labels: [
                    'Jan',
                    'Feb',
                    'Mar'
                ],

                datasets: [
                    {
                        label: 'Trend',
                        data: [10, 20, 15]
                    }
                ]

            }

        });

}


/* =========================================
   CURRENT DATE
   ========================================= */

function updateCurrentDate() {

    const element =
        document.getElementById(
            'current-date'
        );

    if (!element) return;

    element.innerText =
        new Date().toLocaleDateString(
            'id-ID',
            {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        );

}


/* =========================================
   APPLICATION INITIALIZER
   ========================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        console.log(
            'Initializing Personal Vault'
        );

        loadApplicationData();

        initializeTheme();

        initializeAuth();

        bindThemeToggle();

        bindNavigationEvents();

        initializeDashboard();

        updateCurrentDate();

    }
);
