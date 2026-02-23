const fs = require('fs');
const content = fs.readFileSync('local_schema.sql', 'utf8');

const tableRegex = /CREATE TABLE IF NOT EXISTS "?(?:public\.)?(\w+)"?\s*\(([\s\S]*?)\);/g;
let match;
while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    const columns = columnsStr.split('\n');

    for (const colStr of columns) {
        const trimmed = colStr.trim();
        if (trimmed.match(/(numeric|double precision|real|float)/i)) {
            console.log(`Table: ${tableName}`);
            console.log(`  -> ${trimmed}`);
        }
    }
}
