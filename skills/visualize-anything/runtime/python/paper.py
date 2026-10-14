#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["beautifulsoup4>=4.12", "lxml>=5", "pymupdf>=1.24"]
# ///
"""
Paper ingestion for visualize-anything: a paper, read into the project before anything is written.

    uv run paper.py --source 2610.12374 --out <project>/paper
    uv run paper.py --source https://arxiv.org/abs/1706.03762 --out <project>/paper
    uv run paper.py --source ~/papers/attention.pdf --out <project>/paper

It writes:

    paper.json     the abstract and its claims, the sections, the figures, the tables, the licence
    paper.md       the same, for reading: the abstract first, then each section with its tables
    figures/       every figure, as an image

The abstract comes first and is kept whole. It is the authors' own account of what the paper is for
and which results matter, so it is split into its claims, each with the numbers it states, and the
storyboard is later held to it claim by claim.

An arXiv paper is read from arXiv's HTML edition when there is one: its sections, captions, and
tables are already marked up, so nothing has to be guessed. Otherwise, and for a local file, the
PDF is read: text by its layout, tables by their ruling, figures by cropping what sits above each
"Figure N" caption. That is good enough to read from and to check numbers against; look at each
cropped figure before using it.
"""
import argparse
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

AGENT = "visualize-anything/0.2 (paper ingestion; +https://github.com/VishnuKartha/visualize-anything)"


def fetch(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read(), response.geturl()


# The few TeX signs that carry meaning in a number: kept as the sign, where every other macro is dropped.
SIGNS = {**{f"\\{name}": letter for name, letter in zip("alpha beta gamma delta epsilon theta lambda mu rho sigma tau phi omega".split(), "αβγδεθλμρστφω")}, "\\times": "×", "\\approx": "≈", "\\sim": "~", "\\pm": "±", "\\leq": "≤", "\\geq": "≥", "\\le ": "≤ ", "\\ge ": "≥ ", "\\cdot": "·", "\\%": "%"}


def clean(text: str) -> str:
    """One line of plain prose: no leftover TeX macros, no runs of whitespace."""
    text = unicodedata.normalize("NFKC", text or "")  # ligatures and compatibility forms back to plain letters
    for macro, sign in SIGNS.items():
        text = text.replace(macro, sign)
    text = re.sub(r"\\[A-Za-z@]+\*?", " ", text)
    text = re.sub(r"\\[,;:! ]|[{}]", " ", text).replace("\\%", "%").replace("\\&", "&")
    text = re.sub(r"\s+", " ", text).strip()
    # Emphasised words come out of the markup with a space before the punctuation that followed them.
    return re.sub(r"\s+([,.;:!?)\]])", r"\1", re.sub(r"([(\[])\s+", r"\1", text))


NUMBER = re.compile(r"(?<![\w.])\d[\d,]*(?:\.\d+)?%?")


def claims_of(abstract: str) -> list[dict]:
    """The abstract, one sentence at a time, each with the numbers it states."""
    protected = re.sub(r"\b(e\.g|i\.e|et al|vs|Fig|Eq|cf|approx)\.", lambda m: m.group(0).replace(".", "\u2024"), abstract)
    sentences = [part.replace("\u2024", ".").strip() for part in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"(])", protected) if part.strip()]
    return [{"n": index + 1, "text": sentence, "numbers": NUMBER.findall(sentence)} for index, sentence in enumerate(sentences)]


def cited(text: str, kind: str) -> list[int]:
    pattern = r"(?:Figures?|Figs?\.?)\s*~?\s*(\d+)" if kind == "figure" else r"Tables?\s*~?\s*(\d+)"
    return sorted({int(number) for number in re.findall(pattern, text)})


# ---------------------------------------------------------------------------------------------
# arXiv


def arxiv_id(source: str) -> str | None:
    match = re.search(r"(?:arxiv\.org/(?:abs|pdf|html)/|^arxiv:|^)(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?/\d{7}(?:v\d+)?)(?:\.pdf)?/?$", source.strip(), re.I)
    return match.group(1) if match else None


