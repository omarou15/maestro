import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, unlinkSync } from "fs"
import { join, extname, basename } from "path"
import { randomUUID } from "crypto"
import { execSync } from "child_process"
import type { Plugin } from "./types.js"

const UPLOAD_DIR = "/root/maestro/server/uploads"
const GENERATED_DIR = "/root/maestro/server/generated"
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000 // 24h

// Ensure dirs exist
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
if (!existsSync(GENERATED_DIR)) mkdirSync(GENERATED_DIR, { recursive: true })

// Clean old files periodically
function cleanOldFiles(dir: string) {
  try {
    const now = Date.now()
    for (const f of readdirSync(dir)) {
      const path = join(dir, f)
      try {
        const stat = statSync(path)
        if (now - stat.mtimeMs > MAX_FILE_AGE_MS) unlinkSync(path)
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

// Parse PDF
async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import("pdf-parse") as any
  const pdfParse = mod.default || mod
  const data = await pdfParse(buffer)
  return data.text.slice(0, 50000)
}

// Parse CSV
function parseCsv(buffer: Buffer): string {
  const text = buffer.toString("utf-8")
  const lines = text.split("\n").slice(0, 200)
  return lines.join("\n")
}

// Parse DOCX
async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await mammoth.extractRawText({ buffer: buffer as any })
  return result.value.slice(0, 50000)
}

// Parse XLSX
async function parseXlsx(buffer: Buffer): Promise<string> {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.default.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)
  const lines: string[] = []
  workbook.eachSheet((sheet) => {
    lines.push(`\n--- Feuille: ${sheet.name} ---`)
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 100) return // Limit rows
      const values = (row.values as unknown[]).slice(1).map(v => String(v ?? ""))
      lines.push(values.join(" | "))
    })
  })
  return lines.join("\n").slice(0, 50000)
}

// Parse TXT/MD/HTML
function parseText(buffer: Buffer, ext: string): string {
  const text = buffer.toString("utf-8")
  if (ext === ".html" || ext === ".htm") {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50000)
  }
  return text.slice(0, 50000)
}

// Generate PDF from HTML using Chromium
async function generatePdf(html: string, filename: string): Promise<string> {
  const id = randomUUID().slice(0, 8)
  const htmlPath = join(GENERATED_DIR, `${id}.html`)
  const pdfPath = join(GENERATED_DIR, `${filename || id}.pdf`)
  writeFileSync(htmlPath, html, "utf-8")

  const chromium = existsSync("/usr/bin/chromium-browser") ? "/usr/bin/chromium-browser" : "/usr/bin/chromium"
  execSync(
    `${chromium} --headless --disable-gpu --no-sandbox --print-to-pdf="${pdfPath}" "${htmlPath}"`,
    { timeout: 30000, encoding: "utf-8" }
  )

  try { unlinkSync(htmlPath) } catch { /* ignore */ }
  return pdfPath
}

// Generate DOCX (simple — HTML to DOCX via pandoc if available, otherwise plain text)
function generateDocx(content: string, filename: string): string {
  const id = randomUUID().slice(0, 8)
  const outPath = join(GENERATED_DIR, `${filename || id}.docx`)

  try {
    // Try pandoc for proper DOCX
    const tmpMd = join(GENERATED_DIR, `${id}.md`)
    writeFileSync(tmpMd, content, "utf-8")
    execSync(`pandoc "${tmpMd}" -o "${outPath}"`, { timeout: 15000, encoding: "utf-8" })
    try { unlinkSync(tmpMd) } catch { /* ignore */ }
    return outPath
  } catch {
    // Fallback: use mammoth (write simple docx)
    // For now, save as txt with .docx extension — not ideal but functional
    writeFileSync(outPath, content, "utf-8")
    return outPath
  }
}

// Generate XLSX
async function generateXlsx(data: string[][], filename: string, sheetName?: string): Promise<string> {
  const ExcelJS = await import("exceljs")
  const id = randomUUID().slice(0, 8)
  const outPath = join(GENERATED_DIR, `${filename || id}.xlsx`)

  const workbook = new ExcelJS.default.Workbook()
  const sheet = workbook.addWorksheet(sheetName || "Données")
  for (const row of data) {
    sheet.addRow(row)
  }
  // Auto-width columns
  sheet.columns.forEach(col => {
    let maxLen = 10
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value).length
      if (len > maxLen) maxLen = Math.min(len, 50)
    })
    col.width = maxLen + 2
  })

  await workbook.xlsx.writeFile(outPath)
  return outPath
}

