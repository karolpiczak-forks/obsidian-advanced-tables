import { defaultOptions, optionsWithDefaults } from './mte-options';
import {
  Alignment,
  FormatType,
  Options,
  TableEditor,
} from '@susisu/mte-kernel';
import { App, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ObsidianTextEditor } from 'src/text-editor-interface';
import { TableControls } from './table-controls';

export default class TableEditorPlugin extends Plugin {
  public settings: TableEditorPluginSettings;

  // shiftPressed tracks whether a shift key is down to allow us to inverse operations.
  private shiftPressed: boolean;

  // cmEditors is used during unload to remove our event handlers.
  private cmEditors: CodeMirror.Editor[];

  private tableControls: TableControls;

  public onInit(): void {}

  public async onload(): Promise<void> {
    console.log('loading markdown-table-editor plugin');

    this.loadSettings();

    this.cmEditors = [];
    this.registerEvent(
      this.app.on('codemirror', (cm: CodeMirror.Editor) => {
        this.cmEditors.push(cm);
        cm.on('keydown', this.handleKeyDown);
        cm.on('keyup', this.handleKeyUp);
      }),
    );

    this.addCommand({
      id: 'format-table',
      name: 'Format table at the cursor',
      callback: () => {
        this.performTableAction(true, this.formatTable);
      },
    });

    this.addCommand({
      id: 'next-cell',
      name: 'Navigate to Next Cell',
      callback: () => {
        this.performTableAction(true, this.nextCell);
      },
    });

    this.addCommand({
      id: 'previous-cell',
      name: 'Navigate to Previous Cell',
      callback: () => {
        this.performTableAction(true, this.previousCell);
      },
    });

    this.addCommand({
      id: 'next-row',
      name: 'Navigate to Next Row',
      callback: () => {
        this.performTableAction(true, this.nextRow);
      },
    });

    this.addCommand({
      id: 'insert-column',
      name: 'Insert column before current',
      callback: () => {
        this.performTableAction(true, this.insertColumn);
      },
    });

    this.addCommand({
      id: 'left-align-column',
      name: 'Left align column',
      callback: () => {
        this.performTableAction(true, this.leftAlignColumn);
      },
    });

    this.addCommand({
      id: 'center-align-column',
      name: 'Center align column',
      callback: () => {
        this.performTableAction(true, this.centerAlignColumn);
      },
    });

    this.addCommand({
      id: 'right-align-column',
      name: 'Right align column',
      callback: () => {
        this.performTableAction(true, this.rightAlignColumn);
      },
    });

    this.addCommand({
      id: 'table-control-bar',
      name: 'Open table controls menu',
      callback: () => {
        this.performEditorAction(true, this.openTableControls);
      },
    });

    this.addSettingTab(new TableEditorSettingsTab(this.app, this));
  }

  public onunload(): void {
    console.log('unloading markdown-table-editor plugin');

    if (this.tableControls) {
      this.tableControls.clear();
      this.tableControls = null;
    }

    this.cmEditors.forEach((cm) => {
      cm.off('keydown', this.handleKeyDown);
      cm.off('keyup', this.handleKeyUp);
    });
  }

  private readonly handleKeyDown = (
    cm: CodeMirror.Editor,
    event: KeyboardEvent,
  ): void => {
    if (event.key === 'Shift') {
      console.debug('Shift is pressed');
      this.shiftPressed = true;
      return;
    }
    if (['Tab', 'Enter'].contains(event.key)) {
      // True means only do this if in a table
      this.performTableAction(true, (te: TableEditor) => {
        switch (event.key) {
          case 'Tab':
            if (this.shiftPressed) {
              this.previousCell(te);
            } else {
              this.nextCell(te);
            }
            break;
          case 'Enter':
            this.nextRow(te);
            break;
        }
        event.preventDefault();
      });
    }
  };