def licence_of(identifier: str) -> dict:
    """What the authors let others do with the paper, as its arXiv page states it."""
    try:
        page, _ = fetch(f"https://arxiv.org/abs/{identifier}")
    except Exception:
        return {"url": None, "open": None}
    found = re.search(r'href="(https?://(?:creativecommons\.org/[^"]+|arxiv\.org/licenses/[^"]+))"', page.decode("utf-8", "replace"))
    url = found.group(1) if found else None
    # A Creative Commons licence lets a figure be reproduced with credit; arXiv's own licence only lets arXiv distribute the paper.
    return {"url": url, "open": bool(url and "creativecommons.org" in url and "/nd" not in url)}


def from_arxiv_html(identifier: str, out: Path) -> dict | None:
    from bs4 import BeautifulSoup

    try:
        raw, landed = fetch(f"https://arxiv.org/html/{identifier}")
    except Exception:
        return None
    soup = BeautifulSoup(raw, "lxml")
    if not soup.select_one(".ltx_document, .ltx_page_main"):
        return None
    base = soup.find("base")
    # Image addresses in the page are relative to it, exactly as a browser would resolve them.
    root = urljoin(landed, base["href"]) if base and base.get("href") else landed

    for junk in soup.select(".ltx_note, .ltx_tag_bibitem, .ltx_ERROR, annotation, script, style, button, nav"):
        junk.decompose()
    for formula in soup.select("math"):
        formula.replace_with(formula.get("alttext") or formula.get_text(" "))

    title = clean(soup.select_one("h1.ltx_title").get_text(" ")) if soup.select_one("h1.ltx_title") else ""
    authors = [clean(name.get_text(" ")) for name in soup.select(".ltx_authors .ltx_personname")]
    abstract_box = soup.select_one(".ltx_abstract")
    abstract = clean(" ".join(p.get_text(" ") for p in abstract_box.select("p"))) if abstract_box else ""

    figures_dir = out / "figures"
    figures, tables = [], []

    def numbered(node, kind: str, fallback: int) -> int:
        tag = node.select_one(f".ltx_tag_{kind}")
        found = re.search(r"(\d+)", tag.get_text() if tag else "")
        return int(found.group(1)) if found else fallback

    def caption_of(node) -> str:
        caption = node.select_one("figcaption")
        return re.sub(r"^(?:Figure|Fig\.?|Table)\s*\d+\s*[:.]?\s*", "", clean(caption.get_text(" "))) if caption else ""

    for node in soup.select("figure.ltx_table"):
        number = numbered(node, "table", len(tables) + 1)
        rows = [[clean(cell.get_text(" ")) for cell in row.select("th, td")] for row in node.select("tr")]
        rows = [row for row in rows if any(row)]
        if rows and not any(table["n"] == number for table in tables):
            tables.append({"n": number, "caption": caption_of(node), "columns": rows[0], "rows": rows[1:]})
    for node in soup.select("figure.ltx_figure"):
        if node.find_parent("figure", class_="ltx_figure"):
            continue  # a panel of a figure already taken whole
        number = numbered(node, "figure", len(figures) + 1)
        if any(figure["n"] == number for figure in figures):
            continue
        files = []
        for index, image in enumerate(node.select("img")):
            source = image.get("src")
            if not source or source.startswith("data:"):
                continue
            try:
                data, _ = fetch(urljoin(root, source))
            except Exception:
                continue
            suffix = Path(source.split("?")[0]).suffix.lower() or ".png"
            name = f"fig-{number}{'' if index == 0 else '-' + chr(97 + index)}{suffix}"
            figures_dir.mkdir(parents=True, exist_ok=True)
            (figures_dir / name).write_bytes(data)
            files.append(f"figures/{name}")
        figures.append({"n": number, "caption": caption_of(node), "file": files[0] if files else None, "files": files})

    sections = []
    for node in soup.select("section.ltx_section, section.ltx_appendix, section.ltx_bibliography"):
        heading = node.find(["h2", "h3"])
        for inner in node.select("figure"):
            inner.extract()
        text = clean(" ".join(block.get_text(" ") for block in node.select(".ltx_para, .ltx_bibitem, p") if not block.find_parent(class_="ltx_para") or block.name != "p"))
        kind = "references" if "ltx_bibliography" in node.get("class", []) else "appendix" if "ltx_appendix" in node.get("class", []) else "body"
        sections.append({"heading": clean(heading.get_text(" ")) if heading else "", "kind": kind, "text": text, "figures": cited(text, "figure"), "tables": cited(text, "table")})

    return {"source": f"https://arxiv.org/abs/{identifier}", "read_from": "arXiv HTML", "id": identifier, "title": title, "authors": authors, "abstract": abstract,
            "sections": sections, "figures": sorted(figures, key=lambda f: f["n"]), "tables": sorted(tables, key=lambda t: t["n"])}


