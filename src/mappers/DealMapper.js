/**
 * Responsible for mapping data from one representation to another.
 * 1. Raw CSV Row -> Domain Product
 * 2. Domain Product Groups -> API Response
 */
class DealMapper {
    static TRANSLATIONS = {
        en: {
            best_deal: "BEST DEAL",
            great_price: "GREAT PRICE"
        },
        az: {
            best_deal: "ƏN YAXŞI",
            great_price: "ƏLA QİYMƏT",
            cheapest: "ƏN UCUZ",
            best_price: "ƏN YAXŞI QİYMƏT"
        }
    };

    // Helper calculate distance
    static calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(1)); // Distance in km
    }

    static mapRowToProduct(row) {
        // Mapping from wolt_products.csv
        // Columns: "id", "Market", "Product Name", "Price", "Original Price", "Discount", "Image URL", "Local Image Path"

        // Use explicit ID from CSV (e.g. "1", "2")
        // Ensure we strip quotes or whitespace if present
        let idRaw = row['id'];
        if (!idRaw && row['\ufeff"id"']) idRaw = row['\ufeff"id"']; // Handle potential BOM
        // Fallback or Clean
        const id = idRaw ? `product_${idRaw.replace(/[^0-9]/g, '')}` : `product_${Math.random()}`;

        // Parse numeric values
        const parsePrice = (val) => {
            if (!val) return 0.0;
            return parseFloat(val.toString().replace(/[^0-9.]/g, '')) || 0.0;
        };

        const newPrice = parsePrice(row['Price']);
        const oldPrice = parsePrice(row['Original Price']);
        const discountPercent = parseInt(row['Discount'], 10) || 0;

        // Construct Image URL
        let imageUrl = row['Image URL'];
        if (row['Local Image Path']) {
            const filename = row['Local Image Path'].split('/').pop();
            const BASE_URL = process.env.BASE_URL || "https://newbackjs.onrender.com";
            imageUrl = `${BASE_URL}/images/${filename}`;
        }

        // --- Data Cleaning (Name & Unit Extraction) ---
        let rawName = row['Product Name'] || "Unknown Product";
        const marketName = row['Market'] || "Generic";
        let details = "";

        // 1. Extract Unit (e.g. "1kq", "500 qr", "1 l", "5əd", "2 x 100gr")
        // Regex looks for number followed optionally by space and then unit
        const unitRegex = /(\d+(?:\.\d+)?\s*[-xX*]?\s*\d*\s*(?:kq|kg|gr|qr|g|l|ml|litr|ədəd|ed|əd|pcs|pack)\.?)/i;
        const unitMatch = rawName.match(unitRegex);

        if (unitMatch) {
            details = unitMatch[0].trim(); // "500 qr"
            // Remove unit from name to clean it up, but keep if it makes name empty?
            // Usually better to keep name clean.
            // Replace with empty string, trimming extra spaces
            rawName = rawName.replace(unitMatch[0], '').replace(/\s{2,}/g, ' ').trim();
            // Remove trailing commas or dashes
            rawName = rawName.replace(/[,-\s]+$/, '');
        }

        return {
            id: id,
            store: marketName,
            name: rawName, // Cleaned Name
            brand: marketName, // Store acts as Brand
            description: rawName, // Cleaned Name
            originalPrice: oldPrice,
            price: newPrice,
            discountPercent: discountPercent,
            details: details, // Extracted Unit
            imageUrl: imageUrl || "https://placehold.co/200x200?text=No+Image",
            inStock: true
        };
    }

    static mapToBrandItem(product, lang = 'en', userLat = null, userLon = null) {
        const savings = product.originalPrice - product.price;
        const isDeal = savings > 0.01;
        const t = (key) => this.TRANSLATIONS[lang]?.[key] || this.TRANSLATIONS['en'][key] || key;

        let badge = null;
        // User Request: "Cheapest", "Best Price"
        if (product.discountPercent >= 20) badge = t('cheapest');
        else if (product.discountPercent >= 15) badge = t('best_price');

        // Create a descriptive display name
        // Create a descriptive display name
        const brandLower = product.brand.toLowerCase();
        // Remove accents for comparison
        const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let displayName = product.description;
        const descLower = normalize(displayName.toLowerCase());
        const brandNorm = normalize(brandLower);

        // Remove redundant Brand/Store prefix from Product Name
        // e.g. Brand: "Bravo", Name: "Bravo Alma" -> "Alma"
        // Also check "Tamstore Khatai" vs "Tamstore"
        if (descLower.startsWith(brandNorm)) {
            displayName = displayName.substring(product.brand.length).trim();
            // Remove leading hyphen if exists " - Alma"
            displayName = displayName.replace(/^[-:\s]+/, '');
        }

        // Capitalize first letter
        if (displayName.length > 0) {
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }

        if (product.details) {
            displayName = `${displayName} (${product.details})`;
        }

        // Distance & Time
        let distance = null;
        let estTime = null;

        // Lookup Store Location (Need to duplicate map or access DealService? 
        // Better to pass store location map or have it here. 
        // For simplicity, let's redefine map here or move to shared config.
        // Duplicating for speed as requested to "do all").
        const STORE_LOCATIONS = {
            "Tamstore Khatai": { lat: 40.3845, lon: 49.8660 },
            "Bravo Supermarket": { lat: 40.3731, lon: 49.8437 },
            "Araz Torgovaya": { lat: 40.3728, lon: 49.8430 },
            "Oba Market": { lat: 40.3992, lon: 49.8540 },
            "Neptun Supermarket": { lat: 40.3967, lon: 49.8152 }
        };

        // Match partial store name
        const storeMatch = Object.keys(STORE_LOCATIONS).find(k => product.store.includes(k) || k.includes(product.store));
        if (storeMatch && userLat && userLon) {
            const loc = STORE_LOCATIONS[storeMatch];
            distance = this.calculateDistance(userLat, userLon, loc.lat, loc.lon);
            // Estimate: 5 mins per km + 2 mins base
            if (distance !== null) {
                const mins = Math.ceil(distance * 5 + 2);
                estTime = `${mins} min`;
            }
        }

        return {
            id: product.id,
            brandName: displayName, // Actually Product Name for UI
            logoUrl: product.imageUrl || "https://media.screensdesign.com/gasset/c32d330e-31e8-47f6-b125-f2a7ce9de999.png",
            dealText: `at ${product.store}`,
            savings: isDeal ? savings : 0.0,
            price: product.price,
            originalPrice: product.originalPrice,
            badge: badge,
            isSelected: false,
            details: product.details,
            distance: distance, // New
            estTime: estTime    // New
        };
    }

    static mapToBrandGroup(categoryName, products, lang = 'en', userLat = null, userLon = null) {
        // Assume all products in one group share the same description (generic category details)
        // or take the first one.
        const firstProduct = products[0];

        const options = products.map(p => this.mapToBrandItem(p, lang, userLat, userLon));

        // Deduplicate options based on brand + store + price + details
        const uniqueOptions = [];
        const seen = new Set();

        for (const opt of options) {
            const uniqueKey = `${opt.brandName}|${opt.dealText}|${opt.price}|${opt.details}`;
            if (!seen.has(uniqueKey)) {
                seen.add(uniqueKey);
                uniqueOptions.push(opt);
            }
        }

        // Replace options with unique list
        const finalOptions = uniqueOptions;

        // Default selected item
        if (finalOptions.length > 0) {
            finalOptions[0].isSelected = true;
        }

        // Determine status
        let status = "DEAL_FOUND";
        if (finalOptions.length === 0) status = "NO_DEAL";

        return {
            itemName: categoryName,
            itemDetails: firstProduct ? `${firstProduct.description}` : "",
            status: status,
            options: finalOptions
        };
    }
}

module.exports = DealMapper;
