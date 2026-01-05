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

interface NiriWindow {
	id: number;
	title: string;
	app_id: string | null;
	workspace_id: number;
	is_focused: boolean;
	pid: number;
}

interface Workspace {
	id: number;
	name: string | null;
}

interface WindowEntry extends NiriWindow {
	workspace_display: string;
	icon_name: string;
}

function getWindows(): NiriWindow[] {
	try {
		const result = execSync("niri msg --json windows", {
			encoding: "utf-8",
		});
		return JSON.parse(result);
	} catch (error) {
		console.error("Error getting windows from niri:", error);
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
		console.error("Error getting workspaces from niri:", error);
		return new Map();
	}
}

function getIconName(pid: number, appId: string | null, title: string): string {
	// First try to find by app_id
	if (appId) {
		// TODO: Search for desktop files in XDG_DATA_DIRS
		// For now, just return the app_id as the icon name
		return appId;
	}

	// Fallback
	return "window";
}

function focusWindow(windowId: number) {
	try {
		execSync(`niri msg action focus-window --id ${windowId}`);
	} catch (error) {
		showToast({
			title: "Error focusing window",
			message: String(error),
			style: Toast.Style.Failure,
		});
	}
}

export default function NiriWindows() {
	const [windows, setWindows] = useState<WindowEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const workspaceMap = getWorkspaces();
		const rawWindows = getWindows();

		const processedWindows: WindowEntry[] = rawWindows.map((win) => {
			const workspace_display = workspaceMap.get(win.workspace_id) ?? "?";
			const icon_name = getIconName(win.pid, win.app_id, win.title);

			return {
				...win,
				workspace_display,
				icon_name,
			};
		});

		// Sort: focused first, then by workspace, then by title
		processedWindows.sort((a, b) => {
			if (a.is_focused !== b.is_focused) {
				return a.is_focused ? -1 : 1;
			}
			if (a.workspace_id !== b.workspace_id) {
				return a.workspace_id - b.workspace_id;
			}
			return a.title.localeCompare(b.title);
		});

		setWindows(processedWindows);
		setIsLoading(false);
	}, []);

	return (
		<List isLoading={isLoading} searchBarPlaceholder="Search windows...">
			{windows.map((win) => {
				const subtitle = `[${win.workspace_display}]`;
				const accessories = win.is_focused
					? [{ text: "Focused", icon: Icon.Circle }]
					: [];

				return (
					<List.Item
						key={win.id}
						title={win.title}
						subtitle={subtitle}
						icon={win.icon_name}
						accessories={accessories}
						actions={
							<ActionPanel>
								<Action
									title="Focus Window"
									icon={Icon.Eye}
									onAction={async () => {
										await closeMainWindow();
										focusWindow(win.id);
										showToast({
											title: "Window focused",
											message: win.title,
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
