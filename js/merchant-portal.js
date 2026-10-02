import {
    addDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
    getDownloadURL,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";

const merchantList = document.querySelector("#merchant-product-list");
const catalogStatus = document.querySelector("#merchant-catalog-status");
const productForm = document.querySelector("#merchant-product-form");
const imageInput = document.querySelector("#merchant-product-image");
const imagePreview = document.querySelector("#merchant-product-preview");
const submitButton = document.querySelector("#merchant-product-submit");
const signOutButton = document.querySelector("#merchant-sign-out");
const shopPhotoForm = document.querySelector("#merchant-shop-photo-form");
const shopPhotoInput = document.querySelector("#merchant-shop-photo-input");
const shopPhotoImage = document.querySelector("#merchant-shop-photo");
const shopPhotoEmpty = document.querySelector("#merchant-shop-photo-empty");
const shopPhotoStatus = document.querySelector("#merchant-shop-photo-status");
const shopPhotoSaveButton = document.querySelector("#merchant-shop-photo-save");
const gstinForm = document.querySelector("#merchant-gstin-form");
const gstinInput = document.querySelector("#merchant-gstin-input");
const gstinStatus = document.querySelector("#merchant-gstin-status");
const gstinSaveButton = document.querySelector("#merchant-gstin-save");
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
}[character]));
const money = value => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
}).format(Number(value) || 0);
const formatPercent = value => Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
});
const effectivePrice = (price, discount) =>
    Math.round((Number(price) || 0) * (1 - Math.min(100, Math.max(0, Number(discount) || 0)) / 100) * 100) / 100;

let currentMerchant;
let merchantAccount;
let merchantProducts = [];
let shopPhotoPreviewUrl;

try {
    currentMerchant = JSON.parse(localStorage.getItem("tribesCurrentMerchant") || "null");
} catch (error) {
    console.error("Could not read the signed-in merchant session.", error);
}

if (!currentMerchant?.merchantId) {
    window.location.replace("merchant-login.html");
} else {
    document.querySelector("#merchant-welcome-name").textContent = currentMerchant.fullName || "Merchant";
    try {
        const merchants = JSON.parse(localStorage.getItem("tribesMerchants") || "[]");
        if (!Array.isArray(merchants)) throw new Error("Saved merchant registrations are not in a valid list format.");
        merchantAccount = merchants.find(merchant =>
            String(merchant?.merchantId || "").trim().toUpperCase() === String(currentMerchant.merchantId).trim().toUpperCase()
        );
        document.querySelector("#merchant-gstin").textContent = merchantAccount?.gstNumber || "Not provided";
        document.querySelector("#merchant-proprietor-name").textContent =
            merchantAccount?.fullName || currentMerchant.fullName || "Merchant";
        document.querySelector("#merchant-phone").textContent =
            merchantAccount?.phoneNo || currentMerchant.phoneNo || "Not provided";
        gstinInput.value = merchantAccount?.gstNumber || "";
        if (merchantAccount?.shopPhotoDataUrl) {
            shopPhotoImage.src = merchantAccount.shopPhotoDataUrl;
            shopPhotoImage.hidden = false;
            shopPhotoEmpty.hidden = true;
        }
    } catch (error) {
        console.error("Could not load the merchant profile.", error);
        shopPhotoStatus.textContent = "Merchant profile could not be read from this browser.";
    }
}

const showStatus = (message, type = "") => {
    catalogStatus.textContent = message;
    catalogStatus.className = `merchant-portal-status ${type}`.trim();
};

const renderProducts = () => {
    if (!merchantProducts.length) {
        merchantList.innerHTML = '<p class="merchant-product-empty">No products in your catalog yet. Add your first product below.</p>';
        return;
    }

    merchantList.innerHTML = merchantProducts.map(({ product }) => {
        const discount = Number(product.discountPercent) || 0;
        const gstPercent = Number(product.gstPercent) || 0;
        return `<article class="merchant-product-card">
            <img class="merchant-product-card-image" src="${escapeHtml(product.imageUrl || "")}" alt="${escapeHtml(product.name || "Product")}">
            <div class="merchant-product-card-content">
                <h3>${escapeHtml(product.name || "Untitled product")}</h3>
                <p>${escapeHtml(product.area || "Area not set")} · ${escapeHtml(product.village || "Village not set")}</p>
                <p class="merchant-product-sale-price">${money(effectivePrice(product.price, discount))}<span> / ${escapeHtml(product.uom || "unit")}</span></p>
                <p class="merchant-product-price-detail">Price: ${money(product.price)} · Discount: ${discount}% · GST: ${formatPercent(gstPercent)}%</p>
            </div>
        </article>`;
    }).join("");
};

