import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read JSON Data
const jsonDataStr = readFileSync(path.join(__dirname, 'data_guayaquil.json'), 'utf-8');
const jsonParsed = JSON.parse(jsonDataStr);
const productsJson = jsonParsed.RAW_SCRAPED_DATA || [];

// 2. Read Excel Data
const workbook = readFile(path.join(__dirname, 'New Intventory leo.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = utils.sheet_to_json(worksheet, { header: 1 });

// 3. Parse Excel into structured list
const parsedExcel = [];
let currentCategory = "";

for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row || row.length === 0) continue;

    // Check if it's a fully structured row: [codigo, descripcion, cantidad, precio]
    if (row[0] && typeof row[0] === 'string' && row[0].length > 3) {
        parsedExcel.push({
            codigo: row[0],
            descripcion: row[1],
            cantidad: row[2] || 0,
            precio: row[3] || 0
        });
        continue;
    }

    // Check if it's a category header (Col A is null, Col B is string, Col C is null/undefined)
    if (!row[0] && typeof row[1] === 'string' && !row[2]) {
        currentCategory = row[1].trim();
        continue;
    }

    // Check if it's a model with quantity (Col A is null, Col B is string, Col C is number)
    if (!row[0] && typeof row[1] === 'string' && typeof row[2] === 'number') {
        parsedExcel.push({
            category: currentCategory,
            model: row[1].trim(),
            cantidad: row[2],
        });
    }
}

console.log(`Found ${productsJson.length} items in JSON.`);
console.log(`Found ${parsedExcel.length} valid items in Excel.`);

// 4. Fuzzy Matching
const normalize = (str) => {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const tokenize = (str) => {
    if (!str) return [];
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
};

let matchedCount = 0;
let unmatchedExcel = [];
let matchedProducts = {}; // sku -> quantity

for (const item of parsedExcel) {
    if (item.codigo) {
        matchedProducts[item.codigo] = (matchedProducts[item.codigo] || 0) + item.cantidad;
        matchedCount++;
        continue;
    }

    const categoryTokens = tokenize(item.category);
    const modelTokens = tokenize(item.model);
    const searchTokens = [...categoryTokens, ...modelTokens];

    // Find best match in JSON
    let bestMatch = null;
    let bestScore = 0;

    for (const prod of productsJson) {
        const prodTokens = tokenize(prod.nombre);
        
        let score = 0;
        for (const st of searchTokens) {
            // Check if search token is a substring of any product token or vice versa
            if (prodTokens.some(pt => pt.includes(st) || st.includes(pt))) {
                score++;
            }
        }

        // Additional score if exact match for model
        if (prod.nombre.toLowerCase().includes(item.model.toLowerCase())) {
            score += 2;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = prod;
        }
    }

    // Threshold for accepted match
    if (bestMatch && bestScore >= Math.min(searchTokens.length, 3)) {
        matchedProducts[bestMatch.codigo_referencia] = (matchedProducts[bestMatch.codigo_referencia] || 0) + item.cantidad;
        matchedCount++;
    } else {
        unmatchedExcel.push(item);
    }
}

console.log(`Matched ${matchedCount} items from Excel. Failed to match ${unmatchedExcel.length}.`);
if (unmatchedExcel.length > 0) {
    console.log("Sample unmatched items:");
    console.log(unmatchedExcel.slice(0, 5));
}

// Ensure all JSON products are represented (with quantity 0 if not matched)
const finalInventoryUpload = productsJson.map(p => {
    return {
        sku: p.codigo_referencia,
        name: p.nombre,
        price: p.precio,
        stock: matchedProducts[p.codigo_referencia] || 0
    };
});

writeFileSync(path.join(__dirname, 'upload_preview.json'), JSON.stringify(finalInventoryUpload, null, 2));
console.log(`Generated upload_preview.json with ${finalInventoryUpload.length} total products.`);
