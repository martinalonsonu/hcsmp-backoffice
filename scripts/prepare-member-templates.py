"""Prepare fillable copies of the supplied Word forms, keeping their page layout.

Run with paths to the original adult and minor DOCX files. Only response lines,
checkbox contents and category labels are adapted; headings, page borders,
photos' frames and handwritten signature areas remain in place.
"""
from pathlib import Path
import argparse
import json
import re
import subprocess
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'v': 'urn:schemas-microsoft-com:vml',
}
def tag(name):
    prefix, local = name.split(':')
    return '{' + NS[prefix] + '}' + local

def child(parent, name, **attrs):
    return E.SubElement(parent, tag(name), {tag(k) if ':' in k else k: str(v) for k, v in attrs.items()})

def paragraph(text, size='22', center=False):
    p = E.Element(tag('w:p'))
    pp = child(p, 'w:pPr')
    child(pp, 'w:spacing', **{'w:before': '0', 'w:after': '0', 'w:line': '240', 'w:lineRule': 'auto'})
    if center: child(pp, 'w:jc', **{'w:val': 'center'})
    r = child(p, 'w:r'); rp = child(r, 'w:rPr')
    child(rp, 'w:rFonts', **{'w:ascii': 'Arial', 'w:hAnsi': 'Arial'})
    child(rp, 'w:sz', **{'w:val': size}); child(rp, 'w:szCs', **{'w:val': size})
    t = child(r, 'w:t'); t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve'); t.text = text
    return p

def anchor(root, name):
    return root.xpath('.//wp:anchor[wp:docPr[@name=$name]]', namespaces=NS, name=name)[0]

def alternate(a): return a.xpath('ancestor::mc:AlternateContent[1]', namespaces=NS)[0]

def fill_shape(a, lines, size='22', center=False):
    wsp = a.find('.//wps:wsp', NS)
    # Connector lines become invisible rectangular text boxes in the exact answer area.
    for name in ['wps:cNvCnPr', 'wps:cNvSpPr', 'wps:txbx', 'wps:bodyPr']:
        for old in list(wsp.findall(name, NS)): wsp.remove(old)
    wsp.insert(0, E.Element(tag('wps:cNvSpPr'), txBox='1'))
    sp = wsp.find('wps:spPr', NS)
    for old in list(sp):
        if old.tag != tag('a:xfrm'): sp.remove(old)
    geom = child(sp, 'a:prstGeom', prst='rect'); child(geom, 'a:avLst')
    child(sp, 'a:noFill'); child(child(sp, 'a:ln'), 'a:noFill')
    tx = child(wsp, 'wps:txbx'); content = child(tx, 'w:txbxContent')
    for line in lines: content.append(paragraph(line, size, center))
    body = child(wsp, 'wps:bodyPr', lIns='0', rIns='0', tIns='0', bIns='0', anchor='ctr', wrap='square', vertOverflow='overflow')
    child(body, 'a:noAutofit')
    fallback = alternate(a).find('mc:Fallback', NS)
    pict = fallback.find('w:pict', NS)
    for old in list(pict): pict.remove(old)
    x = int(a.find('wp:positionH/wp:posOffset', NS).text) / 12700
    y = int(a.find('wp:positionV/wp:posOffset', NS).text) / 12700
    extent = a.find('wp:extent', NS)
    width = int(extent.get('cx')) / 12700; height = int(extent.get('cy')) / 12700
    shape = child(pict, 'v:shape', id=a.find('wp:docPr', NS).get('name'), type='#_x0000_t202', style=f'position:absolute;margin-left:{x}pt;margin-top:{y}pt;width:{width}pt;height:{height}pt;z-index:251680000;v-text-anchor:middle;mso-position-horizontal-relative:text;mso-position-vertical-relative:text', filled='f', stroked='f')
    box = child(shape, 'v:textbox', inset='0,0,0,0'); fallback_content = child(box, 'w:txbxContent')
    for line in lines: fallback_content.append(paragraph(line, size, center))

def response(root, name, key):
    a = anchor(root, name)
    y = a.find('wp:positionV/wp:posOffset', NS)
    # Text baseline sits where the printed dotted response line was.
    y.text = str(int(y.text) - 165100)
    a.find('wp:extent', NS).set('cy', '254000')
    a.find('.//a:xfrm/a:ext', NS).set('cy', '254000')
    fill_shape(a, ['{{' + key + '}}'], '{{' + key + '_SIZE}}')