const loadProducts = async () => {
    if (!currentMerchant?.merchantId) return;

    merchantList.innerHTML = '<p class="merchant-product-empty">Loading your catalog…</p>';
    showStatus("");
    try {
        const productsQuery = query(
            collection(db, "products"),
            where("merchantId", "==", currentMerchant.merchantId)
        );
        const snapshot = await getDocs(productsQuery);
        merchantProducts = snapshot.docs.map(productDocument => ({
            id: productDocument.id,
            product: productDocument.data()
        }));
        renderProducts();
        showStatus(`${merchantProducts.length} product${merchantProducts.length === 1 ? "" : "s"} in your catalog.`);
        return true;
    } catch (error) {
        console.error("Could not load this merchant's product catalog.", error);
        merchantList.innerHTML = '<p class="merchant-product-empty">Your catalog could not be loaded. Check your Firebase permissions and try again.</p>';
        const errorCode = String(error?.code || "");
        showStatus(errorCode === "permission-denied"
            ? "Firestore denied the catalog read. Publish firestore.rules for this Firebase project, then refresh the catalog."
            : `Catalog loading failed${errorCode ? ` (${errorCode})` : ""}. Check the browser console and try again.`,
        "error");
        return false;
    }
};

imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) {
        imagePreview.hidden = true;
        imagePreview.removeAttribute("src");
        return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size >= 5 * 1024 * 1024) {
        imageInput.value = "";
        imagePreview.hidden = true;
        showStatus("Choose a JPG, PNG, or WebP image smaller than 5 MB.", "error");
        return;
    }

    imagePreview.src = URL.createObjectURL(file);
    imagePreview.hidden = false;
    showStatus("");
});

const compressShopPhoto = async file => {
    const image = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to prepare the shop photo for display.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.78);
    } finally {
        image.close();
    }
};

shopPhotoInput.addEventListener("change", () => {
    const file = shopPhotoInput.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size >= 5 * 1024 * 1024) {
        shopPhotoInput.value = "";
        shopPhotoStatus.textContent = "Choose a JPG, PNG, or WebP shop photo smaller than 5 MB.";
        return;
    }
    if (shopPhotoPreviewUrl) URL.revokeObjectURL(shopPhotoPreviewUrl);
    shopPhotoPreviewUrl = URL.createObjectURL(file);
    shopPhotoImage.src = shopPhotoPreviewUrl;
    shopPhotoImage.hidden = false;
    shopPhotoEmpty.hidden = true;
    shopPhotoStatus.textContent = "";
});

gstinInput.addEventListener("input", () => {
    gstinInput.value = gstinInput.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
});

gstinForm.addEventListener("submit", event => {
    event.preventDefault();
    const gstNumber = gstinInput.value.trim().toUpperCase();
    if (!gstinForm.reportValidity()) return;
    if (!merchantAccount) {
        gstinStatus.textContent = "No saved merchant registration was found in this browser.";
        return;
    }

    gstinSaveButton.disabled = true;
    try {
        const merchants = JSON.parse(localStorage.getItem("tribesMerchants") || "[]");
        if (!Array.isArray(merchants)) throw new Error("Saved merchant registrations are not in a valid list format.");
        const accountIndex = merchants.findIndex(merchant =>
            String(merchant?.merchantId || "").trim().toUpperCase() === String(currentMerchant.merchantId).trim().toUpperCase()
        );
        if (accountIndex < 0) throw new Error("Your saved merchant registration could not be found.");
        merchants[accountIndex].gstNumber = gstNumber;
        localStorage.setItem("tribesMerchants", JSON.stringify(merchants));
        merchantAccount = merchants[accountIndex];
        document.querySelector("#merchant-gstin").textContent = gstNumber || "Not provided";
        gstinStatus.textContent = "GSTIN updated.";
    } catch (error) {
        console.error("Could not update the merchant GSTIN.", error);
        gstinStatus.textContent = error.message || "Could not update GSTIN. Check browser storage and try again.";
    } finally {
        gstinSaveButton.disabled = false;
    }
});