# ---------------------------------------------------------------------------------------------
# LaTeX source: the tables the HTML edition lost

# arXiv's HTML edition is made by LaTeXML, which drops a table it cannot convert (one brought in by
# \input inside an appendix, say) and leaves only a missing label. The source the paper was built
# from has every table, so the tables the HTML lacks are read from it, numbered as LaTeX numbers them.


def uncommented(tex: str) -> str:
    r"""The TeX the paper prints: no % comments, nothing between \iffalse and \fi."""
    tex = re.sub(r"(?<!\\)%[^\n]*", "", tex)
    return re.sub(r"\\iffalse\b.*?\\fi\b", "", tex, flags=re.S)


def source_tree(identifier: str, out: Path) -> Path | None:
    """The paper's LaTeX source, unpacked into paper/source/. None when arXiv has no source for it."""
    import gzip, io, tarfile
    try:
        data, _ = fetch(f"https://arxiv.org/e-print/{identifier}")
    except Exception:
        return None
    root = out / "source"
    root.mkdir(parents=True, exist_ok=True)
    try:
        raw = gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data
    except OSError:
        return None
    try:
        with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
            try:
                archive.extractall(root, filter="data")
            except TypeError:  # Python before 3.11.4 has no extraction filter; keep only plain files inside root
                safe = [m for m in archive.getmembers() if (m.isfile() or m.isdir()) and not Path(m.name).is_absolute() and ".." not in Path(m.name).parts]
                archive.extractall(root, members=safe)
    except tarfile.TarError:
        if b"\\documentclass" not in raw:
            return None  # a PDF-only submission
        (root / "main.tex").write_bytes(raw)
    return root


def main_file(root: Path) -> Path | None:
    """The file LaTeX is run on: the one arXiv's 00README names as top level, else the document that pulls in the most others."""
    readme = root / "00README.json"
    if readme.is_file():
        try:
            for entry in json.loads(readme.read_text()).get("sources", []):
                if entry.get("usage") == "toplevel" and (root / entry.get("filename", "")).is_file():
                    return root / entry["filename"]
        except (ValueError, AttributeError):
            pass
    mains = []
    for file in root.rglob("*.tex"):
        text = uncommented(file.read_text("utf-8", "replace"))
        if "\\documentclass" in text and "\\begin{document}" in text:
            mains.append((len(re.findall(r"\\(?:input|include|subfile|import|subimport)\b", text)), len(text), file))
    return max(mains)[2] if mains else None


INCLUDE = re.compile(r"\\(?:input|include|subfile)\s*\{([^}]*)\}|\\input\s+([^\s{}\\]+)|\\(?:sub)?import\s*\{([^}]*)\}\s*\{([^}]*)\}")


def expanded(root: Path) -> str:
    r"""The main file with every \input, \include, and \import written out in place, as LaTeX reads them."""
    main = main_file(root)
    if main is None:
        return ""

    def expand(file: Path, depth: int, here: Path) -> str:
        text = uncommented(file.read_text("utf-8", "replace"))
        if depth > 12:
            return text

        def inline(match):
            if match.group(3) is not None:  # \import{dir}{file}: paths inside it are taken from dir
                folder = (here / match.group(3).strip()) if match.group(0).lstrip("\\").startswith("sub") else (root / match.group(3).strip())
                name, base = match.group(4).strip(), folder
            else:
                # LaTeX resolves \input from the folder it was run in, the main file's, wherever the \input is written.
                name, base = (match.group(1) or match.group(2)).strip(), main.parent
            for candidate in (base / name, base / f"{name}.tex"):
                if candidate.is_file():
                    return expand(candidate, depth + 1, candidate.parent)
            return ""
        return INCLUDE.sub(inline, text)
    tex = expand(main, 0, main.parent)
    # The paper's own short macros (\newcommand{\edis}{EDiS}) written out, so a name reads as the paper prints it.
    macros = {}
    for match in re.finditer(r"\\(?:re)?newcommand\*?\s*\{?\\([A-Za-z]+)\}?\s*(?=\{)|\\def\s*\\([A-Za-z]+)\s*(?=\{)", tex):
        body, _ = braced(tex, match.end())
        if "#" not in body and len(body) < 60:
            macros[match.group(1) or match.group(2)] = re.sub(r"\\xspace\b", "", re.sub(r"\\[A-Za-z]+\s*\{([^{}]*)\}", r"\1", body))
    for name, body in sorted(macros.items(), key=lambda item: -len(item[0])):
        tex = re.sub(r"\\" + name + r"(?![A-Za-z])(?:\{\})?", lambda _, body=body: body, tex)
    return tex


