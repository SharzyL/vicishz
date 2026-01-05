import {
	Action,
	ActionPanel,
	closeMainWindow,
	Icon,
	List,
	showToast,
	Toast,
} from "@vicinae/api";
import { execSync } from "child_process";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";

interface KittyWindow {
	socket: string;
	window_id: number;
	tab_id: number;
	tab_title: string;
	window_title: string;
	cwd: string;
	is_focused: boolean;
	workspace_display: string;
}

interface NiriWindow {
	pid: number;
	workspace_id: number;
	app_id: string;
}

interface Workspace {
	id: number;
	name: string | null;
}

function getSocketForPid(pid: number): string | null {
	try {
		const runtimeDir = process.env.XDG_RUNTIME_DIR;
		if (!runtimeDir) {
			return null;
		}

		const socketPath = `${runtimeDir}/kitty-${pid}.sock`;

		// Check if socket exists
		if (fs.existsSync(socketPath)) {
			return socketPath;
		}

		return null;
	} catch (error) {
		return null;
	}
}

function getKittySocketsFromNiri(
	niriWindows: NiriWindow[],
): Map<string, number> {
	const kittyProcs = new Map<string, number>();

	for (const win of niriWindows) {
		// Only process windows with app_id "kitty"
		if (win.app_id !== "kitty" || !win.pid) continue;

		const socket = getSocketForPid(win.pid);
		if (socket) {
			kittyProcs.set(socket, win.pid);
		}
	}

	return kittyProcs;
}

function getNiriWindows(): NiriWindow[] {
	try {
		const result = execSync("niri msg --json windows", {
			encoding: "utf-8",
		});
		return JSON.parse(result);
	} catch (error) {
		console.error("Warning: Failed to get niri windows:", error);
		return [];
	}
}

function getWorkspaces(): Map<number, string> {
	try {
		const result = execSync("niri msg --json workspaces", {
			encoding: "utf-8",
		});
		const workspaces: Workspace[] = JSON.parse(result);

		const workspaceMap = new Map<number, string>();
		for (const ws of workspaces) {
			workspaceMap.set(ws.id, ws.name ?? String(ws.id));
		}
		return workspaceMap;
	} catch (error) {
		console.error("Warning: Failed to get niri workspaces:", error);
		return new Map();
	}
}


function getWindowsFromSocket(socketPath: string): any[] | null {
	try {
		const result = execSync(`kitty @ --to unix:${socketPath} ls`, {
			encoding: "utf-8",
			timeout: 2000,
		});
		return JSON.parse(result);
	} catch (error) {
		console.error(`Warning: Failed to get windows from ${socketPath}:`, error);
		return null;
	}
}

function extractWindows(osWindows: any[], socket: string): KittyWindow[] {
	const windows: KittyWindow[] = [];
	const homeDir = process.env.HOME || "~";

	for (const osWin of osWindows) {
		for (const tab of osWin.tabs || []) {
			const tabTitle = tab.title || "Untitled";
			const tabId = tab.id;

			for (const window of tab.windows || []) {
				const windowId = window.id;
				const windowTitle = window.title || "Untitled";
				let cwd = window.cwd || "~";
				const isFocused = window.is_focused || false;

				// Shorten home directory in cwd
				if (cwd.startsWith(homeDir)) {
					cwd = cwd.replace(homeDir, "~");
				}

				windows.push({
					socket,
					window_id: windowId,
					tab_id: tabId,
					tab_title: tabTitle,
					window_title: windowTitle,
					cwd,
					is_focused: isFocused,
					workspace_display: "?", // Will be set later
				});
			}
		}
	}

	return windows;
}

function focusKittyWindow(socket: string, windowId: number) {
	try {
		execSync(`kitty @ --to unix:${socket} focus-window --match id:${windowId}`);
	} catch (error) {
		showToast({
			title: "Error focusing window",
			message: String(error),
			style: Toast.Style.Failure,
		});
		throw error;
	}
}

export default function KittyWindows() {
	const [windows, setWindows] = useState<KittyWindow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const niriWindows = getNiriWindows();
		const workspaceMap = getWorkspaces();
		const kittyProcs = getKittySocketsFromNiri(niriWindows);

		// Create PID to workspace mapping
		const pidToWorkspace = new Map<number, string>();
		for (const niriWin of niriWindows) {
			if (niriWin.pid && niriWin.workspace_id !== undefined) {
				const workspaceDisplay =
					workspaceMap.get(niriWin.workspace_id) ??
					String(niriWin.workspace_id);
				pidToWorkspace.set(niriWin.pid, workspaceDisplay);
			}
		}

		// Get all kitty sockets from niri windows
		const sockets = Array.from(kittyProcs.keys());

		if (sockets.length === 0) {
			setWindows([]);
			setIsLoading(false);
			return;
		}

		// Gather all windows from all instances
		const allWindows: KittyWindow[] = [];
		for (const socket of sockets) {
			const osWindows = getWindowsFromSocket(socket);
			if (osWindows) {
				const wins = extractWindows(osWindows, socket);

				// Get workspace for this kitty instance
				const kittyPid = kittyProcs.get(socket);
				const workspaceDisplay = kittyPid
					? (pidToWorkspace.get(kittyPid) ?? "?")
					: "?";

				// Add workspace info to each window
				for (const win of wins) {
					win.workspace_display = workspaceDisplay;
				}

				allWindows.push(...wins);
			}
		}

		// Sort: by workspace, then tab id
		allWindows.sort((a, b) => {
			if (a.workspace_display !== b.workspace_display) {
				return a.workspace_display.localeCompare(b.workspace_display);
			}
			return a.tab_id - b.tab_id;
		});

		setWindows(allWindows);
		setIsLoading(false);
	}, []);

	if (!isLoading && windows.length === 0) {
		return (
			<List>
				<List.EmptyView
					title="No kitty instances found"
					description="Make sure you have kitty terminal running with --listen-on enabled"
				/>
			</List>
		);
	}

	return (
		<List isLoading={isLoading} searchBarPlaceholder="Search kitty windows...">
			{windows.map((win, index) => {
				const title = `[${win.workspace_display} ${win.tab_id}]: ${win.cwd}`;
				const subtitle = `${win.window_title}`;
				const accessories = win.is_focused
					? [{ text: "Focused", icon: Icon.Circle }]
					: [];

				return (
					<List.Item
						key={`${win.socket}-${win.window_id}-${index}`}
						title={title}
						subtitle={subtitle}
						icon="kitty"
						accessories={accessories}
						actions={
							<ActionPanel>
								<Action
									title="Focus Window"
									icon={Icon.Eye}
									onAction={async () => {
										await closeMainWindow();
										focusKittyWindow(win.socket, win.window_id);
										showToast({
											title: "Window focused",
											message: win.window_title,
										});
									}}
								/>
							</ActionPanel>
						}
					/>
				);
			})}
		</List>
	);
}
