import pdfplumber
import sys

pdf_path = r'c:\Users\ASUS\Documents\img20260323_23152374.pdf'

try:
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        first_page = pdf.pages[0]
        text = first_page.extract_text()
        if text:
            print("--- Text sample found ---")
            print(text[:500])
        else:
            print("No text found. Possibly a scanned image.")
            
        tables = first_page.extract_tables()
        if tables:
            print(f"Found {len(tables)} tables on the first page.")
            for i, table in enumerate(tables):
                print(f"Table {i} row sample: {table[0] if table else 'Empty'}")
        else:
            print("No structured tables found natively.")
except Exception as e:
    print(f"Error reading PDF: {e}")