def braced(text: str, start: int) -> tuple[str, int]:
    """The contents of the {group} that opens at text[start], and the index after it."""
    depth, index = 0, start
    while index < len(text):
        escaped = index > 0 and text[index - 1] == "\\"
        if text[index] == "{" and not escaped:
            depth += 1
        elif text[index] == "}" and not escaped:
            depth -= 1
            if depth == 0:
                return text[start + 1:index], index + 1
        index += 1
    return text[start + 1:], len(text)


def top_level_split(text: str, separator: str) -> list[str]:
    r"""Split at a separator that is not inside a {group}: a \\\\ inside \makecell{a\\\\b} is a line break in one cell, not a new row."""
    parts, depth, last, index = [], 0, 0, 0
    while index < len(text):
        char = text[index]
        if char == "{" and text[index - 1:index] != "\\":
            depth += 1
        elif char == "}" and text[index - 1:index] != "\\":
            depth -= 1
        elif depth == 0 and text.startswith(separator, index) and (separator != "&" or text[index - 1:index] != "\\"):
            parts.append(text[last:index])
            index += len(separator)
            if separator == "\\\\" and text[index:index + 1] == "[":  # \\[2pt]
                index = text.find("]", index) + 1 or index
            last = index
            continue
        index += 1
    parts.append(text[last:])
    return parts


def cell_text(cell: str) -> str:
    """One table cell as it reads: the shading, emphasis, and sizes dropped, ± and the like kept."""
    cell = re.sub(r"\\(?:cellcolor|rowcolor|color)(?:\[[^\]]*\])?\{[^}]*\}", "", cell)
    cell = re.sub(r"\\multi(?:column|row)\{[^}]*\}\{[^}]*\}", "", cell)
    cell = re.sub(r"\\(?:scriptsize|footnotesize|small|tiny|normalsize|bfseries|itshape|centering)\b", "", cell)
    cell = re.sub(r"\$\^\{?\\dagger\}?\$|\^\\dagger", "", cell)
    cell = cell.replace("\\\\", " ")
    return clean(cell.replace("$", "").replace("~", " "))


RULES = re.compile(r"\\(?:toprule|midrule|bottomrule|hline|specialrule\{[^}]*\}\{[^}]*\}\{[^}]*\}|cline\{[^}]*\}|cmidrule(?:\([^)]*\))?\{[^}]*\}|addlinespace(?:\[[^\]]*\])?|endfirsthead|endhead|endfoot|endlastfoot)")


def tabular_rows(body: str) -> list[list[str]]:
    rows = []
    for line in top_level_split(RULES.sub("", body), "\\\\"):
        line = re.sub(r"\\rowcolor(?:\[[^\]]*\])?\{[^}]*\}", "", line)
        cells = [cell_text(cell) for cell in top_level_split(line, "&")]
        if any(cells):
            rows.append(cells)
    return rows


TABULAR = re.compile(r"\\begin\{(tabular\*?|tabularx|tabulary|longtable\*?|NiceTabular\*?|tblr)\}")
WIDTH_FIRST = {"tabular*", "tabularx", "tabulary", "NiceTabular*"}


def tabulars_in(body: str) -> list[tuple[int, list[list[str]]]]:
    """Each tabular in a stretch of TeX, with where it starts and its rows."""
    found = []
    for match in TABULAR.finditer(body):
        name = match.group(1)
        end = body.find(f"\\end{{{name}}}", match.end())
        head = body[match.end():end if end >= 0 else len(body)]
        index = 0
        # Skip an optional [t] and the width (tabular*, tabularx), then the column spec, each a {group}.
        for _ in range(2 if name in WIDTH_FIRST else 1):
            while head[index:index + 1].isspace():
                index += 1
            if head[index:index + 1] == "[":
                index = head.find("]", index) + 1
            index = head.find("{", index)
            if index < 0:
                break
            _, index = braced(head, index)
        if name.startswith("longtable"):  # its captions are rows of the table; take them out
            head = re.sub(r"\\caption\*?(?:\[[^\]]*\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*(?:\\\\)?", "", head)
        found.append((match.start(), tabular_rows(head[max(index, 0):])))
    return found


