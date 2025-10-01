import * as vscode from "vscode"

export interface TerminalInfo {
    name: string
    pid: string | undefined
    state: string | undefined
}

export async function getTermInfo(): Promise<TerminalInfo[]> {
    const vscodeTerm = vscode.window.terminals
    const terminalInfos: TerminalInfo[] = []

    for (const t of vscodeTerm) {
        const state = t.state.shell
        const name = t.name
        const pid = await t.processId.then((p) => p?.toString())

        terminalInfos.push({
            name,
            pid,
            state
        })
    }

    return terminalInfos
}

export async function executeCommandInTerminals(command: string, targetPid: string): Promise<boolean> {
    const vscodeTerm = vscode.window.terminals

    for (const t of vscodeTerm) {
        const pid = await t.processId.then((p) => p?.toString())

        if (pid === targetPid) {
            await t.sendText(command)
            return true
        }
    }
    return false
}
