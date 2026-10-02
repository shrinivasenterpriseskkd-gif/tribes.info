const form = document.getElementById('delivery-partner-login-form');
const statusBox = document.getElementById('status');
const resetForm = document.getElementById('password-reset-form');
const showResetButton = document.getElementById('show-reset');
const cancelResetButton = document.getElementById('cancel-reset');
const partnerIdInput = document.getElementById('delivery-partner-id');
const partnerIdPreview = document.getElementById('partner-id-preview');
const partnerIdPhoto = document.getElementById('partner-id-photo');

const readPartners = () => {
    const storedPartners = localStorage.getItem('tribesDeliveryPartners');
    if (!storedPartners) return [];

    const partners = JSON.parse(storedPartners);
    if (!Array.isArray(partners)) throw new Error('Saved Delivery Partner registrations have an invalid format.');
    return partners;
};

const normalizePartnerId = value => String(value || '').trim().toUpperCase();

partnerIdInput.addEventListener('input', () => {
    let partner;
    try {
        partner = readPartners().find(entry =>
            normalizePartnerId(entry.deliveryPartnerId) === normalizePartnerId(partnerIdInput.value)
        );
    } catch (error) {
        console.error('Could not load Delivery Partner registrations for the ID preview.', error);
        showStatus('Saved registrations could not be read. Please refresh or contact support.', 'error');
        partnerIdPreview.hidden = true;
        return;
    }

    partnerIdPreview.hidden = !partner;
    if (!partner) return;
    partnerIdPhoto.hidden = !partner.profilePhoto;
    partnerIdPhoto.src = partner.profilePhoto || '';
    document.getElementById('partner-id-initials').textContent = partner.profilePhoto
        ? ''
        : partner.fullName.split(/\s+/).map(name => name[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('partner-id-name').textContent = partner.fullName;
    document.getElementById('partner-id-label').textContent = partner.deliveryPartnerId;
});

const showStatus = (message, type) => {
    statusBox.textContent = message;
    statusBox.className = `status-message ${type}`;
};

document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? '🙈' : '👁';
        button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
});

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

    const deliveryPartnerId = normalizePartnerId(partnerIdInput.value);
    const password = document.getElementById('password').value.trim();
    let partners;
    try {
        partners = readPartners();
    } catch (error) {
        console.error('Could not load Delivery Partner registrations for sign in.', error);
        showStatus('Saved registrations could not be read. Please refresh or contact support.', 'error');
        return;
    }

    if (!partners.length) {
        showStatus('No Delivery Partner registrations were found in this browser. Sign in on the same browser and device used to register.', 'error');
        return;
    }

    const partner = partners.find(entry =>
        normalizePartnerId(entry.deliveryPartnerId) === deliveryPartnerId &&
        String(entry.password || '').trim() === password
    );

    if (!partner) {
        showStatus('Invalid Delivery Partner ID or password. Please try again.', 'error');
        return;
    }

    localStorage.setItem('tribesCurrentDeliveryPartner', JSON.stringify({
        deliveryPartnerId: partner.deliveryPartnerId,
        fullName: partner.fullName,
        phoneNo: partner.phoneNo,
        profilePhoto: partner.profilePhoto || '',
        createdAt: partner.createdAt
    }));
    showStatus('Sign in successful. Redirecting to your dashboard...', 'success');
    window.setTimeout(() => {
        window.location.href = 'delivery-partner-orders.html';
    }, 800);
});

resetForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!resetForm.checkValidity()) {
        resetForm.reportValidity();
        return;
    }

    const deliveryPartnerId = normalizePartnerId(document.getElementById('reset-delivery-partner-id').value);
    const email = document.getElementById('resetEmail').value.trim().toLowerCase();
    const newPassword = document.getElementById('resetPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;
    let partners;
    try {
        partners = readPartners();
    } catch (error) {
        console.error('Could not load Delivery Partner registrations for password reset.', error);
        showStatus('Saved registrations could not be read. Please refresh or contact support.', 'error');
        return;
    }
    const partnerIndex = partners.findIndex(partner =>
        normalizePartnerId(partner.deliveryPartnerId) === deliveryPartnerId &&
        String(partner.email || '').trim().toLowerCase() === email
    );

    if (partnerIndex === -1) {
        showStatus('Delivery Partner ID and registered email do not match.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showStatus('New passwords do not match.', 'error');
        return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
        showStatus('New password must include at least one special character.', 'error');
        return;
    }

    partners[partnerIndex].password = newPassword;
    localStorage.setItem('tribesDeliveryPartners', JSON.stringify(partners));
    resetForm.reset();
    resetForm.hidden = true;
    showResetButton.hidden = false;
    showStatus('Password reset successfully. You can now sign in.', 'success');
});
