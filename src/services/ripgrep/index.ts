import * as childProcess from "child_process"
import * as path from "path"
import * as readline from "readline"

import * as vscode from "vscode"

import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { fileExistsAtPath } from "../../utils/fs"

// Output mode enum
export type OutputMode = "content" | "files_with_matches"
/*
This file provides functionality to perform regex searches on files using ripgrep.
Inspired by: https://github.com/DiscreteTom/vscode-ripgrep-utils

Key components:
1. getBinPath: Locates the ripgrep binary within the VSCode installation.
2. execRipgrep: Executes the ripgrep command and returns the output.
3. regexSearchFiles: The main function that performs regex searches on files.
   - Parameters:
     * cwd: The current working directory (for relative path calculation)
     * directoryPath: The directory to search in
     * regex: The regular expression to search for (Rust regex syntax)
     * filePattern: Optional glob pattern to filter files (default: '*')
   - Returns: A formatted string containing search results with context

The search results include:
- Relative file paths
- 2 lines of context before and after each match
- Matches formatted with pipe characters for easy reading

Usage example:
const results = await regexSearchFiles('/path/to/cwd', '/path/to/search', 'TODO:', '*.ts');
// Or with files_with_matches mode (uses -l flag, returns plain text file paths):
const filesOnly = await regexSearchFiles('/path/to/cwd', '/path/to/search', 'TODO:', '*.ts', undefined, 'files_with_matches');

rel/path/to/app.ts
│----
│function processData(data: any) {
│  // Some processing logic here
│  // TODO: Implement error handling
│  return processedData;
│}
│----

rel/path/to/helper.ts
│----
│  let result = 0;
│  for (let i = 0; i < input; i++) {
│    // TODO: Optimize this function for performance
│    result += Math.pow(i, 2);
│  }
│----
*/

const isWindows = process.platform.startsWith("win")
const binName = isWindows ? "rg.exe" : "rg"

interface SearchFileResult {
	file: string
	searchResults: SearchResult[]
}

interface SearchResult {
	lines: SearchLineResult[]
}

interface SearchLineResult {
	line: number
	text: string
	isMatch: boolean
	column?: number
}
// Constants
const MAX_RESULTS = 300
const MAX_LINE_LENGTH = 500

/**
 * Truncates a line if it exceeds the maximum length
 * @param line The line to truncate
 * @param maxLength The maximum allowed length (defaults to MAX_LINE_LENGTH)
 * @returns The truncated line, or the original line if it's shorter than maxLength
 */
export function truncateLine(line: string, maxLength: number = MAX_LINE_LENGTH): string {
	return line.length > maxLength ? line.substring(0, maxLength) + " [truncated...]" : line
}
/**
 * Get the path to the ripgrep binary within the VSCode installation
 */