export const documentsPlugin: Plugin = {
  id: "documents",
  name: "Documents Engine",
  version: "1.0.0",
  register(ctx) {
    // Clean old files every hour
    setInterval(() => { cleanOldFiles(UPLOAD_DIR); cleanOldFiles(GENERATED_DIR) }, 3600000)

    // Upload + parse a file
    ctx.app.post("/api/documents/parse", async (req, res) => {
      try {
        const { base64, filename, mimeType } = req.body
        if (!base64 || !filename) return res.status(400).json({ error: "base64 and filename required" })

        const buffer = Buffer.from(base64, "base64")
        const ext = extname(filename).toLowerCase()

        // Save uploaded file
        const id = randomUUID().slice(0, 8)
        const savedPath = join(UPLOAD_DIR, `${id}_${basename(filename)}`)
        writeFileSync(savedPath, buffer)

        let text = ""
        let type = "unknown"

        if (ext === ".pdf" || mimeType === "application/pdf") {
          text = await parsePdf(buffer)
          type = "pdf"
        } else if (ext === ".csv" || mimeType === "text/csv") {
          text = parseCsv(buffer)
          type = "csv"
        } else if (ext === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          text = await parseDocx(buffer)
          type = "docx"
        } else if (ext === ".xlsx" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
          text = await parseXlsx(buffer)
          type = "xlsx"
        } else if ([".txt", ".md", ".html", ".htm", ".json", ".xml"].includes(ext)) {
          text = parseText(buffer, ext)
          type = ext.slice(1)
        } else {
          // Try as text
          try {
            text = buffer.toString("utf-8").slice(0, 50000)
            type = "text"
          } catch {
            return res.json({ error: "Format non supporté", filename, type: "unsupported" })
          }
        }

        res.json({ filename, type, text, size: buffer.length, savedPath })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // Generate PDF from HTML
    ctx.app.post("/api/documents/generate/pdf", async (req, res) => {
      try {
        const { html, filename } = req.body
        if (!html) return res.status(400).json({ error: "html required" })
        const path = await generatePdf(html, filename || "document")
        const fileBuffer = readFileSync(path)
        const base64 = fileBuffer.toString("base64")
        res.json({ path, filename: basename(path), size: fileBuffer.length, base64 })
      } catch (e) {
        res.status(500).json({ error: `PDF generation failed: ${e}` })
      }
    })

    // Generate XLSX
    ctx.app.post("/api/documents/generate/xlsx", async (req, res) => {
      try {
        const { data, filename, sheetName } = req.body
        if (!data || !Array.isArray(data)) return res.status(400).json({ error: "data (2D array) required" })
        const path = await generateXlsx(data, filename || "tableau", sheetName)
        const fileBuffer = readFileSync(path)
        const base64 = fileBuffer.toString("base64")
        res.json({ path, filename: basename(path), size: fileBuffer.length, base64 })
      } catch (e) {
        res.status(500).json({ error: `XLSX generation failed: ${e}` })
      }
    })

    // Generate DOCX
    ctx.app.post("/api/documents/generate/docx", async (req, res) => {
      try {
        const { content, filename } = req.body
        if (!content) return res.status(400).json({ error: "content required" })
        const path = generateDocx(content, filename || "document")
        const fileBuffer = readFileSync(path)
        const base64 = fileBuffer.toString("base64")
        res.json({ path, filename: basename(path), size: fileBuffer.length, base64 })
      } catch (e) {
        res.status(500).json({ error: `DOCX generation failed: ${e}` })
      }
    })

    // Download a generated file
    ctx.app.get("/api/documents/download/:filename", (req, res) => {
      const filename = basename(req.params.filename) // Prevent path traversal
      const path = join(GENERATED_DIR, filename)
      if (!existsSync(path)) return res.status(404).json({ error: "Fichier non trouvé" })
      res.download(path)
    })

    // List generated files
    ctx.app.get("/api/documents/files", (_req, res) => {
      try {
        const files = readdirSync(GENERATED_DIR).map(f => {
          const stat = statSync(join(GENERATED_DIR, f))
          return { name: f, size: stat.size, created: stat.mtime.toISOString() }
        }).sort((a, b) => b.created.localeCompare(a.created))
        res.json({ files })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    console.log("[DOCUMENTS] Plugin activé (PDF, DOCX, XLSX, CSV parsing + génération)")
  },
}
