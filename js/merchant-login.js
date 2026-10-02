const form = document.getElementById('merchant-login-form');
const statusBox = document.getElementById('status');
const resetForm = document.getElementById('password-reset-form');
const showResetButton = document.getElementById('show-reset');
const cancelResetButton = document.getElementById('cancel-reset');
const hasSpecialCharacter = value => /[^A-Za-z0-9]/.test(value);

const showStatus = (message, type) => {
    statusBox.textContent = message;
    statusBox.className = `status-message ${type}`;
};

const fileOriginStorageMessage = 'The pages are opened as separate file:// URLs, which may have separate storage. Start the site with npm start, then register and sign in using http://localhost:5500. Re-register there if the original account was created from a file:// page.';

const readMerchants = () => {
    const rawMerchants = localStorage.getItem('tribesMerchants');
    if (!rawMerchants) return [];

    const merchants = JSON.parse(rawMerchants);
    if (!Array.isArray(merchants)) {
        throw new Error('Saved merchant registrations are not in a valid format.');
    }
    return merchants;
};

const bindPasswordToggle = () => {
    document.querySelectorAll('.password-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            button.textContent = isPassword ? '🙈' : '👁';
            button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    });
};

bindPasswordToggle();

showResetButton.addEventListener('click', () => {
    resetForm.hidden = false;
    showResetButton.hidden = true;
    statusBox.textContent = '';
    statusBox.className = 'status-message';
});

cancelResetButton.addEventListener('click', () => {
    resetForm.reset();
    resetForm.hidden = true;
    showResetButton.hidden = false;
});

form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const merchantId = document.getElementById('merchantId').value.trim().toUpperCase();
    const password = document.getElementById('password').value;
    let merchants;
    try {
        merchants = readMerchants();
    } catch (error) {
        console.error('Could not read saved merchant registrations.', error);
        showStatus(window.location.protocol === 'file:' && error.name === 'SecurityError'
            ? fileOriginStorageMessage
            : 'Saved merchant registrations could not be read. Refresh this page or contact support.', 'error');
        return;
    }

    if (!merchants.length) {
        showStatus(window.location.protocol === 'file:'
            ? `No merchant registration is available to this page. ${fileOriginStorageMessage}`
            : 'No merchant registrations were found in this browser. Register using this same browser and site address first.',
        'error');
        return;
    }

    const merchant = merchants.find(entry =>
        String(entry?.merchantId || '').trim().toUpperCase() === merchantId &&
        String(entry?.password ?? '') === password
    );

    if (!merchant) {
        showStatus('Invalid merchant ID or password. Please try again.', 'error');
        return;
    }

    try {
        localStorage.setItem('tribesCurrentMerchant', JSON.stringify({
            merchantId: merchant.merchantId,
            fullName: merchant.fullName,
            phoneNo: merchant.phoneNo,
            createdAt: merchant.createdAt
        }));
    } catch (error) {
        console.error('Could not save the merchant sign-in session.', error);
        showStatus('Sign in succeeded, but this browser could not save the session. Enable browser storage and try again.', 'error');
        return;
    }

    showStatus('Sign in successful. Redirecting to your dashboard...', 'success');
    window.setTimeout(() => {
        window.location.href = 'merchant-portal.html';
    }, 800);
});

resetForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!resetForm.checkValidity()) {
        resetForm.reportValidity();
        return;
    }

    const resetMerchantId = document.getElementById('resetMerchantId').value.trim().toUpperCase();
    const resetEmail = document.getElementById('resetEmail').value.trim().toLowerCase();
    const resetPassword = document.getElementById('resetPassword').value;
    const resetConfirmPassword = document.getElementById('resetConfirmPassword').value;
    let merchants;
    try {
        merchants = readMerchants();
    } catch (error) {
        console.error('Could not read saved merchant registrations for password reset.', error);
        showStatus('Saved merchant registrations could not be read. Refresh this page or contact support.', 'error');
        return;
    }
    const merchantIndex = merchants.findIndex(merchant =>
        String(merchant?.merchantId || '').trim().toUpperCase() === resetMerchantId &&
        String(merchant?.email || '').trim().toLowerCase() === resetEmail
    );

    if (merchantIndex === -1) {
        showStatus('Merchant ID and registered email do not match.', 'error');
        return;
    }

    if (resetPassword !== resetConfirmPassword) {
        showStatus('New passwords do not match.', 'error');
        return;
    }

    if (!hasSpecialCharacter(resetPassword)) {
        showStatus('New password must include at least one special character.', 'error');
        return;
    }

    merchants[merchantIndex].password = resetPassword;
    localStorage.setItem('tribesMerchants', JSON.stringify(merchants));
    resetForm.reset();
    resetForm.hidden = true;
    showResetButton.hidden = false;
    showStatus('Password reset successfully. You can now sign in.', 'success');
});
