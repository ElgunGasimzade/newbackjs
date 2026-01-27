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
            // const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
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

    static mapRowToProductDB(row) {
        // Maps PostgreSQL row (snake_case) to Product Domain Object (camelCase)
        return {
            id: row.id,
            store: row.store,
            name: row.name,
            brand: row.brand,
            description: row.description,
            originalPrice: row.original_price ? parseFloat(row.original_price) : 0,
            price: row.price ? parseFloat(row.price) : 0,
            discountPercent: parseInt(row.discount_percent, 10) || 0,
            details: row.details,
            imageUrl: row.image_url || "https://placehold.co/200x200?text=No+Image",
            inStock: row.in_stock
        };
    }

    static mapToBrandItem(product, lang = 'en', userLat = null, userLon = null, storeLocations = {}) {
        const savings = product.originalPrice - product.price;
        // const isDeal = savings > 0.01; // Not used for text, used for value

        // Create a descriptive display name
        const brandLower = product.brand.toLowerCase();
        // Remove accents for comparison
        const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let displayName = product.description;
        const descLower = normalize(displayName.toLowerCase());
        const brandNorm = normalize(brandLower);

        if (descLower.startsWith(brandNorm)) {
            displayName = displayName.substring(product.brand.length).trim();
            displayName = displayName.replace(/^[-:\s]+/, '');
        }

        if (displayName.length > 0) {
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }

        if (product.details) {
            displayName = `${displayName} (${product.details})`;
        }

        // Distance & Time
        let distance = null;
        let estTime = null;

        const storeMatch = Object.keys(storeLocations).find(k => product.store.includes(k) || k.includes(product.store));
        if (storeMatch && userLat && userLon) {
            const loc = storeLocations[storeMatch];
            distance = this.calculateDistance(userLat, userLon, loc.lat, loc.lon);
            if (distance !== null) {
                const mins = Math.ceil(distance * 5 + 2);
                estTime = `${mins} min`;
            }
        }

        return {
            id: product.id,
            brandName: displayName,
            logoUrl: product.imageUrl || "https://media.screensdesign.com/gasset/c32d330e-31e8-47f6-b125-f2a7ce9de999.png",
            dealText: product.store, // Removed "at "
            savings: savings > 0.01 ? savings : 0.0,
            price: product.price,
            originalPrice: product.originalPrice,
            badge: null, // Will be set in group map
            isSelected: false,
            details: product.details,
            distance: distance,
            estTime: estTime
        };
    }

    static mapToBrandGroup(categoryName, products, lang = 'en', userLat = null, userLon = null, storeLocations = {}) {
        const t = (key) => this.TRANSLATIONS[lang]?.[key] || this.TRANSLATIONS['en'][key] || key;

        const firstProduct = products[0];
        const options = products.map(p => this.mapToBrandItem(p, lang, userLat, userLon, storeLocations));

        // Deduplicate
        const uniqueOptions = [];
        const seen = new Set();
        for (const opt of options) {
            const uniqueKey = `${opt.brandName}|${opt.dealText}|${opt.price}|${opt.details}`;
            if (!seen.has(uniqueKey)) {
                seen.add(uniqueKey);
                uniqueOptions.push(opt);
            }
        }

        // --- Smart Badge Logic ---
        if (uniqueOptions.length > 1) {
            // Find Min Price & Max Savings
            const minPrice = Math.min(...uniqueOptions.map(o => o.price || 99999));
            const maxSavings = Math.max(...uniqueOptions.map(o => o.savings));

            // Count how many have minPrice
            const minPriceCount = uniqueOptions.filter(o => (o.price || 99999) === minPrice).length;

            uniqueOptions.forEach(opt => {
                opt.badge = null; // Reset

                // 1. Check Cheapest (Only if 2 or fewer items share this price)
                const isCheapest = (opt.price || 99999) === minPrice;
                if (isCheapest && minPriceCount <= 2) {
                    opt.badge = t('cheapest');
                }

                // 2. Check Most Discount (Always shown, overrides Cheapest if both)
                if (opt.savings === maxSavings && maxSavings > 0.01) {
                    // Force uppercase or normalized key?
                    // User said "most discount"
                    opt.badge = "MOST DISCOUNT";
                }
            });
        } else if (uniqueOptions.length === 1) {
            // Single item with good savings
            if (uniqueOptions[0].savings > 0.50) {
                uniqueOptions[0].badge = "MOST DISCOUNT";
            }
        }

        // Sort: Cheapest first by default? User didn't ask, but good UX. 
        // Or keep API order (relevance). Keep API order.

        // Default Select: Cheapest
        if (uniqueOptions.length > 0) {
            // Find the one with 'cheapest' badge or just first
            const cheapest = uniqueOptions.find(o => o.badge === t('cheapest'));
            if (cheapest) cheapest.isSelected = true;
            else uniqueOptions[0].isSelected = true;
        }

        let status = "DEAL_FOUND";
        if (uniqueOptions.length === 0) status = "NO_DEAL";

        return {
            itemName: categoryName,
            itemDetails: firstProduct ? `${firstProduct.description}` : "",
            status: status,
            options: uniqueOptions
        };
    }
}

module.exports = DealMapper;
