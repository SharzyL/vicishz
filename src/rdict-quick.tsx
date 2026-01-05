import {
	Action,
	ActionPanel,
	Clipboard,
	Detail,
	Form,
	Icon,
	showToast,
	Toast,
	useNavigation,
} from "@vicinae/api";
import { useState, useEffect } from "react";
import { DictionaryResult } from "./rdict-shared";

interface SearchFormValues {
	word: string;
}

function SearchForm() {
	const { push } = useNavigation();

	async function handleSubmit(values: Form.Values) {
		const word = values.word as string;
		if (!word.trim()) {
			showToast({
				title: "Error",
				message: "Please enter a word or phrase",
				style: Toast.Style.Failure,
			});
			return;
		}

		push(<DictionaryResult initialWord={word.trim()} />);
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm
						title="Look Up"
						icon={Icon.MagnifyingGlass}
						onSubmit={handleSubmit}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField id="word" title="Word or Phrase" />
		</Form>
	);
}

export default function RDict() {
	const [initialWord, setInitialWord] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const { push } = useNavigation();

	useEffect(() => {
		const getClipboard = async () => {
			try {
				const text = await Clipboard.readText();
				const trimmed = text?.trim() || "";
				setInitialWord(trimmed);

				// If we have clipboard content, automatically show the result
				if (trimmed) {
					push(<DictionaryResult initialWord={trimmed} />);
				}
			} catch (error) {
				// Ignore clipboard read errors
			} finally {
				setIsLoading(false);
			}
		};

		getClipboard();
	}, []);

	if (isLoading) {
		return <Detail markdown="Loading..." />;
	}

	// If no initial word from clipboard, show search form
	if (!initialWord) {
		return <SearchForm />;
	}

	// Otherwise the DictionaryResult was already pushed in useEffect
	return <SearchForm />;
}
