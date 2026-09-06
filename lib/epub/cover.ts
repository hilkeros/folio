import sharp from "sharp";

const W = 1400;
const H = 2100;

function svgText(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(fromLabel: string, toLabel: string): string {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- White background — grayscale safe -->
  <rect width="${W}" height="${H}" fill="#ffffff"/>

  <!-- Top black bar -->
  <rect x="0" y="0" width="${W}" height="18" fill="#111111"/>

  <!-- "folio" wordmark — black on white, maximum contrast -->
  <text x="140" y="420"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="280" font-weight="bold" fill="#111111" letter-spacing="-8"
  >folio</text>

  <!-- Thick rule under wordmark -->
  <rect x="140" y="450" width="${W - 280}" height="6" fill="#111111"/>

  <!-- Subtitle -->
  <text x="140" y="520"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="38" fill="#555555" letter-spacing="6"
  >STANDARD.SITE DIGEST</text>

  <!-- Large date block — dark background for contrast -->
  <rect x="0" y="780" width="${W}" height="680" fill="#111111"/>

  <!-- "EDITION" label inside block -->
  <text x="140" y="880"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="34" fill="#999999" letter-spacing="6"
  >EDITION</text>

  <!-- From date — large and white -->
  <text x="140" y="1020"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="96" fill="#ffffff"
  >${svgText(fromLabel)}</text>

  <!-- Dash -->
  <text x="140" y="1120"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="60" fill="#666666"
  >&#x2014;</text>

  <!-- To date — large and white -->
  <text x="140" y="1370"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="120" font-weight="bold" fill="#ffffff"
  >${svgText(toLabel)}</text>

  <!-- Bottom black bar -->
  <rect x="0" y="${H - 18}" width="${W}" height="18" fill="#111111"/>
</svg>`;
}

// Returns a File object — epub-gen-memory reads it via .arrayBuffer()
// and detects the type from the .name property.
export async function generateCoverFile(fromDate: Date, toDate: Date): Promise<File> {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const svg = buildSvg(fmt(fromDate), fmt(toDate));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new File([png], "cover.png", { type: "image/png" });
}
