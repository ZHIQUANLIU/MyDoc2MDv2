import os
import sys
import argparse
import asyncio
from pathlib import Path

# Try importing dependencies early
try:
    import pymupdf4llm
except ImportError:
    print("Error: pymupdf4llm is not installed. Please run 'pip install pymupdf4llm'")
    sys.exit(1)

try:
    import google.generativeai as genai
except ImportError:
    print("Error: google-generativeai is not installed. Please run 'pip install google-generativeai'")
    sys.exit(1)

async def refine_with_ai(text: str, model_name: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        print("Warning: GEMINI_API_KEY is not set. Skipping AI refinement.")
        return text
    
    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel(model_name)
        prompt = (
            "You are an expert at cleaning up Markdown extracted from PDFs. "
            "The following text was extracted using PyMuPDF4LLM. "
            "Please fix any OCR errors, improve table formatting, and ensure the structure is logical. "
            "Keep the content exactly as is, just improve the Markdown syntax and layout.\n\n"
            f"### EXTRACTED TEXT:\n{text}"
        )
        print(f"🤖 Calling {model_name} for AI refinement...")
        response = await asyncio.to_thread(model.generate_content, prompt)
        print("✨ AI refinement complete")
        return response.text
    except Exception as e:
        print(f"❌ AI Refinement failed: {str(e)}")
        return text

async def main():
    parser = argparse.ArgumentParser(description="Extract PDF to Markdown")
    parser.add_argument("--file", required=True, help="Input PDF file")
    parser.add_argument("--outdir", required=True, help="Output directory")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model name")
    parser.add_argument("--use-ai", action="store_true", help="Use AI for refinement")
    
    args = parser.parse_args()
    file_path = Path(args.file)
    target_dir = Path(args.outdir)
    image_subdir = "images"
    
    safe_name = target_dir.name
    
    print(f"🚀 Starting conversion for {file_path.name}")
    
    try:
        img_full_path = target_dir / image_subdir
        img_full_path.mkdir(parents=True, exist_ok=True)
        print(f"📁 Created output directory: {target_dir}")
        
        print(f"📄 Extracting content and images to {target_dir}...")
        
        # Extraction
        md_text = await asyncio.to_thread(
            pymupdf4llm.to_markdown,
            str(file_path),
            write_images=True,
            image_path=str(img_full_path),
            image_format="png"
        )
        print(f"✅ Extraction & Images saved successfully")
        
        # AI Refinement
        if args.use_ai:
            md_text = await refine_with_ai(md_text, args.model)
            
        # Fix image paths
        import re
        md_text = re.sub(r'!\[\]\((.*?\.png)\)', r'![](images/\1)', md_text)
        print("🔗 Image paths adjusted to relative links")
        
        # Save MD
        md_file_path = target_dir / f"{safe_name}.md"
        with open(md_file_path, "w", encoding="utf-8") as f:
            f.write(md_text)
            
        print(f"🏁 Process finished. Files saved at: {target_dir}")
        
    except Exception as e:
        print(f"❌ Error during conversion: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
