# SharzyL's Tools - Vicinae Extension

A collection of productivity and window management tools for Vicinae, featuring:

- Niri Windows
- Kitty Windows
- RDict - LLM Dictionary

## Installation

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Development mode
npm run dev
```

## Configuration

### RDict Configuration

Create a configuration file at `~/.config/rdict/config.toml`:

```toml
[api]
base_url = "https://api.openai.com/v1"
api_key = "your-api-key-here"
model = "claude-haiku-4-5"
response_language = "Chinese"
```

### Kitty Configuration

For the Kitty Windows feature to work, Kitty must be started with remote control enabled:

```conf
allow_remote_control password
listen_on unix:$XDG_RUNTIME_DIR/kitty.$$.sock
remote_control_password "" focus-window ls
```

## Usage

### Niri Windows
1. Launch the "Niri Windows" command in Vicinae
2. Search for windows by title or workspace
3. Press Enter to focus the selected window

### Kitty Windows
1. Launch the "Kitty Windows" command in Vicinae
2. Browse windows across all Kitty instances
3. See workspace, working directory, and window title
4. Press Enter to focus, or Cmd+C to copy the working directory

### RDict
1. Copy text to clipboard (optional)
2. Launch the "RDict - Dictionary" command in Vicinae
3. If clipboard has text, definition will load automatically
4. Otherwise, enter a word or phrase to look up

## Development

```bash
# Format code
yarn format

# Lint
yarn lint
```

## License

MIT
