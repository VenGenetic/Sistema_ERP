import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workbook = readFile(path.join(__dirname, 'New Intventory leo.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = utils.sheet_to_json(worksheet, { header: 1 });
console.log("First 15 rows:");
data.slice(0, 15).forEach(row => console.log(JSON.stringify(row)));