def source_tables(tex: str) -> list[dict]:
    r"""
    Every numbered table in the order LaTeX numbers them, each with its caption and the rows of its tabular.

    LaTeX steps the table counter at each \caption inside a table, table*, wraptable, or longtable, and
    at each \captionof{table}. A \caption* is unnumbered, and a caption inside a subtable labels a part
    of its table, so neither counts.
    """
    found = []
    tex = re.sub(r"\\begin\{subtable\}.*?\\end\{subtable\}", lambda m: re.sub(r"\\caption", r"\\subcaption", m.group(0)), tex, flags=re.S)
    events = re.compile(r"\\begin\{(table\*?|wraptable|longtable\*?)\}|\\captionof\s*\{table\}(?:\[[^\]]*\])?\s*(?=\{)")
    position = 0
    while True:
        match = events.search(tex, position)
        if not match:
            break
        if match.group(1):
            name = match.group(1)
            end = tex.find(f"\\end{{{name}}}", match.end())
            end = len(tex) if end < 0 else end
            body = tex[match.end():end]
            scope = tex[match.start():end] if name.startswith("longtable") else body
            captions = []
            for caption in re.finditer(r"\\caption(?!\*)(?:of\s*\{table\})?(?:\[[^\]]*\])?\s*(?=\{)", body):
                text, _ = braced(body, caption.end())
                captions.append((caption.start(), clean(text.replace("$", ""))))
            if name.startswith("longtable"):
                captions = captions[:1]  # a longtable repeats its caption on each page; it is one table
            tabulars = tabulars_in(scope)
            for index, (at, caption) in enumerate(captions):
                # A table with one caption and several tabulars (subtables, panels) is one table: its rows are all of theirs, in order.
                rows = tabulars[index][1] if len(captions) > 1 and index < len(tabulars) else ([row for _, part in tabulars for row in part] if len(captions) == 1 else [])
                found.append({"caption": caption, "rows": rows})
            position = end + 1
        else:
            # \captionof{table} outside a float: the tabular it labels sits in the same minipage, just before or after it.
            text, after = braced(tex, match.end())
            before = tex.rfind("\\begin{minipage}", 0, match.start())
            close = tex.find("\\end{minipage}", match.end())
            scope = tex[before:close] if before >= 0 and close >= 0 and close - before < 20000 else tex[max(0, match.start() - 4000):after + 4000]
            tabulars = tabulars_in(scope)
            found.append({"caption": clean(text.replace("$", "")), "rows": tabulars[0][1] if len(tabulars) == 1 else []})
            position = after
    return found


def caption_words(caption: str) -> set[str]:
    return {word for word in re.findall(r"[a-z]{4,}", caption.lower())}


def add_source_tables(paper: dict, identifier: str, out: Path) -> None:
    r"""
    Add the tables that the HTML edition lost, read from the LaTeX source.

    The source is numbered by counting captions as LaTeX does, so its numbers are the PDF's, the ones a
    reader cites. The two editions are first held against each other on the tables both have. When
    most agree, the source's numbering is trusted: a missing table is added, and where the two give the
    same number to different tables (LaTeXML can number a figure's caption as a table), the source's
    table replaces the HTML's and the conflict is recorded. When most disagree, or the paper renumbers
    its tables by hand (\setcounter, a supplement's "S1"), nothing is added.
    """
    paper["tables_from_source"], paper["table_conflicts"] = 0, []
    root = source_tree(identifier, out)
    tex = expanded(root) if root else ""
    if not tex or re.search(r"\\(?:setcounter\{table\}|renewcommand\{?\\thetable)", tex):
        return
    numbered = dict(enumerate(source_tables(tex), start=1))

    def same(a: str, b: str) -> bool:
        x, y = caption_words(a), caption_words(b)
        return not x or not y or len(x & y) >= 0.5 * min(len(x), len(y))
    shared = [table for table in paper["tables"] if table["n"] in numbered]
    agree = [table for table in shared if same(table["caption"], numbered[table["n"]]["caption"])]
    if not shared or len(agree) < 0.75 * len(shared):
        return
    by_number = {table["n"]: table for table in paper["tables"]}
    for number, table in numbered.items():
        if len(table["rows"]) < 2:
            continue
        entry = {"n": number, "caption": re.sub(r"^Table\s*\d+\s*[:.]\s*", "", table["caption"]), "columns": table["rows"][0], "rows": table["rows"][1:], "read_from": "LaTeX source"}
        if number not in by_number:
            by_number[number] = entry
            paper["tables_from_source"] += 1
        elif not same(by_number[number]["caption"], table["caption"]):
            paper["table_conflicts"].append({"n": number, "html": by_number[number]["caption"][:120], "source": entry["caption"][:120]})
            by_number[number] = entry
            paper["tables_from_source"] += 1
    paper["tables"] = sorted(by_number.values(), key=lambda t: t["n"])


