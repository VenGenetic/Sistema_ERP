const fs = require('fs');
const path = require('path');

const imagesDir = 'C:\\Users\\ASUS\\Documents\\catalogo-motos-main\\catalogo-motos\\public\\imagenes_repuestos';
const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('_cut.webp'));

let sql = `-- VINCULACIÓN MASIVA DE FOTOS A PRODUCTOS\n`;
sql += `DO $$\nBEGIN\n`;

for(const file of files) {
    const sku = file.replace('_cut.webp', '');
    const url = `https://xzsdsmskyosepemalage.supabase.co/storage/v1/object/public/product_images/products/${file}`;
    // Escape single quotes if any in sku
    const safeSku = sku.replace(/'/g, "''");
    sql += `  UPDATE products SET image_url = '${url}' WHERE sku = '${safeSku}';\n`;
}

sql += `END\n$$;`;

fs.writeFileSync('link_images.sql', sql);
console.log(`Generated link_images.sql with ${files.length} updates.`);
