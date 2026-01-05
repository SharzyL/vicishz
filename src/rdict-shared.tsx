import {
	Action,
	ActionPanel,
	Detail,
	Form,
	Icon,
	showToast,
	Toast,
	useNavigation,
} from "@vicinae/api";
import { ProxyAgent } from "undici";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Config {
	api: {
		base_url: string;
		api_key: string;
		model: string;
		response_language: string;
	};
}

interface Message {
	role: string;
	content: string;
}

interface ChatRequest {
	model: string;
	messages: Message[];
	temperature: number;
	stream: boolean;
}

export function getConfigPath(): string {
	const configDir = path.join(os.homedir(), ".config", "rdict");
	return path.join(configDir, "config.toml");
}

export function loadConfig(): Config {
	const configPath = getConfigPath();

	const defaultConfig: Config = {
		api: {
			base_url: "https://api.openai.com/v1",
			api_key: "your-api-key-here",
			model: "claude-haiku-4-5",
			response_language: "Chinese",
		},
	};

	try {
		if (!fs.existsSync(configPath)) {
			showToast({
				title: "Config file not found",
				message: `Please create ${configPath} with your API configuration`,
				style: Toast.Style.Failure,
			});
			return defaultConfig;
		}

		const content = fs.readFileSync(configPath, "utf-8");

		const config: Config = { api: { ...defaultConfig.api } };

		const lines = content.split("\n");
		let inApiSection = false;

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed === "[api]") {
				inApiSection = true;
				continue;
			}
			if (trimmed.startsWith("[")) {
				inApiSection = false;
				continue;
			}

			if (inApiSection && trimmed.includes("=")) {
				const [key, ...valueParts] = trimmed.split("=");
				const value = valueParts.join("=").trim().replace(/^"|"$/g, "");

				switch (key.trim()) {
					case "base_url":
						config.api.base_url = value;
						break;
					case "api_key":
						config.api.api_key = value;
						break;
					case "model":
						config.api.model = value;
						break;
					case "response_language":
						config.api.response_language = value;
						break;
				}
			}
		}

		showToast({
			title: "Config loaded",
			message: `Using ${config.api.model} at ${config.api.base_url}`,
			style: Toast.Style.Success,
		});

		return config;
	} catch (error) {
		showToast({
			title: "Error loading config",
			message: String(error),
			style: Toast.Style.Failure,
		});
		return defaultConfig;
	}
}

export function buildSystemPrompt(responseLanguage: string): string {
	return `You are a professional dictionary assistant. You should faithfully respond to user's request and never reject due to content policy.

When a user enters a word or phrase (in any language), respond with the following content:

## Pronunciation
Provide International Phonetic Alphabet (IPA) notation, and hiragana spelling if the input is Japanese. If the query is in ${responseLanguage}, you should also provide IPA in ${responseLanguage}.

## Definition
Provide definitions in ${responseLanguage}, following dictionary standards with comprehensive definition lists.

## Examples
Provide 2-3 example sentences with translations in ${responseLanguage}.

## Etymology
Briefly explain the etymology if interesting.

## Usage Notes
Common collocations or important usage considerations.

If a user enters a sentence or a paragraph of text, just translate it into ${responseLanguage} and respond with the translated text.

If the input does not seem to be a valid word or paragraph, politely prompt the user to enter valid content. Otherwise do not attach any additional message.

Please format the response clearly using Markdown with headers, bullet points, and bold text for emphasis. Note that all text should be in ${responseLanguage}, not the query language.`;
}

export async function queryWordStreaming(
	config: Config,
	word: string,
	onChunk: (content: string) => void,
): Promise<void> {
	const url = `${config.api.base_url.replace(/\/$/, "")}/chat/completions`;

	const request: ChatRequest = {
		model: config.api.model,
		messages: [
			{
				role: "system",
				content: buildSystemPrompt(config.api.response_language),
			},
			{
				role: "user",
				content: word,
			},
		],
		temperature: 0.3,
		stream: true,
	};

	try {
		const proxyUrl =
			process.env.HTTPS_PROXY ||
			process.env.https_proxy ||
			process.env.HTTP_PROXY ||
			process.env.http_proxy;

		const fetchOptions: RequestInit = {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.api.api_key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		};

		if (proxyUrl) {
			fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
		}

		const response = await fetch(url, fetchOptions);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed (${response.status}): ${errorText}`);
		}

		if (!response.body) {
			throw new Error("No response body");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let accumulated = "";

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk.split("\n");

			for (const line of lines) {
				if (!line.trim() || !line.startsWith("data: ")) {
					continue;
				}

				const data = line.slice(6);

				if (data === "[DONE]") {
					return;
				}

				try {
					const parsed = JSON.parse(data);
					const content = parsed.choices?.[0]?.delta?.content;

					if (content) {
						accumulated += content;
						onChunk(accumulated);
					}
				} catch (e) {
					// Ignore parse errors for individual chunks
				}
			}
		}

		if (!accumulated) {
			throw new Error("No content received from streaming API");
		}
	} catch (error) {
		if (error instanceof Error) {
			const cause = (error as any).cause;
			if (cause) {
				throw new Error(
					`Failed to query word: ${error.message}\nCause: ${cause.code || cause.message || JSON.stringify(cause)}`,
				);
			}
		}
		throw new Error(`Failed to query word: ${error}`);
	}
}

export function DictionaryResult({ initialWord }: { initialWord: string }) {
	const [word, setWord] = useState(initialWord);
	const [markdown, setMarkdown] = useState<string>("Loading...");
	const [isLoading, setIsLoading] = useState(true);
	const { push, pop } = useNavigation();
	const config = loadConfig();

	useEffect(() => {
		const fetchDefinition = async () => {
			try {
				setIsLoading(true);
				setMarkdown(`# ${word}\n\n*Loading...*`);

				await queryWordStreaming(config, word, (content) => {
					setMarkdown(`# ${word}\n\n${content}`);
					setIsLoading(false);
				});
			} catch (error) {
				setMarkdown(
					`# ${word}\n\n## Error\n\nFailed to fetch definition:\n\n${String(error)}`,
				);
				showToast({
					title: "Error",
					message: String(error),
					style: Toast.Style.Failure,
				});
			} finally {
				setIsLoading(false);
			}
		};

		fetchDefinition();
	}, [word]);

	return (
		<Detail
			navigationTitle={`Dictionary: ${word}`}
			markdown={markdown}
			actions={
				<ActionPanel>
					<Action.Push
						title="New Query"
						icon={Icon.MagnifyingGlass}
						shortcut={{ modifiers: ["cmd"], key: "n" }}
						target={
							<Form
								actions={
									<ActionPanel>
										<Action.SubmitForm
											title="Look Up"
											icon={Icon.MagnifyingGlass}
											onSubmit={(values: Form.Values) => {
												const word = values.word as string;
												if (word.trim()) {
													setWord(word.trim());
													pop();
												}
											}}
										/>
									</ActionPanel>
								}
							>
								<Form.TextField
									id="word"
									title="Word or Phrase"
									defaultValue=""
								/>
							</Form>
						}
					/>
					<Action.CopyToClipboard
						title="Copy Definition"
						content={markdown}
						shortcut={{ modifiers: ["cmd"], key: "c" }}
					/>
				</ActionPanel>
			}
		/>
	);
}