  private readonly handleKeyUp = (
    cm: CodeMirror.Editor,
    event: KeyboardEvent,
  ): void => {
    if (event.key === 'Shift') {
      console.debug('Shift is not pressed');
      this.shiftPressed = false;
      return;
    }
  };

  private async loadSettings(): Promise<void> {
    this.settings = new TableEditorPluginSettings();
    (async () => {
      const loadedSettings = await this.loadData();
      if (loadedSettings) {
        console.log('Found existing settings file');
        this.settings.formatType = loadedSettings.formatType;
      } else {
        console.log('No settings file found, saving...');
        this.saveData(this.settings);
      }
    })();
  }

  private readonly performTableAction = (
    inTableOnly: boolean,
    fn: (tableeditor: TableEditor) => void,
  ): void => {
    // Any action will trigger hiding the table controls
    if (this.tableControls) {
      this.tableControls.clear();
      this.tableControls = null;
    }

    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf.view instanceof MarkdownView) {
      const ote = new ObsidianTextEditor(activeLeaf.view);
      const te = new TableEditor(ote);

      if (!te.cursorIsInTable(defaultOptions)) {
        // TODO: Show modal if not in table
        return;
      }

      fn(te);
    }
  };

  private readonly performEditorAction = (
    inTableOnly: boolean,
    fn: (cm: CodeMirror.Editor) => void,
  ): void => {
    // Any action will trigger hiding the table controls
    if (this.tableControls) {
      this.tableControls.clear();
      this.tableControls = null;
    }

    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf.view instanceof MarkdownView) {
      const ote = new ObsidianTextEditor(activeLeaf.view);
      const te = new TableEditor(ote);

      if (!te.cursorIsInTable(defaultOptions)) {
        // TODO: Show modal if not in table
        return;
      }

      fn(activeLeaf.view.sourceMode.cmEditor);
    }
  };

  private readonly nextCell = (te: TableEditor): void => {
    te.nextCell(this.settings.asOptions());
  };

  private readonly previousCell = (te: TableEditor): void => {
    te.previousCell(this.settings.asOptions());
  };

  private readonly nextRow = (te: TableEditor): void => {
    te.nextRow(this.settings.asOptions());
  };

  private readonly formatTable = (te: TableEditor): void => {
    te.format(this.settings.asOptions());
  };

  private readonly insertColumn = (te: TableEditor): void => {
    te.insertColumn(this.settings.asOptions());
  };

  private readonly leftAlignColumn = (te: TableEditor): void => {
    te.alignColumn(Alignment.LEFT, this.settings.asOptions());
  };

  private readonly centerAlignColumn = (te: TableEditor): void => {
    te.alignColumn(Alignment.CENTER, this.settings.asOptions());
  };

  private readonly rightAlignColumn = (te: TableEditor): void => {
    te.alignColumn(Alignment.RIGHT, this.settings.asOptions());
  };

  private readonly openTableControls = (cm: CodeMirror.Editor): void => {
    this.tableControls = new TableControls(cm);
    this.tableControls.display();
  };
}

class TableEditorPluginSettings {
  public formatType: FormatType;

  constructor() {
    this.formatType = FormatType.NORMAL;
  }

  public asOptions(): Options {
    return optionsWithDefaults({ formatType: this.formatType });
  }
}

class TableEditorSettingsTab extends PluginSettingTab {
  private readonly plugin: TableEditorPlugin;

  constructor(app: App, plugin: TableEditorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Table Plugin Editor - Settings' });

    new Setting(containerEl)
      .setName('Pad cell width using spaces')
      .setDesc(
        'If enabled, table cells will have spaces added to match the with of the ' +
          'longest cell in the column. Only useful when using a monospace font during editing.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.formatType === FormatType.NORMAL)
          .onChange((value) => {
            this.plugin.settings.formatType = value
              ? FormatType.NORMAL
              : FormatType.WEAK;
            this.plugin.saveData(this.plugin.settings);
            this.display();
          }),
      );
  }
}
