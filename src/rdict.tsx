import {
	Action,
	ActionPanel,
	Form,
	Icon,
	showToast,
	Toast,
	useNavigation,
} from "@vicinae/api";
import { DictionaryResult } from "./rdict-shared";

export default function RDictQuery() {
	const { push } = useNavigation();

	const handleSubmit = (input: Form.Values) => {
		const word = input.word as string;
		if (!word.trim()) {
			showToast({
				title: "Error",
				message: "Please enter a word or phrase",
				style: Toast.Style.Failure,
			});
			return;
		}

		push(<DictionaryResult initialWord={word.trim()} />);
	};

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
			<Form.TextField id="word" title="Word or Phrase" autoFocus />
		</Form>
	);
}