def checkbox(root, name, key):
    a = anchor(root, name)
    # Keep the original rectangle border while adding centered X in both renderings.
    wsp = a.find('.//wps:wsp', NS)
    tx = child(wsp, 'wps:txbx'); content = child(tx, 'w:txbxContent'); content.append(paragraph('{{' + key + '}}', '26', True))
    body = wsp.find('wps:bodyPr', NS)
    wsp.remove(tx)
    wsp.insert(list(wsp).index(body), tx)
    body.set('anchor', 'ctr')
    for key_ in ['lIns', 'rIns', 'tIns', 'bIns']: body.set(key_, '0')
    shape = alternate(a).find('mc:Fallback/w:pict', NS)[-1]
    shape.set('style', shape.get('style', '').replace('v-text-anchor:top', 'v-text-anchor:middle'))
    box = child(shape, 'v:textbox', inset='0,0,0,0'); fallback_content = child(box, 'w:txbxContent'); fallback_content.append(paragraph('{{' + key + '}}', '26', True))

def prepare(source, target, minor):
    with ZipFile(source) as z: files = {name: z.read(name) for name in z.namelist()}
    root = E.fromstring(files['word/document.xml'])
    answers = {
        'Conector recto 3': 'FULL_NAME_FIRST', 'Conector recto 4': 'FULL_NAME_LAST',
        'Conector recto 5': 'ADDRESS', 'Conector recto 6': 'BIRTH_DATE',
        'Conector recto 7': 'AGE', 'Conector recto 8': 'PHONE',
        'Conector recto 9': 'EMAIL', 'Conector recto 10': 'JOINED_AT',
        'Conector recto 21': 'SWORN_AT', 'Conector recto 22': 'OCCUPATION',
        'Conector recto 11': 'MARITAL_STATUS', 'Conector recto 12': 'DNI',
    }
    if minor:
        answers.update({
            'Conector recto 19': 'GUARDIAN_NAME_FIRST', 'Conector recto 20': 'GUARDIAN_NAME_LAST',
            'Conector recto 34': 'GUARDIAN_EDUCATION', 'Conector recto 35': 'GUARDIAN_ADDRESS',
            'Conector recto 36': 'GUARDIAN_DNI', 'Conector recto 37': 'GUARDIAN_PHONE',
            'Conector recto 38': 'GUARDIAN_AGE', 'Conector recto 39': 'GUARDIAN_RELATIONSHIP',
        })
    for shape, key in answers.items(): response(root, shape, key)
    checks = {'Rectángulo 28': 'BAPTISM', 'Rectángulo 29': 'CONFIRMATION', 'Rectángulo 30': 'COMMUNION', 'Rectángulo 31': 'MARRIAGE'}
    if minor: checks.update({'Rectángulo 14': 'GUARDIAN_BAPTISM', 'Rectángulo 15': 'GUARDIAN_CONFIRMATION', 'Rectángulo 16': 'GUARDIAN_COMMUNION'})
    for shape, key in checks.items(): checkbox(root, shape, key)
    for name in ['Rectángulo 32', 'Rectángulo 33']:
        alt = alternate(anchor(root, name)); alt.getparent().remove(alt)
    fill_shape(anchor(root, 'Cuadro de texto 25'), ['Categoría: {{CATEGORY}}', 'Estado: {{STATUS}}', '{{LIFECYCLE_DATE}}'], '19')
    photo = anchor(root, 'Rectángulo 1')
    fill = photo.find('.//wps:spPr/a:noFill', NS); parent = fill.getparent(); parent.replace(fill, E.Comment('HCSMP_PHOTO_FILL'))
    vphoto = alternate(photo).find('mc:Fallback/w:pict', NS)[-1]
    vphoto.set('filled', '{{PHOTO_FILLED}}'); vphoto.append(E.Comment('HCSMP_VML_PHOTO'))
    for text in root.findall('.//w:t', NS):
        if text.text == 'FOTO': text.text = '{{PHOTO_LABEL}}'
    # Mark the exact supplied template variant; fail loudly if a caller mixes it up.
    root.insert(0, E.Comment('HCSMP_TEMPLATE_MINOR' if minor else 'HCSMP_TEMPLATE_ADULT'))
    files['word/document.xml'] = E.tostring(root, encoding='UTF-8', xml_declaration=True, standalone=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, 'w', ZIP_DEFLATED) as z:
        for name, data in files.items(): z.writestr(name, data)