export async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
	const checkPath = async (pkgFolder: string) => {
		const fullPath = path.join(vscodeAppRoot, pkgFolder, binName)
		return (await fileExistsAtPath(fullPath)) ? fullPath : undefined
	}

	return (
		(await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
		(await checkPath("node_modules/vscode-ripgrep/bin")) ||
		(await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
		(await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/"))
	)
}

async function execRipgrep(bin: string, args: string[], mode:string): Promise<string> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(bin, args)
		// cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * (mode === "content" ? 5 : 1) // limiting ripgrep output with max lines since there's no other way to limit results. it's okay that we're outputting as json, since we're parsing it line by line and ignore anything that's not part of a match. This assumes each result is at most 5 lines.

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
			} else {
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})
		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve(output)
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	rooIgnoreController?: RooIgnoreController,
	outputMode: OutputMode = "content",
): Promise<string> {
	const vscodeAppRoot = vscode.env.appRoot
	const rgPath = await getBinPath(vscodeAppRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	// Adjust args based on output mode
	const args = outputMode === "files_with_matches"
		? ["-l", "-e", regex, "--glob", filePattern || "*", directoryPath]
		: ["--json", "-e", regex, "--glob", filePattern || "*", "--context", "1", directoryPath]

	let output: string
	try {
		output = await execRipgrep(rgPath, args, outputMode)
	} catch (error) {
		console.error("Error executing ripgrep:", error)
		return "No results found"
	}

	const results: SearchFileResult[] = []
	let currentFile: SearchFileResult | null = null

	// Handle files_with_matches mode differently - ripgrep with -l outputs plain text file paths
	if (outputMode === "files_with_matches") {
		// Parse plain text output (one file path per line)
		output.split("\n").forEach((line) => {
			const trimmedLine = line.trim()
			if (trimmedLine) {
				results.push({
					file: trimmedLine,
					searchResults: [], // Empty for files_with_matches mode
				})
			}
		})
	} else {
		// Original content mode logic - parse JSON output
		output.split("\n").forEach((line) => {
			if (line) {
				try {
					const parsed = JSON.parse(line)
					if (parsed.type === "begin") {
						currentFile = {
							file: parsed.data.path.text.toString(),
							searchResults: [],
						}
					} else if (parsed.type === "end") {
						// Reset the current result when a new file is encountered
						results.push(currentFile as SearchFileResult)
						currentFile = null
					} else if ((parsed.type === "match" || parsed.type === "context") && currentFile) {
						const line = {
							line: parsed.data.line_number,
							text: truncateLine(parsed.data.lines.text),
							isMatch: parsed.type === "match",
							...(parsed.type === "match" && { column: parsed.data.absolute_offset }),
						}

						const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1]
						if (lastResult?.lines.length > 0) {
							const lastLine = lastResult.lines[lastResult.lines.length - 1]

							// If this line is contiguous with the last result, add to it
							if (parsed.data.line_number <= lastLine.line + 1) {
								lastResult.lines.push(line)
							} else {
								// Otherwise create a new result
								currentFile.searchResults.push({
									lines: [line],
								})
							}
						} else {
							// First line in file
							currentFile.searchResults.push({
								lines: [line],
							})
						}
					}
				} catch (error) {
					console.error("Error parsing ripgrep output:", error)
				}
			}
		})
	}

	// console.log(results)

	// Filter results using RooIgnoreController if provided
	const filteredResults = rooIgnoreController
		? results.filter((result) => rooIgnoreController.validateAccess(result.file))
		: results

	return formatResults(filteredResults, cwd, outputMode)
}

function formatResults(fileResults: SearchFileResult[], cwd: string, outputMode: OutputMode = "content"): string {
	// Handle files_with_matches mode
	if (outputMode === "files_with_matches") {
		let output = ""
		const totalFiles = fileResults.length
		
		if (totalFiles >= MAX_RESULTS) {
			output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ files with matches. **You should use a more specific search, or switch to multiple SMALLER DIRECTORY SCOPES to searching separately. Do not give up on the search, as it may lead to the loss of relevant contextual information.**\n\n`
		} else {
			output += `Found ${totalFiles === 1 ? "1 file" : `${totalFiles.toLocaleString()} files`} with matches${totalFiles === 0 ? ". You should try switching the search scope or changing the search content." : ''}.\n\n`
		}

		// List files only
		fileResults.slice(0, MAX_RESULTS).forEach((file) => {
			const relativeFilePath = path.relative(cwd, file.file)
			output += `${relativeFilePath.toPosix()}\n`
		})

		return output.trim()
	}

	// Original content mode logic
	const groupedResults: { [key: string]: SearchResult[] } = {}

	let totalResults = fileResults.reduce((sum, file) => sum + file.searchResults.length, 0)
	let output = ""
	if (totalResults >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. **You should use a more specific search, or switch to multiple SMALLER DIRECTORY SCOPES to searching separately. Do not give up on the search, as it may lead to the loss of relevant contextual information.**\n\n`
	} else {
		output += `Found ${totalResults === 1 ? "1 result" : `${totalResults.toLocaleString()} results${totalResults === 0 ? ". You should try switching the search scope or changing the search content." : ''}`}.\n\n`
	}

	// Group results by file name
	fileResults.slice(0, MAX_RESULTS).forEach((file) => {
		const relativeFilePath = path.relative(cwd, file.file)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []

			groupedResults[relativeFilePath].push(...file.searchResults)
		}
	})

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		output += `# ${filePath.toPosix()}\n`

		fileResults.forEach((result) => {
			// Only show results with at least one line
			if (result.lines.length > 0) {
				// Show all lines in the result
				result.lines.forEach((line) => {
					const lineNumber = String(line.line).padStart(3, " ")
					output += `${lineNumber} | ${line.text.trimEnd()}\n`
				})
				output += "----\n"
			}
		})

		output += "\n"
	}

	return output.trim()
}
