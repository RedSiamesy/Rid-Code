src\core\mentions\index-riddler.ts
parseMentions函数对关键字的处理，这里是直接影响ai上下文的具体实现

src\shared\context-mentions.ts
正则对关键字的识别

src\components\chat\ChatTextArea.tsx
ChatTextArea对关键字的前端展示
例如```
{ type: ContextMenuOptionType.Summary, value: "summary" },

else if (type === ContextMenuOptionType.Summary) {
    insertValue = "summary"
}
```

src\components\chat\ContextMenu.tsx
getIconForOption和renderOptionContent对关键字的前端展示
```
case ContextMenuOptionType.Summary:
    return <span>Summary</span>

case ContextMenuOptionType.Summary:
    return "notebook"
```

src\utils\context-mentions.ts
枚举定义和getContextMenuOptions前端展示
```
export enum ContextMenuOptionType {
	OpenedFile = "openedFile",
	File = "file",
	Folder = "folder",
	Problems = "problems",
	Terminal = "terminal",
	URL = "url",
	Git = "git",
	NoResults = "noResults",
	Mode = "mode", // Add mode type
	Codebase = "codebase", // Add codebase type
	Summary = "summary", // Add summary type
}
{ type: ContextMenuOptionType.Summary },
if ("summary".startsWith(lowerQuery)) {
    suggestions.push({ type: ContextMenuOptionType.Summary })
}
```
