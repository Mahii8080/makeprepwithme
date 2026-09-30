from pathlib import Path
import re
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from pypdf import PdfReader

root = Path(r'C:\Users\Mahesh\Downloads\copy-of-makeprepwithme_-ai-interview-coach - Copy')
out_pdf = root / 'MakePrepWithMe_Source_Code_Copyright.pdf'
out_report = root / 'MakePrepWithMe_Source_Code_Report.txt'

selected = [
    'App.tsx',
    'index.tsx',
    'types.ts',
    'vite.config.ts',
    'components/Avatar.tsx',
    'components/DashboardScreen.tsx',
    'components/FeedbackCard.tsx',
    'components/InterviewSessionScreen.tsx',
    'components/LoginScreen.tsx',
    'components/ProfileScreen.tsx',
    'components/ResumeScannerScreen.tsx',
    'components/ThreeAvatar.tsx',
    'components/WebcamMonitor.tsx',
    'components/icons/CameraIcon.tsx',
    'components/icons/MicrophoneIcon.tsx',
    'components/icons/SendIcon.tsx',
    'components/icons/StopIcon.tsx',
    'services/authService.ts',
    'services/feedbackService.ts',
    'services/firebase.ts',
    'services/geminiService.ts',
    'services/profileService.ts',
    'services/questionBankService.ts',
    'backend/src/server.ts',
    'backend/prisma/schema.prisma',
]

existing = [root / rel for rel in selected if (root / rel).exists()]

# Secret value redaction that never prints actual values into the PDF.
def sanitize_source_text(text: str) -> str:
    rules = [
        (r'AIza[0-9A-Za-z\-_]+', '[REDACTED SECRET]'),
        (r'(?i)(GEMINI_API_KEY\s*=\s*)[A-Za-z0-9_\-"\']+', r'\1[REDACTED SECRET]'),
        (r'(?i)(VITE_GEMINI_API_KEY\s*=\s*)[A-Za-z0-9_\-"\']+', r'\1[REDACTED SECRET]'),
        (r'(?i)(OPENAI_API_KEY\s*=\s*)[A-Za-z0-9_\-"\']+', r'\1[REDACTED SECRET]'),
        (r'(?i)(GOOGLE_API_KEY\s*=\s*)[A-Za-z0-9_\-"\']+', r'\1[REDACTED SECRET]'),
        (r'(?i)(apiKey\s*:\s*["\'])[^"\']+["\']', r'apiKey: "[REDACTED SECRET]"'),
        (r'(?i)(measurementId\s*:\s*["\'])[^"\']+["\']', r'measurementId: "[REDACTED SECRET]"'),
        (r'(?i)(appId\s*:\s*["\'])[^"\']+["\']', r'appId: "[REDACTED SECRET]"'),
        (r'(?i)(messagingSenderId\s*:\s*["\'])[^"\']+["\']', r'messagingSenderId: "[REDACTED SECRET]"'),
    ]
    safe = text
    for pattern, replacement in rules:
        safe = re.sub(pattern, replacement, safe)
    return safe

report_lines = [
    'MakePrepWithMe.ai — Source Code Copyright Submission Report',
    '=======================================================',
    '',
    'Project: MakePrepWithMe.ai',
    'Document Type: Source Code',
    'Version: Copyright Registration Submission',
    '',
    'Excluded files/folders from the PDF:',
    '- .env, .env.*, .env.local, backend/.env',
    '- node_modules/',
    '- dist/, build/',
    '- .git/ and Git metadata',
    '- generated/cache/binary/temp files',
    '- non-source assets (images, audio, video)',
    '- lock files and debugging/test scripts not needed for the core application source',
    '',
    'Detected secrets/credentials and safeguards:',
    '- Firebase API key value found in services/firebase.ts and redacted to [REDACTED SECRET] in the PDF only.',
    '- Environment variable references for GEMINI_API_KEY / OPENAI_API_KEY were kept only as code references, with actual values never printed.',
    '- .env files were excluded entirely from the submission.',
    '',
    'Included source files:',
]
for p in existing:
    report_lines.append(f'- {p.relative_to(root).as_posix()}')
