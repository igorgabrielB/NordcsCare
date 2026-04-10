#!/usr/bin/env python3
"""Batch OCR for SpotVision PDFs - loads model ONCE, processes many images.
Usage:
  Single:  python3 spotvision_ocr.py <image_path>
  Batch:   python3 spotvision_ocr.py --batch <img1> <img2> ...
  Stdin:   python3 spotvision_ocr.py --batch-stdin   (reads paths from stdin, one per line)
Output: JSON (single object or array)
"""
import sys, json, os, re

def create_ocr():
    from rapidocr_onnxruntime import RapidOCR
    return RapidOCR()

def extract_info(ocr, img_path):
    # Crop top 40% of image for faster OCR (patient info is in the upper portion)
    try:
        from PIL import Image
        img = Image.open(img_path)
        w, h = img.size
        crop_h = int(h * 0.40)
        cropped = img.crop((0, 0, w, crop_h))
        crop_path = img_path + '.crop.png'
        cropped.save(crop_path)
        result, _ = ocr(crop_path)
        os.unlink(crop_path)
    except Exception:
        result, _ = ocr(img_path)

    if not result:
        return {"nome": None, "sobrenome": None, "nome_completo": None, "individuo_id": None}

    texts = [r[1] for r in result]
    nome = None
    sobrenome = None
    individuo_id = None

    for i, t in enumerate(texts):
        t_upper = t.strip().upper()
        if t_upper == "NOME" and i + 1 < len(texts):
            nome = texts[i + 1].strip()
        elif t_upper == "SOBRENOME" and i + 1 < len(texts):
            sobrenome = texts[i + 1].strip()
        elif "ID" in t_upper and "INDIVIDUO" in t_upper:
            # ID may be in same string (e.g. "ID DOINDIVIDUO264314") or next line
            nums = re.findall(r'\d{4,}', t)
            if nums:
                individuo_id = nums[0]
            elif i + 1 < len(texts):
                nums2 = re.findall(r'\d{4,}', texts[i + 1])
                if nums2:
                    individuo_id = nums2[0]

    nome_completo = " ".join(filter(None, [nome, sobrenome]))
    return {
        "nome": nome,
        "sobrenome": sobrenome,
        "nome_completo": nome_completo or None,
        "individuo_id": individuo_id,
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: spotvision_ocr.py [--batch|--batch-stdin] <image_path> ..."}))
        sys.exit(1)

    batch_mode = sys.argv[1] in ('--batch', '--batch-stdin')

    if sys.argv[1] == '--batch-stdin':
        paths = [l.strip() for l in sys.stdin if l.strip()]
    elif sys.argv[1] == '--batch':
        paths = sys.argv[2:]
    else:
        paths = [sys.argv[1]]

    if not paths:
        print(json.dumps({"error": "No images provided"}))
        sys.exit(1)

    # Load model ONCE
    ocr = create_ocr()

    results = []
    for p in paths:
        if not os.path.exists(p):
            results.append({"file": p, "error": f"File not found: {p}"})
            continue
        try:
            info = extract_info(ocr, p)
            info["file"] = p
            results.append(info)
        except Exception as e:
            results.append({"file": p, "error": str(e)})

    if batch_mode:
        print(json.dumps(results, ensure_ascii=False))
    else:
        # Single mode: output just the data (backward compatible)
        r = results[0]
        r.pop("file", None)
        print(json.dumps(r, ensure_ascii=False))
