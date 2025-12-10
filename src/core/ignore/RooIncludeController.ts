
import path from "path"
import fs from "fs/promises"
import { regexSearchFiles, OutputMode } from "../../services/ripgrep"


export async function expandIncludeFilePatterns(includeFile: string): Promise<string[]> {
	const content = await fs.readFile(includeFile, "utf8").catch(() => "")
	if (!content) return []

	const lines = content.split(/\r?\n/)
	const includePatterns: string[] = []
	const excludePatterns: string[] = []

	for (let raw of lines) {
		let line = raw.trim()
		if (!line) continue
		if (line.startsWith("#")) continue
		let isNeg = false
		if (line.startsWith("!")) {
			isNeg = true
			line = line.slice(1).trim()
			if (!line) continue
		}

		if (line.endsWith("/")) {
			line = line + "**"
		}

		const normalized = line.replace(/\\/g, "/")
		if (isNeg) excludePatterns.push(normalized)
		else includePatterns.push(normalized)
	}

	const results = new Set<string>()

	const hasGlob = (s: string) => /[*?\[\]{}()]/.test(s)

	async function expandSinglePattern(pat: string): Promise<string[]> {
		let pattern = pat
		const isAbs = path.isAbsolute(pattern) || /^[a-zA-Z]:\//.test(pattern)
		if (!isAbs) {
			const dir = path.dirname(includeFile)
			pattern = path.resolve(dir, pattern)
		}
		const pForward = pattern.replace(/\\/g, "/")

		if (!hasGlob(pForward)) {
			const maybePath = pattern
			const stat = await fs.stat(maybePath).catch(() => null)
			if (stat && stat.isFile()) return [path.resolve(maybePath)]
			return []
		}

		const idx = pForward.search(/[*?\[\]{}()]/)
		const lastSlashBefore = Math.max(pForward.lastIndexOf("/", idx), pForward.lastIndexOf("\\", idx))

		let baseDir = lastSlashBefore >= 0 ? pForward.slice(0, lastSlashBefore) : path.parse(pForward).root
		let filePat = lastSlashBefore >= 0 ? pForward.slice(lastSlashBefore + 1) : pForward

		baseDir = baseDir.replace(/\//g, path.sep)
		filePat = filePat.replace(/\//g, path.posix.sep)

		if (!baseDir) baseDir = path.parse(pattern).root

		const stat = await fs.stat(baseDir).catch(() => null)
		if (!stat) return []

		const root = path.parse(baseDir).root
		const raw = await regexSearchFiles(root, baseDir, ".*", filePat, undefined, "files_with_matches" as OutputMode)
		const outLines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^Found\b/i.test(l) && !/^Showing\b/i.test(l))

		const matches: string[] = []
		for (const rl of outLines) {
			const looksAbs = path.isAbsolute(rl) || /^[a-zA-Z]:\\|\/[a-zA-Z]/.test(rl)
			if (looksAbs) {
				matches.push(path.normalize(rl))
			} else {
				const abs = path.resolve(root, rl)
				matches.push(abs)
			}
		}

		return matches
	}

	for (const p of includePatterns) {
		try {
			const ms = await expandSinglePattern(p)
			for (const m of ms) results.add(path.resolve(m))
		} catch (err) {
			console.error(`Error expanding include pattern ${p}:`, err)
		}
	}

	for (const p of excludePatterns) {
		try {
			const ms = await expandSinglePattern(p)
			for (const m of ms) results.delete(path.resolve(m))
		} catch (err) {
			console.error(`Error expanding exclude pattern ${p}:`, err)
		}
	}

	return Array.from(results)
}

