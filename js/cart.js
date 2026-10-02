import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { calculateDeliveryPartnerPayout, getCurrentLocation } from "./order-tracking.js";

const apiBase = (window.TRIBES_API_BASE_URL || "").replace(/\/$/, "");
const ids = JSON.parse(localStorage.getItem("tribesCart") || "[]");
const cart = document.querySelector("#cart");
const payButton = document.querySelector("#pay");
const status = document.querySelector("#status");
const deliveryState = document.querySelector("#delivery-state");
const shareLocationButton = document.querySelector("#share-customer-location");
const customerLocationStatus = document.querySelector("#customer-location-status");
const currentCustomer = JSON.parse(localStorage.getItem("tribesCurrentCustomer") || "null");
let products = [];
let customerLocation = null;

const money = value => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
}).format(value || 0);
const effectivePrice = product => Math.round((Number(product.price) || 0) * (1 - Math.min(100, Math.max(0, Number(product.discountPercent) || 0)) / 100) * 100) / 100;

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
}[char]));

const assignPartner = (area, orders) => {
    const partners = JSON.parse(localStorage.getItem("tribesDeliveryPartners") || "[]")
        .filter(partner => partner.state?.trim().toLowerCase() === area.trim().toLowerCase());
    if (!partners.length) return null;

    const pendingCounts = new Map(partners.map(partner => [
        partner.deliveryPartnerId,
        orders.filter(order => order.assignedPartnerId === partner.deliveryPartnerId && order.status !== "Delivered").length
    ]));
    return partners.sort((a, b) => pendingCounts.get(a.deliveryPartnerId) - pendingCounts.get(b.deliveryPartnerId))[0];
};

async function loadCart() {
    try {
        const snapshot = await getDocs(collection(db, "products"));
        const productMap = new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
        products = ids.map(id => productMap.get(id)).filter(Boolean);
        const total = products.reduce((sum, product) => sum + effectivePrice(product), 0);
        document.querySelector("#cart-count").textContent = `${products.length} item${products.length === 1 ? "" : "s"}`;
        document.querySelector("#cart-total").textContent = money(total);
        cart.innerHTML = products.length
            ? products.map(product => {const discount=Math.min(100,Math.max(0,Number(product.discountPercent)||0));return `<article class="cart-item"><div class="cart-image"><img src="${escapeHtml(product.imageUrl || "https://via.placeholder.com/200x200?text=Janjeevan.store")}" alt="${escapeHtml(product.name)}"></div><div><h2>${escapeHtml(product.name || "Product")}</h2><p>${escapeHtml(product.uom || "Unit")} · ${product.avlbStk ?? 0} available</p></div><strong>${money(effectivePrice(product))}${discount?`<small class="cart-original-price"><s>${money(product.price)}</s> · ${discount}% off</small>`:""}</strong></article>`}).join("")
            : "<div class=\"cart-empty\"><h2>Your cart is empty</h2><p>Explore the collection to find something you love.</p><a class=\"hero-button\" href=\"index.html\">Browse products <span>→</span></a></div>";
        payButton.disabled = !products.length;
    } catch (error) {
        const permissionDenied = error?.code === "permission-denied";
        cart.innerHTML = `<div class="cart-empty"><h2>Cart unavailable</h2><p>${permissionDenied ? "Firestore rules are blocking product reads. Publish the project rules, then reload this page." : "We could not load your products. Please try again."}</p></div>`;
        payButton.disabled = true;
        console.error(error);
    }
}

shareLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        customerLocationStatus.textContent = "This browser does not support location sharing.";
        return;
    }

    shareLocationButton.disabled = true;
    customerLocationStatus.textContent = "Waiting for location permission...";
    navigator.geolocation.getCurrentPosition(
        position => {
            customerLocation = getCurrentLocation(position);
            customerLocationStatus.textContent = `Delivery location saved (accuracy about ${customerLocation.accuracy} m).`;
            shareLocationButton.textContent = "Update delivery location";
            shareLocationButton.disabled = false;
        },
        error => {
            customerLocationStatus.textContent = error.code === error.PERMISSION_DENIED
                ? "Location permission was denied. Allow location access and try again."
                : "Could not get your location. Check device location settings and try again.";
            shareLocationButton.disabled = false;
            console.error("Could not capture the customer delivery location.", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
});

payButton.addEventListener("click", async () => {
    if (!products.length) return;
    if (!deliveryState.value) {
        deliveryState.reportValidity();
        return;
    }
    if (!customerLocation) {
        customerLocationStatus.textContent = "Share your delivery location before placing this order.";
        shareLocationButton.focus();
        return;
    }

    payButton.disabled = true;
    status.textContent = apiBase ? "Preparing secure checkout..." : "Payments need a deployed checkout server.";
    if (!apiBase) {
        payButton.disabled = false;
        return;
    }

    try {
        const amount = Math.round(products.reduce((sum, product) => sum + effectivePrice(product), 0) * 100);
        const response = await fetch(`${apiBase}/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount,
                items: products.map(product => ({ id: product.id, quantity: 1 })),
                deliveryState: deliveryState.value
            })
        });
        const order = await response.json();
        if (!response.ok) throw new Error(order.error || "Could not create order");

        const checkout = new Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: "Janjeevan.store",
            description: "Janjeevan.store order",
            order_id: order.orderId,
            prefill: { name: currentCustomer?.name || "", contact: currentCustomer?.mobile || "" },
            theme: { color: "#ef6b3f" },
            handler: async payment => {
                try {
                    status.textContent = "Verifying payment...";
                    const verification = await fetch(`${apiBase}/api/payments/verify`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payment)
                    });
                    if (!verification.ok) throw new Error("Payment verification failed");

                    const savedOrders = JSON.parse(localStorage.getItem("tribesOrders") || "[]");
                    const partner = assignPartner(deliveryState.value, savedOrders);
                    const orderRecord = {
                        orderId: order.orderId,
                        paymentId: payment.razorpay_payment_id,
                        customerName: currentCustomer?.name || "",
                        customerMobile: currentCustomer?.mobile || "",
                        items: products.map(product => ({
                            name: product.name,
                            quantity: 1,
                            price: effectivePrice(product),
                            listPrice: product.price || 0,
                            discountPercent: Number(product.discountPercent) || 0
                        })),
                        amount: order.amount / 100,
                        deliveryState: deliveryState.value,
                        customerLocation,
                        merchantLocations: products.filter(product =>
                            Number.isFinite(Number(product.latitude))
                            && Number.isFinite(Number(product.longitude))
                            && Number(product.latitude) !== 0
                            && Number(product.longitude) !== 0
                        ).map(product => ({
                            label: product.village || product.area || "Merchant pickup area",
                            latitude: Number(product.latitude),
                            longitude: Number(product.longitude)
                        })),
                        assignedPartnerId: partner?.deliveryPartnerId || null,
                        status: partner ? "Awaiting pickup" : "Unassigned",
                        createdAt: new Date().toISOString()
                    };
                    orderRecord.deliveryPartnerPayout = partner
                        ? calculateDeliveryPartnerPayout(orderRecord)
                        : null;
                    savedOrders.push(orderRecord);
                    localStorage.setItem("tribesOrders", JSON.stringify(savedOrders));
                    localStorage.removeItem("tribesCart");
                    status.textContent = partner
                        ? "Payment successful. Your order was assigned to a Delivery Partner."
                        : "Payment successful. No Delivery Partner is registered in this state yet; your order needs assignment.";
                    payButton.textContent = "Order complete";
                } catch (error) {
                    console.error("Could not finalize the paid order.", error);
                    status.textContent = `Payment was successful, but the order could not be saved: ${error.message}`;
                    payButton.disabled = false;
                }
            }
        });

        checkout.on("payment.failed", failure => {
            status.textContent = failure.error?.description || "Payment failed. Please try again.";
            payButton.disabled = false;
        });
        checkout.open();
    } catch (error) {
        status.textContent = error.message;
        payButton.disabled = false;
    }
});

loadCart();
