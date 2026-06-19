import type { App } from 'obsidian';

type CommandCapableApp = App & {
	commands: {
		executeCommandById(commandId: string): Promise<boolean>;
	};
};

export function executeObsidianCommand(app: App, commandId: string): Promise<boolean> {
	return (app as CommandCapableApp).commands.executeCommandById(commandId);
}
