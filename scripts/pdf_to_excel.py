import pdfplumber
import pandas as pd
import os
import sys
import re

# Configure UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

pdf_path = r'c:\Users\ASUS\Documents\Sistema_ERP-main\Sistema_ERP-main\scripts\Lista de precios (8).pdf'
output_excel = r'c:\Users\ASUS\Documents\Sistema_ERP-main\Sistema_ERP-main\public\lista_precios_simplificada.xlsx'

def clean_text(text):
    if text is None:
        return ""
    return str(text).strip()

def extract_price_data(pdf_path):
    final_rows = []
    print(f"Opening PDF: {pdf_path}")
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        print(f"Total pages to process: {total_pages}")
        
        for i, page in enumerate(pdf.pages):
            table = page.extract_table()
            if table:
                for row in table:
                    # Check if the row has enough columns (we need at least 3: 产品, Udm, 1)
                    if len(row) < 3:
                        continue
                    
                    product_col = clean_text(row[0])
                    # Skip header/empty rows
                    if not product_col or "Cantidades" in product_col or "Productos" in product_col:
                        continue
                    
                    # Extract Code and Name from Product column: [CODE] NAME
                    # We look for the first occurrences of '[' and ']'
                    code = ""
                    name = product_col
                    
                    if '[' in product_col and ']' in product_col:
                        start = product_col.find('[')
                        end = product_col.find(']')
                        code = product_col[start+1:end].strip()
                        name = product_col[end+1:].strip()
                        
                        # Clean up any remaining newlines in the name
                        name = name.replace('\n', ' ')
                    
                    # Get the Price (1 Unit) from Column 2
                    price = clean_text(row[2]) if len(row) > 2 else ""
                    
                    # Store only the 3 columns requested
                    final_rows.append({
                        'Código': code,
                        'Nombre': name,
                        'Precio (1 Unidad)': price
                    })
            
            if (i + 1) % 10 == 0:
                print(f"Progress: {i+1}/{total_pages} pages...")
                
    if not final_rows:
        raise ValueError("No valid product data was found in the PDF.")
        
    print(f"Structuring {len(final_rows)} product entries...")
    return pd.DataFrame(final_rows)

if __name__ == "__main__":
    try:
        df = extract_price_data(pdf_path)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_excel), exist_ok=True)
        
        print(f"Saving to Excel: {output_excel}")
        df.to_excel(output_excel, index=False)
        print("✅ Conversion COMPLETED successfully!")
        print(f"3-column output saved to: {output_excel}")
        
        # Show a preview
        print("\nPreview of first 10 rows:")
        print(df.head(10))
    except Exception as e:
        print(f"❌ Error during conversion: {e}")