shopPhotoForm.addEventListener("submit", async event => {
    event.preventDefault();
    const file = shopPhotoInput.files?.[0];
    if (!file) {
        shopPhotoStatus.textContent = "Choose a shop photo first.";
        return;
    }
    if (!merchantAccount) {
        shopPhotoStatus.textContent = "No saved merchant registration was found in this browser.";
        return;
    }
    shopPhotoSaveButton.disabled = true;
    try {
        const merchants = JSON.parse(localStorage.getItem("tribesMerchants") || "[]");
        const accountIndex = merchants.findIndex(merchant =>
            String(merchant?.merchantId || "").trim().toUpperCase() === String(currentMerchant.merchantId).trim().toUpperCase()
        );
        if (accountIndex < 0) throw new Error("Your saved merchant registration could not be found.");
        merchants[accountIndex].shopPhotoDataUrl = await compressShopPhoto(file);
        localStorage.setItem("tribesMerchants", JSON.stringify(merchants));
        merchantAccount = merchants[accountIndex];
        if (shopPhotoPreviewUrl) URL.revokeObjectURL(shopPhotoPreviewUrl);
        shopPhotoPreviewUrl = undefined;
        shopPhotoImage.src = merchantAccount.shopPhotoDataUrl;
        shopPhotoImage.hidden = false;
        shopPhotoEmpty.hidden = true;
        shopPhotoForm.reset();
        shopPhotoStatus.textContent = "Shop photo saved and will appear when you sign in again.";
    } catch (error) {
        console.error("Could not save the merchant shop photo.", error);
        shopPhotoStatus.textContent = error.message || "Could not save the shop photo. Check browser storage and try again.";
    } finally {
        shopPhotoSaveButton.disabled = false;
    }
});

productForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentMerchant?.merchantId || !productForm.reportValidity()) return;

    const file = imageInput.files?.[0];
    const price = Number(document.querySelector("#merchant-product-price").value);
    const discountPercent = Number(document.querySelector("#merchant-product-discount").value);
    const gstPercent = Number(document.querySelector("#merchant-product-gst").value);
    const avlbStk = Number(document.querySelector("#merchant-product-stock").value);
    const productName = document.querySelector("#merchant-product-name").value.trim();
    if (!file) {
        showStatus("Choose a product photo before uploading.", "error");
        return;
    }
    if (!productName) {
        showStatus("Enter a product name.", "error");
        return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(discountPercent) ||
        discountPercent < 0 || discountPercent > 100 || !Number.isFinite(gstPercent) ||
        gstPercent < 0 || gstPercent > 100 || !Number.isInteger(avlbStk) || avlbStk < 0) {
        showStatus("Enter a valid price, discount (0–100), GST percentage (0–100), and non-negative stock.", "error");
        return;
    }

    submitButton.disabled = true;
    showStatus("Uploading your product photo and saving the listing…");
    let uploadStage = "product photo";
    try {
        const safeFileName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const imageRef = ref(storage, `products/${Date.now()}-${safeFileName}`);
        await uploadBytes(imageRef, file);
        const imageUrl = await getDownloadURL(imageRef);
        uploadStage = "product listing";
        await addDoc(collection(db, "products"), {
            merchantId: currentMerchant.merchantId,
            merchantName: currentMerchant.fullName || "",
            name: productName,
            uom: document.querySelector("#merchant-product-unit").value,
            price,
            discountPercent,
            gstPercent,
            quantity: avlbStk,
            avlbStk,
            area: document.querySelector("#merchant-product-area").value.trim(),
            village: document.querySelector("#merchant-product-village").value.trim(),
            imageUrl,
            createdAt: Date.now()
        });
        productForm.reset();
        imagePreview.hidden = true;
        imagePreview.removeAttribute("src");
        const refreshed = await loadProducts();
        showStatus(refreshed
            ? "Product photo, price, discount, and GST rate added to your catalog."
            : "Product was saved, but the catalog could not refresh. Use Refresh catalog to try again.",
        refreshed ? "" : "error");
    } catch (error) {
        console.error(`Could not save the merchant ${uploadStage}.`, error);
        const errorCode = String(error?.code || "");
        let message;
        if (errorCode.startsWith("storage/")) {
            message = errorCode === "storage/unauthorized"
                ? "Firebase Storage denied the product photo. Publish the project's storage.rules and make sure the file is smaller than 5 MB."
                : `Firebase Storage could not upload the product photo (${errorCode}). Check the configured Storage bucket and try again.`;
        } else if (errorCode === "permission-denied") {
            message = "Firebase Firestore denied the product listing. Publish the project's firestore.rules and verify the products collection permissions.";
        } else {
            message = `Could not save the ${uploadStage}${errorCode ? ` (${errorCode})` : ""}. Check the browser console for the Firebase error and try again.`;
        }
        showStatus(message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

document.querySelector("#refresh-merchant-products").addEventListener("click", loadProducts);
signOutButton.addEventListener("click", () => {
    localStorage.removeItem("tribesCurrentMerchant");
    window.location.replace("merchant-login.html");
});

loadProducts();
