const form = document.getElementById('customer-registration-form');
const statusBox = document.getElementById('customer-status');
const dateOfBirthInput = document.getElementById('customer-date-of-birth');
const today = new Date();
dateOfBirthInput.max = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
].join('-');

form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const name = document.getElementById('customer-name').value.trim();
    const dateOfBirth = dateOfBirthInput.value;
    const mobile = document.getElementById('customer-mobile').value.trim();
    const email = document.getElementById('customer-email').value.trim().toLowerCase();
    const state = document.getElementById('customer-state').value;
    const password = document.getElementById('customer-password').value;
    const confirmPassword = document.getElementById('customer-confirm-password').value;

    if (new Date(`${dateOfBirth}T00:00:00`) > new Date()) {
        statusBox.textContent = 'Date of birth cannot be in the future.';
        statusBox.className = 'status-message error';
        return;
    }
    if (!/^\d{10}$/.test(mobile)) {
        statusBox.textContent = 'Mobile number must contain exactly 10 digits.';
        statusBox.className = 'status-message error';
        return;
    }
    if (password !== confirmPassword) {
        statusBox.textContent = 'Passwords do not match.';
        statusBox.className = 'status-message error';
        return;
    }

    let customers;
    try {
        customers = JSON.parse(localStorage.getItem('tribesCustomers') || '[]');
        if (!Array.isArray(customers)) throw new Error('Customer records have an invalid format.');
    } catch (error) {
        console.error('Could not read saved customer accounts.', error);
        statusBox.textContent = 'Accounts could not be loaded. Please reload and try again.';
        statusBox.className = 'status-message error';
        return;
    }

    if (customers.some(customer => customer.mobile === mobile)) {
        statusBox.textContent = 'An account already exists for this mobile number. Sign in instead.';
        statusBox.className = 'status-message error';
        return;
    }

    const customer = { name, dateOfBirth, mobile, email, state, password, createdAt: new Date().toISOString() };
    customers.push(customer);
    try {
        localStorage.setItem('tribesCustomers', JSON.stringify(customers));
        localStorage.setItem('tribesCurrentCustomer', JSON.stringify({ name, dateOfBirth, mobile, email, state }));
    } catch (error) {
        console.error('Could not save the customer account.', error);
        statusBox.textContent = 'Your account could not be saved in this browser. Check available storage and try again.';
        statusBox.className = 'status-message error';
        return;
    }

    window.location.href = 'customer-portal.html';
});
