"""生成 fixtures/sample.pdf：两页、纯 ASCII、逐字节可复现（只用标准库）。

第 1 页：标题 AIHW Fixture Sheet 01、校验码 MMP-7Q4、一张 3 行物料表；
第 2 页：附录，校验码 MMP-2B8，用来检查 Agent 是否读对页。
页面文字一律写成十六进制字符串：文件里搜不到明文，答对只能靠渲染或文本抽取，不能靠把原始字节塞给模型。
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "fixtures" / "sample.pdf"

PAGE_W, PAGE_H = 595, 842  # A4，单位 pt

TABLE_HEAD = ("Item", "Qty", "Unit")
TABLE_ROWS = (
    ("Camera module", "1", "pcs"),
    ("Microphone", "2", "pcs"),
    ("Battery", "410", "mAh"),
)


def _text(font: str, size: int, x: int, y: int, s: str) -> str:
    return f"BT /{font} {size} Tf {x} {y} Td <{s.encode('cp1252').hex().upper()}> Tj ET"


def page1() -> str:
    ops = [
        _text("F2", 24, 72, 760, "AIHW Fixture Sheet 01"),
        _text("F1", 12, 72, 730, "aihw-starter / 02 AI glasses / mm-plugins-core fixture"),
        _text("F1", 12, 72, 706, "Check code: MMP-7Q4"),
    ]
    left, top, row_h = 72, 680, 24
    cols = (72, 300, 400, 500)
    rows = (TABLE_HEAD, *TABLE_ROWS)
    bottom = top - row_h * len(rows)
    ops.append("0.6 w")
    for i in range(len(rows) + 1):
        y = top - row_h * i
        ops.append(f"{left} {y} m {cols[-1]} {y} l S")
    for x in cols:
        ops.append(f"{x} {top} m {x} {bottom} l S")
    for i, row in enumerate(rows):
        y = top - row_h * i - 16
        font = "F2" if i == 0 else "F1"
        for x, cell in zip(cols, row):
            ops.append(_text(font, 12, x + 8, y, cell))
    return "\n".join(ops)


def page2() -> str:
    return "\n".join(
        [
            _text("F2", 18, 72, 760, "Appendix"),
            _text("F1", 12, 72, 730, "Check code on this page: MMP-2B8"),
        ]
    )


def build() -> bytes:
    contents = [page1(), page2()]
    objs: list[str] = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    ]
    font_ref = "<< /F1 5 0 R /F2 6 0 R >>"
    for i in range(len(contents)):
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font {font_ref} >> /Contents {7 + i} 0 R >>"
        )
    objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    for stream in contents:
        data = stream.encode("ascii")
        objs.append(f"<< /Length {len(data)} >>\nstream\n{stream}\nendstream")
    objs.append("<< /Producer (aihw-starter make_fixture.py) >>")

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{n} 0 obj\n{body}\nendobj\n".encode("ascii")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode("ascii")
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R /Info {len(objs)} 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode("ascii")
    return bytes(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--check", action="store_true", help="只比对，不写文件；不一致时退出码 1")
    args = ap.parse_args()
    data = build()
    digest = hashlib.sha256(data).hexdigest()
    if args.check:
        same = args.out.exists() and args.out.read_bytes() == data
        print(f"{'一致' if same else '不一致'}：{args.out.name} sha256={digest}")
        raise SystemExit(0 if same else 1)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(data)
    print(f"已写入 {args.out}（{len(data)} 字节，sha256={digest}）")


if __name__ == "__main__":
    main()