# ---------------------------------------------------------------------------------------------
# PDF

HEADING = re.compile(r"^(?:(\d{1,2}(?:\.\d{1,2})*)\.?\s+)?([A-Z][A-Za-z0-9 ,:&/()'\-]{2,70})$")
BACK_MATTER = re.compile(r"^(?:references|bibliography|acknowledge?ments?|appendix\b|appendices|supplementary)", re.I)


def from_pdf(pdf: Path, out: Path, source: str) -> dict:
    import pymupdf as fitz

    document = fitz.open(pdf)
    lines = []  # every line of the paper, with where it is and how it is set
    for page_index, page in enumerate(document):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [span for span in line["spans"] if span["text"].strip()]
                # Text set sideways is a margin stamp (arXiv's own, down the left edge), not the paper.
                if spans and abs(line.get("dir", (1, 0))[0] - 1) < 0.01:
                    lines.append({"page": page_index, "text": clean(" ".join(span["text"] for span in spans)), "size": max(span["size"] for span in spans),
                                  "bold": all("bold" in span["font"].lower() or span["flags"] & 16 for span in spans), "bbox": fitz.Rect(line["bbox"])})
    # The body size is the one most of the words are set in; the many small labels inside figures do not get a vote each.
    weight = {}
    for line in lines:
        weight[round(line["size"], 1)] = weight.get(round(line["size"], 1), 0) + len(line["text"])
    body = max(weight, key=weight.get) if weight else 10

    first = [line for line in lines if line["page"] == 0]
    largest = max((line["size"] for line in first), default=body)
    title = clean(" ".join(line["text"] for line in first if line["size"] >= largest - 0.5))

    def is_heading(line) -> bool:
        match = HEADING.match(line["text"])
        if not match or len(line["text"].split()) > 10:
            return False
        return bool(match.group(1)) and (line["bold"] or line["size"] > body + 0.4) or (line["bold"] and line["size"] > body + 0.4) or bool(BACK_MATTER.match(line["text"]) and (line["bold"] or line["size"] > body + 0.4))

    abstract, sections, current, seen_abstract, abstract_size, abstract_done = [], [], None, False, None, False
    for line in lines:
        if not seen_abstract and re.match(r"^abstract\b", line["text"], re.I):
            seen_abstract = True
            rest = re.sub(r"^abstract[\s:.\u2014-]*", "", line["text"], flags=re.I)
            if rest:
                abstract.append(rest)
                abstract_size = line["size"]
            continue
        if is_heading(line) and (seen_abstract or sections or line["page"] > 0 or re.match(r"^(?:1\.?\s+)?introduction", line["text"], re.I)):
            kind = "references" if re.match(r"^(?:references|bibliography)", line["text"], re.I) else "appendix" if (current and current["kind"] != "body") or BACK_MATTER.match(line["text"]) else "body"
            current = {"heading": line["text"], "kind": kind, "lines": []}
            sections.append(current)
            continue
        if current is not None:
            current["lines"].append(line["text"])
        elif seen_abstract and not abstract_done:
            # The abstract is one run of lines in one size. The first line set differently (a date,
            # a footnote, the labels inside a teaser figure) is where it ends.
            abstract_size = abstract_size or line["size"]
            if abs(line["size"] - abstract_size) > 0.3:
                abstract_done = True
            else:
                abstract.append(line["text"])

    def joined(parts) -> str:
        return clean(re.sub(r"(\w)- (\w)", r"\1\2", " ".join(parts)))

    out_sections = []
    for section in sections:
        text = joined(section["lines"])
        out_sections.append({"heading": section["heading"], "kind": section["kind"], "text": text, "figures": cited(text, "figure"), "tables": cited(text, "table")})

    figures, tables = [], []
    figures_dir = out / "figures"
    for page_index, page in enumerate(document):
        page_lines = [line for line in lines if line["page"] == page_index]
        # "Figure 3: ..." or, set without a colon, "Figure 3  A coding agent..." in the smaller caption size.
        captions = [line for line in page_lines if re.match(r"^(?:Figure|Fig\.?)\s*\d+\s*[:.|]", line["text"]) or (re.match(r"^(?:Figure|Fig\.?)\s*\d+\s+[A-Z]", line["text"]) and line["size"] < body - 0.3)]
        # Everything drawn on the page that is not text: pictures, and the strokes of charts and diagrams.
        drawn = [fitz.Rect(image["bbox"]) for image in page.get_image_info()]
        try:
            drawn += [fitz.Rect(cluster) for cluster in page.cluster_drawings()]
        except Exception:
            pass
        drawn = [rect for rect in drawn if rect.width > 30 and rect.height > 30]
        claimed_until = {}
        for caption in sorted(captions, key=lambda line: line["bbox"].y0):
            number = int(re.search(r"\d+", caption["text"]).group(0))
            if any(figure["n"] == number for figure in figures):
                continue
            box, column = caption["bbox"], None
            # A figure belongs to the caption under it, in the same column, and to no caption above that one.
            ceiling = max((bottom for (x0, x1), bottom in claimed_until.items() if x0 < box.x1 and x1 > box.x0), default=page.rect.y0)
            above = [rect for rect in drawn if rect.y1 <= box.y0 + 4 and rect.y0 >= ceiling - 2 and rect.x1 > box.x0 - 40 and rect.x0 < box.x1 + 40 and box.y0 - rect.y1 < 260]
            text = joined(line["text"] for line in page_lines if line["bbox"].y0 >= box.y0 - 1 and line["bbox"].y0 < box.y0 + 60 and abs(line["bbox"].x0 - box.x0) < 20)
            entry = {"n": number, "caption": re.sub(r"^(?:Figure|Fig\.?)\s*\d+\s*[:.|]?\s*", "", text), "file": None, "files": [], "page": page_index + 1}
            if above:
                column = fitz.Rect(above[0])
                for rect in above[1:]:
                    column |= rect
                column = (column + (-6, -6, 6, 6)) & page.rect
                figures_dir.mkdir(parents=True, exist_ok=True)
                name = f"fig-{number}.png"
                page.get_pixmap(clip=column, dpi=200).save(figures_dir / name)
                entry.update(file=f"figures/{name}", files=[f"figures/{name}"])
            claimed_until[(box.x0, box.x1)] = box.y1
            figures.append(entry)
        try:
            found = page.find_tables().tables
        except Exception:
            found = []
        for table in found:
            rows = [[clean(cell or "") for cell in row] for row in table.extract()]
            rows = [row for row in rows if any(row)]
            if len(rows) < 2:
                continue
            rect = fitz.Rect(table.bbox)
            near = sorted((line for line in page_lines if re.match(r"^Table\s*\d+\s*[:.|]", line["text"])), key=lambda line: min(abs(line["bbox"].y1 - rect.y0), abs(line["bbox"].y0 - rect.y1)))
            number = int(re.search(r"\d+", near[0]["text"]).group(0)) if near else len(tables) + 1
            if any(existing["n"] == number for existing in tables):
                continue
            tables.append({"n": number, "caption": re.sub(r"^Table\s*\d+\s*[:.|]\s*", "", near[0]["text"]) if near else "", "columns": rows[0], "rows": rows[1:], "page": page_index + 1})

    return {"source": source, "read_from": "PDF", "id": None, "title": title, "authors": [], "abstract": joined(abstract), "sections": out_sections,
            "figures": sorted(figures, key=lambda f: f["n"]), "tables": sorted(tables, key=lambda t: t["n"])}


