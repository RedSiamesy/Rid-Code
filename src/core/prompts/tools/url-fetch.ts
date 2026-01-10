import { ToolArgs } from "./types"

export function getUrlFetchDescription(args: ToolArgs): string {
	return `## url_fetch
Description: Fetch and extract content from a specific URL. This tool can read web pages and convert them to readable markdown format.
Parameters:
- url: (required) The URL of the web page to fetch and extract content from.

Usage:
<url_fetch>
<url>https://example.com/page</url>
</url_fetch>

Example: Fetch content from a documentation page
<url_fetch>
<url>https://docs.microsoft.com/en-us/typescript/handbook/basic-types</url>
</url_fetch>

Note: The URL must be publicly accessible and should point to a web page with readable content.`
}
