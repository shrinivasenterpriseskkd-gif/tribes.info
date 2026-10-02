const form = document.getElementById('customer-login-form');
const statusBox = document.getElementById('customer-status');

form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const mobile = document.getElementById('customer-mobile').value.trim();
    const password = document.getElementById('customer-password').value;
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

    const customer = customers.find(entry => entry.mobile === mobile && entry.password === password);
    if (!customer) {
        statusBox.textContent = 'Mobile number or password is incorrect.';
        statusBox.className = 'status-message error';
        return;
    }

    localStorage.setItem('tribesCurrentCustomer', JSON.stringify({
        name: customer.name,
        dateOfBirth: customer.dateOfBirth,
        mobile: customer.mobile,
        email: customer.email || '',
        state: customer.state || ''
    }));
    window.location.href = 'customer-portal.html';
});
