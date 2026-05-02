"""
PDF/text soil log import using Anthropic Claude API.
Endpoint: POST /projects/{project_id}/soil-layers/import-pdf
Accepts multipart PDF upload, extracts text, parses with Claude.
"""
import os, sys
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models import Project
from auth import get_current_user
from routers.auth import limiter

router = APIRouter()

def extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        import pypdf
        import io
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()
    except ImportError:
        raise HTTPException(500, "pypdf kütüphanesi yüklü değil. 'pip install pypdf' çalıştırın.")
    except Exception as e:
        raise HTTPException(400, f"PDF okunamadı: {e}")

def parse_with_claude(text: str) -> list:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY ortam değişkeni tanımlı değil.")
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""Aşağıda bir zemin etüt raporu veya sondaj logu metni var.
Bu metinden zemin katmanlarını çıkar ve JSON dizisi olarak döndür.

Her eleman şu alanları içermeli:
- baslangic: float (başlangıç derinliği, metre)
- bitis: float (bitiş derinliği, metre)
- formasyon: string (formasyon/birim adı, raporda geçiyorsa — yoksa boş string)
- zemTipi: string (zemin tipi Türkçe: "Dolgu", "Kil", "Silt", "Kum", "Çakıl", "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya" veya rapordan okunan özgün isim)
- kohezyon: string ("Kohezyonlu", "Kohezyonsuz", veya "Kaya")
- spt: integer (SPT N değeri, 0 eğer belirtilmemişse)
- ucs: float (UCS MPa, 0 eğer belirtilmemişse)
- rqd: integer (RQD %, 0 eğer belirtilmemişse)
- aciklama: string (ek notlar varsa)

Sadece JSON dizisini döndür, başka hiçbir şey yazma. Dizi boşsa [] döndür.

Metin:
{text[:8000]}"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )

        import json, re
        content = message.content[0].text.strip()
        # Extract JSON array
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if not match:
            return []
        layers = json.loads(match.group())
        # Validate and clean
        clean = []
        for i, l in enumerate(layers):
            clean.append({
                "baslangic": float(l.get("baslangic") or 0),
                "bitis": float(l.get("bitis") or 0),
                "formasyon": str(l.get("formasyon") or ""),
                "zemTipi": str(l.get("zemTipi") or "Kil"),
                "kohezyon": str(l.get("kohezyon") or "Kohezyonlu"),
                "spt": int(l.get("spt") or 0),
                "ucs": float(l.get("ucs") or 0),
                "rqd": int(l.get("rqd") or 0),
                "aciklama": str(l.get("aciklama") or ""),
            })
        return clean
    except ImportError:
        raise HTTPException(500, "anthropic kütüphanesi yüklü değil.")
    except Exception as e:
        raise HTTPException(500, f"Claude API hatası: {e}")

@router.post("/projects/{project_id}/soil-layers/import-pdf")
@limiter.limit("5/minute")
async def import_soil_from_pdf(
    request: Request,
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(404, "Proje bulunamadı.")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Sadece PDF dosyası kabul edilir.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "PDF 10MB sınırını aşıyor.")

    text = extract_pdf_text(pdf_bytes)
    if len(text) < 50:
        raise HTTPException(400, "PDF'den metin çıkarılamadı. Taranmış/görüntü PDF olabilir.")

    layers = parse_with_claude(text)
    return {"katmanlar": layers, "ham_metin_uzunlugu": len(text)}