def prepare_pdf_templates(project, coordinates_path=None):
    """Render fixed PDF backgrounds and measure fields from short marker values.

    Requires LibreOffice (soffice) and PyMuPDF only for this source-preparation
    command. The website fills the resulting PDFs entirely in the browser.
    """
    import fitz
    coordinates = {}
    with tempfile.TemporaryDirectory(prefix='hcsmp-pdf-templates-') as temporary:
        work = Path(temporary)
        for suffix in ['mayores', 'menores']:
            source = project / 'public/templates' / f'ficha-{suffix}.docx'
            with ZipFile(source) as z:
                files = {name: z.read(name) for name in z.namelist()}
            xml = files['word/document.xml'].decode()
            keys = sorted(set(re.findall(r'\{\{([A-Z_]+)\}\}', xml)) - {'PHOTO_LABEL', 'PHOTO_FILLED'})
            keys = [key for key in keys if not key.endswith('_SIZE')]
            markers = {key: f'Z{index}Z' for index, key in enumerate(keys)}
            checkbox_keys = ['BAPTISM', 'COMMUNION', 'CONFIRMATION', 'MARRIAGE', 'GUARDIAN_BAPTISM', 'GUARDIAN_COMMUNION', 'GUARDIAN_CONFIRMATION']
            # One-character markers fit each original checkbox at its 13pt size.
            for key, character in zip(checkbox_keys, 'QWERTYU'):
                if key in markers:
                    markers[key] = character
            for variant in ['base', 'markers']:
                document_xml = xml.replace('<!--HCSMP_PHOTO_FILL-->', '<a:noFill/>').replace('<!--HCSMP_VML_PHOTO-->', '')
                document_xml = document_xml.replace('Categoría: {{CATEGORY}}', '{{CATEGORY}}').replace('Estado: {{STATUS}}', '{{STATUS}}')
                def substitute(match):
                    key = match.group(1)
                    if key.endswith('_SIZE'):
                        return '22'
                    if key == 'PHOTO_FILLED':
                        return 'f'
                    if key == 'PHOTO_LABEL':
                        return ''
                    return markers[key] if variant == 'markers' else ''
                document_xml = re.sub(r'\{\{([A-Z_]+)\}\}', substitute, document_xml)
                path = work / f'{suffix}-{variant}.docx'
                with ZipFile(path, 'w', ZIP_DEFLATED) as z:
                    for name, data in files.items():
                        z.writestr(name, document_xml.encode() if name == 'word/document.xml' else data)
                subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', str(work), str(path)], check=True, stdout=subprocess.DEVNULL)
            doc = fitz.open(work / f'{suffix}-markers.pdf')
            inverse = {value: key for key, value in markers.items()}
            fields = {}
            for index, page in enumerate(doc):
                for block in page.get_text('dict')['blocks']:
                    for line in block.get('lines', []):
                        for span in line['spans']:
                            text = span['text'].strip()
                            if text in inverse:
                                fields[inverse[text]] = {
                                    'page': index, 'x': round(span['origin'][0], 4),
                                    'y': round(page.rect.height - span['origin'][1], 4),
                                    'fontSize': round(span['size'], 4),
                                    'centerX': round((span['bbox'][0] + span['bbox'][2]) / 2, 4),
                                }
            missing = set(markers) - set(fields)
            if missing:
                raise ValueError(f'Could not locate PDF response fields for {suffix}: {sorted(missing)}')
            page = doc[0]
            frames = [item['rect'] for item in page.get_drawings() if abs(item['rect'].width - 117.75) < 1 and abs(item['rect'].height - 155.25) < 1]
            if not frames:
                raise ValueError(f'Could not locate the original photo frame for {suffix}')
            frame = frames[0]
            fields['PHOTO'] = {
                'page': 0, 'x': round(frame.x0, 4), 'y': round(page.rect.height - frame.y1, 4),
                'width': round(frame.width, 4), 'height': round(frame.height, 4),
            }
            root = E.fromstring(files['word/document.xml'])
            for shape in root.findall('.//wp:anchor', NS):
                text = ''.join(shape.xpath('.//w:t/text()', namespaces=NS))
                for key in re.findall(r'\{\{([A-Z_]+)\}\}', text):
                    if key in fields:
                        fields[key]['width'] = round(int(shape.find('wp:extent', NS).get('cx')) / 12700, 4)
            (project / 'public/templates' / f'ficha-{suffix}.pdf').write_bytes((work / f'{suffix}-base.pdf').read_bytes())
            coordinates['minor' if suffix == 'menores' else 'adult'] = {
                'pageCount': len(doc), 'width': page.rect.width, 'height': page.rect.height, 'fields': fields,
            }
    if coordinates_path:
        coordinates_path.write_text(json.dumps(coordinates, indent=2))
    return coordinates


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('adult', type=Path, help='Original adult registration DOCX')
    parser.add_argument('minor', type=Path, help='Original minor registration DOCX')
    parser.add_argument('--pdf', action='store_true', help='Also render PDF backgrounds; requires soffice and PyMuPDF')
    parser.add_argument('--coordinates', type=Path, help='Optional output JSON for PDF field coordinates (use with --pdf)')
    args = parser.parse_args()
    if args.coordinates and not args.pdf:
        parser.error('--coordinates requires --pdf')
    project = Path(__file__).resolve().parent.parent
    prepare(args.adult, project / 'public/templates/ficha-mayores.docx', False)
    prepare(args.minor, project / 'public/templates/ficha-menores.docx', True)
    if args.pdf:
        prepare_pdf_templates(project, args.coordinates)
