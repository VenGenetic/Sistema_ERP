import pdfplumber
import os

pdf_path = r'c:\Users\ASUS\Documents\Sistema_ERP-main\Sistema_ERP-main\scripts\Lista de precios (8).pdf'

try:
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            tables = page.extract_tables()
            print(f"--- Page {i+1} ---")
            print(f"Text length: {len(text) if text else 0}")
            print(f"Tables found: {len(tables)}")
            if tables:
                print(f"First table sample: {tables[0][0]}")
except Exception as e:
    print(f"Error reading PDF: {e}")
