import React, { useEffect, useState } from "react"
import { Edit, Folder, Globe, GraduationCap, Plus } from "lucide-react"

import type { SkillMetadata } from "@roo/skills"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Button, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type SkillSource = "global" | "project"

const SkillItem: React.FC<{ skill: SkillMetadata }> = ({ skill }) => {
	const { t } = useAppTranslation()

	const detailParts = [skill.description, skill.mode ? t("settings:skills.modeLabel", { mode: skill.mode }) : ""]
		.filter(Boolean)
		.join(" · ")

	return (
		<div className="px-4 py-2 text-sm flex items-center group hover:bg-vscode-list-hoverBackground">
			<div className="flex-1 min-w-0">
				<div>
					<span className="truncate text-vscode-foreground">{skill.name}</span>
					{detailParts && (
						<div className="text-xs text-vscode-descriptionForeground truncate mt-0.5">{detailParts}</div>
					)}
				</div>
			</div>

			<div className="flex items-center gap-2 ml-2">
				<StandardTooltip content={t("settings:skills.editSkill")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						onClick={() => vscode.postMessage({ type: "openFile", text: skill.path })}
						className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
						<Edit className="w-4 h-4" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}

export const SkillsSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { skills, cwd } = useExtensionState()
	const [globalNewName, setGlobalNewName] = useState("")
	const [workspaceNewName, setWorkspaceNewName] = useState("")

	const hasWorkspace = Boolean(cwd)

	useEffect(() => {
		handleRefresh()
	}, [])

	const handleRefresh = () => {
		vscode.postMessage({ type: "requestSkills" })
	}

	const handleCreateSkill = (source: SkillSource, name: string) => {
		if (!name.trim()) return

		vscode.postMessage({
			type: "createSkill",
			text: name.trim(),
			values: { source },
		})

		if (source === "global") {
			setGlobalNewName("")
		} else {
			setWorkspaceNewName("")
		}

		setTimeout(handleRefresh, 500)
	}

	const globalSkills = skills?.filter((skill) => skill.source === "global") ?? []
	const projectSkills = skills?.filter((skill) => skill.source === "project") ?? []

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<GraduationCap className="w-4" />
					<div>{t("settings:sections.skills")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="mb-4">
					<p className="text-sm text-vscode-descriptionForeground">{t("settings:skills.description")}</p>
				</div>

				<div className="mb-6">
					<div className="flex items-center gap-1.5 mb-2">
						<Globe className="w-3 h-3" />
						<h4 className="text-sm font-medium m-0">{t("settings:skills.globalSkills")}</h4>
					</div>
					<div className="border border-vscode-panel-border rounded-md">
						{globalSkills.map((skill) => (
							<SkillItem key={`global-${skill.name}-${skill.mode ?? "generic"}`} skill={skill} />
						))}
						<div className="px-4 py-2 flex items-center gap-2 hover:bg-vscode-list-hoverBackground border-t border-vscode-panel-border">
							<input
								type="text"
								value={globalNewName}
								onChange={(e) => setGlobalNewName(e.target.value)}
								placeholder={t("settings:skills.newGlobalSkillPlaceholder")}
								className="flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vscode-focusBorder"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleCreateSkill("global", globalNewName)
									}
								}}
							/>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleCreateSkill("global", globalNewName)}
								disabled={!globalNewName.trim()}
								className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
								<Plus className="w-4 h-4" />
							</Button>
						</div>
					</div>
				</div>

				{hasWorkspace && (
					<div className="mb-6">
						<div className="flex items-center gap-1.5 mb-2">
							<Folder className="w-3 h-3" />
							<h4 className="text-sm font-medium m-0">{t("settings:skills.workspaceSkills")}</h4>
						</div>
						<div className="border border-vscode-panel-border rounded-md">
							{projectSkills.map((skill) => (
								<SkillItem key={`project-${skill.name}-${skill.mode ?? "generic"}`} skill={skill} />
							))}
							<div className="px-4 py-2 flex items-center gap-2 hover:bg-vscode-list-hoverBackground border-t border-vscode-panel-border">
								<input
									type="text"
									value={workspaceNewName}
									onChange={(e) => setWorkspaceNewName(e.target.value)}
									placeholder={t("settings:skills.newWorkspaceSkillPlaceholder")}
									className="flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vscode-focusBorder"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											handleCreateSkill("project", workspaceNewName)
										}
									}}
								/>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleCreateSkill("project", workspaceNewName)}
									disabled={!workspaceNewName.trim()}
									className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
									<Plus className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