report_lines.extend([
    '',
    'Programming languages included:',
    '- TypeScript',
    '- TSX (React component files)',
    '- JavaScript (interface stubs and helper code where applicable)',
    '- Prisma schema / SQL data model definitions',
    '',
    'PDF output: MakePrepWithMe_Source_Code_Copyright.pdf',
    'Security status: no API keys, passwords, tokens, or private keys included in the PDF.'
])

styles = getSampleStyleSheet()
normal = styles['Normal']
normal.fontName = 'Courier'
normal.fontSize = 9
normal.leading = 11
pre_style = styles['Code']
pre_style.fontName = 'Courier'
pre_style.fontSize = 8
pre_style.leading = 10
pre_style.borderPadding = 6

story = []
story.append(Spacer(1, 0.8 * inch))
story.append(Paragraph('MakePrepWithMe.ai', styles['Title']))
story.append(Spacer(1, 0.2 * inch))
story.append(Paragraph('Project Name: MakePrepWithMe.ai', normal))
story.append(Paragraph('Work Type: Computer Software', normal))
story.append(Paragraph('Document Type: Source Code', normal))
story.append(Paragraph('Version: Copyright Registration Submission', normal))
story.append(Spacer(1, 0.4 * inch))
story.append(Paragraph('Prepared for software copyright registration submission.', normal))
story.append(PageBreak())

story.append(Paragraph('Table of Contents', styles['Heading1']))
for p in existing:
    story.append(Paragraph(f'- {p.relative_to(root).as_posix()}', normal))
story.append(PageBreak())

for p in existing:
    text = p.read_text(encoding='utf-8', errors='replace')
    safe_text = sanitize_source_text(text)
    story.append(Paragraph(f'File: {p.relative_to(root).as_posix()}', styles['Heading2']))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Preformatted(safe_text, pre_style))
    story.append(PageBreak())


def header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont('Courier', 8)
    canvas_obj.drawString(0.75 * inch, 0.55 * inch, 'MakePrepWithMe.ai – Source Code')
    canvas_obj.drawRightString(letter[0] - 0.75 * inch, 0.55 * inch, f'Page {doc.page}')
    canvas_obj.restoreState()

pdf = SimpleDocTemplate(
    str(out_pdf),
    pagesize=letter,
    leftMargin=0.75 * inch,
    rightMargin=0.75 * inch,
    topMargin=0.75 * inch,
    bottomMargin=0.9 * inch,
)
pdf.build(story, onFirstPage=header_footer, onLaterPages=header_footer)

# Verify output safety and page count.
reader = PdfReader(str(out_pdf))
page_count = len(reader.pages)
file_size_mb = out_pdf.stat().st_size / (1024 * 1024)
pdf_text = '\n'.join(page.extract_text() or '' for page in reader.pages)
secret_patterns = [
    r'Al[0-9A-Za-z_-]{20,}',
    r'AIza[0-9A-Za-z\-_]+',
    r'GEMINI_API_KEY\s*=\s*"?[A-Za-z0-9_\-]+',
    r'OPENAI_API_KEY\s*=\s*"?[A-Za-z0-9_\-]+',
    r'VITE_GEMINI_API_KEY\s*=\s*"?[A-Za-z0-9_\-]+',
]
failures = [pat for pat in secret_patterns if re.search(pat, pdf_text)]
if file_size_mb >= 10:
    raise SystemExit(f'PDF exceeds 10MB: {file_size_mb:.2f} MB')
if page_count < 1:
    raise SystemExit('PDF has no pages')
if failures:
    raise SystemExit(f'Generated PDF still contains secret-like content matching patterns: {failures}')

out_report.write_text('\n'.join(report_lines) + '\n', encoding='utf-8')
print(f'PDF created: {out_pdf}')
print(f'PDF size MB: {file_size_mb:.2f}')
print(f'PDF pages: {page_count}')
print(f'Included source files: {len(existing)}')
print('Secrets detected and redacted: Firebase API key and environment credential references were excluded/redacted; no actual secret values were printed.')
