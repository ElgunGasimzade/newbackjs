/**
 * Responsible for mapping data from one representation to another.
 * 1. Raw CSV Row -> Domain Product
 * 2. Domain Product Groups -> API Response
 */
class DealMapper {

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
            const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
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
            productName: rawName, // Cleaned Name
            brandName: marketName, // Store acts as Brand
            description: rawName, // Cleaned Name
            oldPrice: oldPrice,
            newPrice: newPrice,
            discountPercentage: discountPercent,
            details: details, // Extracted Unit
            imageUrl: imageUrl
        };
    }

    static mapToBrandItem(product) {
        const savings = product.oldPrice - product.newPrice;
        const isDeal = savings > 0.01;

        let badge = null;
        if (product.discountPercentage >= 20) badge = "BEST DEAL";
        else if (product.discountPercentage >= 15) badge = "GREAT PRICE";

        // Create a descriptive display name
        const brandLower = product.brandName.toLowerCase();
        // Remove accents for comparison
        const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let displayName = product.description;
        const descLower = normalize(displayName.toLowerCase());
        const brandNorm = normalize(brandLower);

        // Remove redundant Brand/Store prefix from Product Name
        // e.g. Brand: "Bravo", Name: "Bravo Alma" -> "Alma"
        // Also check "Tamstore Khatai" vs "Tamstore"
        if (descLower.startsWith(brandNorm)) {
            displayName = displayName.substring(product.brandName.length).trim();
            // Remove leading hyphen if exists " - Alma"
            displayName = displayName.replace(/^[-:\s]+/, '');
        }

        // Capitalize first letter
        if (displayName.length > 0) {
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }

        // Append unit in brackets if available
        if (product.details) {
            displayName = `${displayName} (${product.details})`;
        }

        return {
            id: product.id,
            brandName: displayName, // Actually Product Name for UI
            logoUrl: product.imageUrl || "https://media.screensdesign.com/gasset/c32d330e-31e8-47f6-b125-f2a7ce9de999.png",
            dealText: `at ${product.store}`,
            savings: isDeal ? savings : 0.0,
            price: product.newPrice,
            originalPrice: product.oldPrice,
            badge: badge,
            isSelected: false,
            details: product.details
        };
    }

    static mapToBrandGroup(categoryName, products) {
        // Assume all products in one group share the same description (generic category details)
        // or take the first one.
        const firstProduct = products[0];

        const options = products.map(p => this.mapToBrandItem(p));

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
