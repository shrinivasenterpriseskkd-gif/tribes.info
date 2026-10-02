const form = document.getElementById('delivery-partner-form');
const statusBox = document.getElementById('status');
const donationInput = document.getElementById('donation');
const aadharInput = document.getElementById('aadharNumber');

aadharInput.addEventListener('input', () => {
    aadharInput.value = aadharInput.value.replace(/\D/g, '').slice(0, 12);
});

const showStatus = (message, type) => {
    statusBox.textContent = message;
    statusBox.className = `status-message ${type}`;
};

const generateDeliveryPartnerId = () => {
    const partners = JSON.parse(localStorage.getItem('tribesDeliveryPartners') || '[]');
    const existingIds = new Set(partners.map(partner => partner.deliveryPartnerId));
    let deliveryPartnerId;

    do {
        deliveryPartnerId = `Janjeevan.store-DP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    } while (existingIds.has(deliveryPartnerId));

    return deliveryPartnerId;
};

const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const specialChars = '!@#$%';
    const password = [specialChars[Math.floor(Math.random() * specialChars.length)]];

    while (password.length < 10) password.push(chars[Math.floor(Math.random() * chars.length)]);
    return password.sort(() => Math.random() - 0.5).join('');
};

const downloadCredentials = (deliveryPartnerId, password) => {
    const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [
        ['Delivery Partner ID', 'Password'],
        [deliveryPartnerId, password]
    ].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tribes-delivery-partner-credentials-${deliveryPartnerId}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
});

const createProfilePhoto = async file => {
    const source = await readFileAsDataUrl(file);
    const image = new Image();
    image.src = source;
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('The passport photo could not be opened.'));
    });

    const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
};

const imageFormat = dataUrl => dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

const downloadRegistrationPdf = async (registration, documents) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('PDF library failed to load. Please try again.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const lines = [
        ['Delivery Partner ID', registration.deliveryPartnerId],
        ['Password', registration.password],
        ['Full Name', registration.fullName],
        ['Phone Number', registration.phoneNo],
        ['Email Address', registration.email],
        ['Address', registration.address],
        ['State', registration.state],
        ['Language', registration.language],
        ['Aadhar Number', registration.aadharNumber],
        ['Relative Name', registration.relativeName],
        ['Relative Phone Number', registration.relativePhone],
        ['Relative Address', registration.relativeAddress],
        ['Registered On', new Date(registration.createdAt).toLocaleString('en-IN')]
    ];

    doc.setFillColor(232, 243, 232);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(27, 30, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Janjeevan.store Delivery Partner Registration', 14, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Registration completed successfully', 14, 31);

    let y = 48;
    doc.setFont('helvetica', 'bold');
    doc.text('Registration Details', 14, y);
    y += 10;
    doc.setFont('helvetica', 'normal');

    lines.forEach(([label, value]) => {
        const wrapped = doc.splitTextToSize(`${label}: ${value}`, 180);
        doc.text(wrapped, 14, y);
        y += wrapped.length * 7 + 3;
    });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Agreement', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    const agreement = doc.splitTextToSize(
        'The Delivery Partner agrees to handle delivery items safely, deliver them to the correct customer, report delivery issues promptly, and follow all Janjeevan.store policies.',
        180
    );
    doc.text(agreement, 14, y);

    doc.addPage();
    doc.setFillColor(232, 243, 232);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(27, 30, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Registration Documents', 14, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Passport photo: ${documents.passport.name}`, 14, 32);
    doc.addImage(documents.passport.dataUrl, imageFormat(documents.passport.dataUrl), 14, 38, 45, 55);
    doc.text(`Aadhar front: ${documents.aadharFront.name}`, 14, 108);
    doc.addImage(documents.aadharFront.dataUrl, imageFormat(documents.aadharFront.dataUrl), 14, 114, 180, 100);
    doc.addPage();
    doc.setFillColor(232, 243, 232);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(27, 30, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Aadhar Back Document', 14, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Aadhar back: ${documents.aadharBack.name}`, 14, 34);
    doc.addImage(documents.aadharBack.dataUrl, imageFormat(documents.aadharBack.dataUrl), 14, 42, 180, 100);

    doc.save(`Janjeevan.store-Delivery-Partner-Registration-${registration.deliveryPartnerId}.pdf`);
};

const collectRegistrationData = () => ({
    deliveryPartnerId: generateDeliveryPartnerId(),
    password: generatePassword(),
    fullName: document.getElementById('fullName').value.trim(),
    phoneNo: document.getElementById('phoneNo').value.trim(),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    state: document.getElementById('state').value,
    language: document.getElementById('language').value,
    aadharNumber: document.getElementById('aadharNumber').value.trim(),
    relativeName: document.getElementById('relativeName').value.trim(),
    relativePhone: document.getElementById('relativePhone').value.trim(),
    relativeAddress: document.getElementById('relativeAddress').value.trim()
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const registration = collectRegistrationData();
    if (!/^\d{10}$/.test(registration.phoneNo) || !/^\d{10}$/.test(registration.relativePhone)) {
        showStatus('Phone numbers must contain exactly 10 digits.', 'error');
        return;
    }

    if (!/^\d{12}$/.test(registration.aadharNumber)) {
        showStatus('Aadhar number must contain exactly 12 digits.', 'error');
        return;
    }

    let profilePhoto;
    try {
        profilePhoto = await createProfilePhoto(document.getElementById('passportPhoto').files[0]);
    } catch (error) {
        console.error('Could not prepare Delivery Partner profile photo.', error);
        showStatus('Registration could not save your photo. Please choose a valid passport photo and try again.', 'error');
        return;
    }

    const partners = JSON.parse(localStorage.getItem('tribesDeliveryPartners') || '[]');
    const registrationWithDate = {
        ...registration,
        profilePhoto,
        createdAt: new Date().toISOString()
    };
    partners.push(registrationWithDate);
    localStorage.setItem('tribesDeliveryPartners', JSON.stringify(partners));

    downloadCredentials(registration.deliveryPartnerId, registration.password);
    try {
        const [aadharFront, aadharBack, passport] = await Promise.all([
            readFileAsDataUrl(document.getElementById('aadharPhotoFront').files[0]),
            readFileAsDataUrl(document.getElementById('aadharPhotoBack').files[0]),
            readFileAsDataUrl(document.getElementById('passportPhoto').files[0])
        ]);
        await downloadRegistrationPdf(registrationWithDate, {
            aadharFront: { name: document.getElementById('aadharPhotoFront').files[0].name, dataUrl: aadharFront },
            aadharBack: { name: document.getElementById('aadharPhotoBack').files[0].name, dataUrl: aadharBack },
            passport: { name: document.getElementById('passportPhoto').files[0].name, dataUrl: passport }
        });
    } catch (error) {
        console.error('Delivery Partner registration PDF could not be generated.', error);
        form.reset();
        donationInput.checked = true;
        showStatus(
            `Registration was saved. Delivery Partner ID: ${registration.deliveryPartnerId} | Password: ${registration.password}. The PDF could not be generated; please check your connection and try again.`,
            'error'
        );
        return;
    }
    form.reset();
    donationInput.checked = true;
    showStatus(
        `Registration completed. Delivery Partner ID: ${registration.deliveryPartnerId} | Password: ${registration.password}. The credentials CSV and registration PDF were downloaded. Store them securely.`,
        'success'
    );
});
