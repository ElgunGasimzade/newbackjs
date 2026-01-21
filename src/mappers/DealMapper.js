/**
 * Responsible for mapping data from one representation to another.
 * 1. Raw CSV Row -> Domain Product
 * 2. Domain Product Groups -> API Response
 */
class DealMapper {

    static mapRowToProduct(row) {
        // Mapping from finalcsvmarketf.csv
        // id,market,journal_date,discount_start_date,discount_end_date,product_name,brand,category,previous_price,current_price,discount_percent,unit

        // Use the incremental ID from CSV (more reliable and easier to track)
        let id = row.id ? row.id.toString() : null;

        // If no ID exists (shouldn't happen with new CSV), generate fallback
        if (!id) {
            const crypto = require('crypto');
            const uniqueString = `${row.market}-${row.product_name}-${row.brand}-${row.unit}-${row.current_price}`;
            id = crypto.createHash('md5').update(uniqueString).digest('hex');
        }

        // Parse prices
        const oldPrice = row.previous_price ? parseFloat(row.previous_price) : 0.0;
        const newPrice = row.current_price ? parseFloat(row.current_price) : 0.0;

        // Calculate discount percentage if not provided but prices exist
        let discountPercent = row.discount_percent ? parseInt(row.discount_percent, 10) : 0;
        if (!discountPercent && oldPrice > 0 && newPrice > 0 && oldPrice > newPrice) {
            discountPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
        }

        return {
            id: id,
            store: row.market || "Unknown Store",
            productName: row.category || "Unknown Product", // Generic Category (e.g., "Kərə yağı")
            brandName: row.brand || "Generic",
            description: row.product_name || "", // Specific details (e.g., "Sevimli Dad Kərə yağı")
            oldPrice: oldPrice,
            newPrice: newPrice,
            discountPercentage: discountPercent,
            details: row.unit // Extra details like "82.5% / kq"
        };
    }

    static mapToBrandItem(product) {
        const savings = product.oldPrice - product.newPrice;
        const isDeal = savings > 0.01;

        let badge = null;
        if (product.discountPercentage >= 20) badge = "BEST DEAL";
        else if (product.discountPercentage >= 15) badge = "GREAT PRICE";

        // Create a descriptive display name with Unit
        let displayName = product.brandName;
        const unit = product.details || "";

        if (product.description) {
            const brandLower = product.brandName.toLowerCase();
            const descLower = product.description.toLowerCase();

            // If description already starts with brand (e.g. "Nevskiy dark chocolate"), just use description
            if (descLower.startsWith(brandLower)) {
                displayName = product.description;
            } else {
                // Otherwise combine: "Nevskiy - Dark Chocolate"
                displayName = `${product.brandName} - ${product.description}`;
            }
        }

        // Append unit if available and not already in text
        if (unit && !displayName.toLowerCase().includes(unit.toLowerCase())) {
            displayName = `${displayName} (${unit})`;
        }

        return {
            id: product.id, // INCLUDE ID
            brandName: displayName,
            logoUrl: "https://media.screensdesign.com/gasset/c32d330e-31e8-47f6-b125-f2a7ce9de999.png", // Placeholder
            dealText: `at ${product.store}`,
            savings: isDeal ? savings : 0.0,
            price: product.newPrice,
            originalPrice: product.oldPrice,
            badge: badge,
            isSelected: false, // Default state
            details: unit // Keep unit in details as well just in case
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