# ---------------------------------------------------------------------------------------------


def markdown(paper: dict) -> str:
    out = [f"# {paper['title']}", ""]
    if paper["authors"]:
        out += [", ".join(paper["authors"]), ""]
    out += [f"Source: {paper['source']} (read from {paper['read_from']})", ""]
    out += ["## Abstract", "", "The authors' own account of what this paper is for and which results matter. Start here: the hook, the focus, and what the video covers come from these claims before anything in the body.", ""]
    for claim in paper["claims"]:
        stated = f"  _(states {', '.join(claim['numbers'])})_" if claim["numbers"] else ""
        out.append(f"{claim['n']}. {claim['text']}{stated}")
    out.append("")
    tables = {table["n"]: table for table in paper["tables"]}
    figures = {figure["n"]: figure for figure in paper["figures"]}
    placed = set()
    for section in paper["sections"]:
        if section["kind"] == "references":
            continue
        out += [f"## {section['heading']}" + (" (appendix)" if section["kind"] == "appendix" else ""), "", section["text"], ""]
        for number in section["figures"]:
            if number in figures:
                figure = figures[number]
                out += [f"> Figure {number}: {figure['caption']}" + (f"  (`{figure['file']}`)" if figure["file"] else "  (no image could be taken)"), ""]
        for number in section["tables"]:
            if number in tables and number not in placed:
                placed.add(number)
                table = tables[number]
                width = max(len(table["columns"]), *(len(row) for row in table["rows"])) if table["rows"] else len(table["columns"])
                pad = lambda row: [cell.replace("|", "/") for cell in row] + [""] * (width - len(row))
                out += [f"**Table {number}.** {table['caption']}", "", "| " + " | ".join(pad(table["columns"])) + " |", "|" + "---|" * width]
                out += ["| " + " | ".join(pad(row)) + " |" for row in table["rows"]]
                out.append("")
    loose = [table for number, table in sorted(tables.items()) if number not in placed]
    if loose:
        out += ["## Tables not cited in the text above", "", "Read from the paper's LaTeX source where the HTML edition lost them. Their numbers are LaTeX's own, so they match the PDF.", ""]
        for table in loose:
            width = max(len(table["columns"]), *(len(row) for row in table["rows"])) if table["rows"] else len(table["columns"])
            pad = lambda row: [cell.replace("|", "/") for cell in row] + [""] * (width - len(row))
            out += [f"**Table {table['n']}.** {table['caption']}", "", "| " + " | ".join(pad(table["columns"])) + " |", "|" + "---|" * width]
            out += ["| " + " | ".join(pad(row)) + " |" for row in table["rows"]]
            out.append("")
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    identifier = arxiv_id(args.source)
    local = Path(args.source).expanduser()
    paper = None
    if identifier and not local.exists():
        paper = from_arxiv_html(identifier, out)
        if paper is not None:
            # The HTML edition can lose tables it could not convert; the source has them.
            add_source_tables(paper, identifier, out)
        if paper is None:
            data, _ = fetch(f"https://arxiv.org/pdf/{identifier}")
            (out / "paper.pdf").write_bytes(data)
            paper = from_pdf(out / "paper.pdf", out, f"https://arxiv.org/abs/{identifier}")
            paper["id"] = identifier
        paper["licence"] = licence_of(identifier)
    elif local.exists() and local.suffix.lower() == ".pdf":
        paper = from_pdf(local, out, str(local))
        paper["licence"] = {"url": None, "open": None}
    else:
        sys.exit(f"paper: cannot read {args.source!r}. Give an arXiv id (2610.12374), an arXiv address, or the path of a PDF.")

    if not paper["abstract"]:
        sys.exit("paper: no abstract was found, and the abstract is what the video is planned from. If this is a PDF without one, add it to paper.json by hand and rerun the check.")
    paper["claims"] = claims_of(paper["abstract"])
    (out / "paper.json").write_text(json.dumps(paper, indent=2, ensure_ascii=False) + "\n")
    (out / "paper.md").write_text(markdown(paper) + "\n")
    print(json.dumps({"title": paper["title"], "read_from": paper["read_from"], "claims": len(paper["claims"]), "sections": len([s for s in paper["sections"] if s["kind"] == "body"]),
                      "figures": len(paper["figures"]), "figures_saved": len([f for f in paper["figures"] if f["file"]]), "tables": len(paper["tables"]), "tables_from_source": paper.get("tables_from_source", 0), "table_conflicts": paper.get("table_conflicts", []), "licence": paper["licence"]}))


if __name__ == "__main__":
    main()
