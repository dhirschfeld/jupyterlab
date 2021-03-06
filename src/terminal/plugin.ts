// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  TerminalSession
} from '@jupyterlab/services';

import {
  InstanceTracker
} from '../common/instancetracker';

import {
  Menu
} from 'phosphor/lib/ui/menu';

import {
  JupyterLab, JupyterLabPlugin
} from '../application';

import {
  ICommandPalette
} from '../commandpalette';

import {
  IMainMenu
} from '../mainmenu';

import {
  IServiceManager
} from '../services';

import {
  IStateDB
} from '../statedb';

import {
  TerminalWidget
} from './index';


/**
 * The class name for all main area landscape tab icons.
 */
const LANDSCAPE_ICON_CLASS = 'jp-MainAreaLandscapeIcon';

/**
 * The class name for the terminal icon in the default theme.
 */
const TERMINAL_ICON_CLASS = 'jp-ImageTerminal';

/**
 * The terminal plugin state namespace.
 */
const NAMESPACE = 'terminals';

/**
 * The terminal widget instance tracker.
 */
const tracker = new InstanceTracker<TerminalWidget>();


/**
 * The default terminal extension.
 */
export
const terminalExtension: JupyterLabPlugin<void> = {
  id: 'jupyter.extensions.terminal',
  requires: [IServiceManager, IMainMenu, ICommandPalette, IStateDB],
  activate: activateTerminal,
  autoStart: true
};


function activateTerminal(app: JupyterLab, services: IServiceManager, mainMenu: IMainMenu, palette: ICommandPalette, state: IStateDB): void {
  // Bail if there are no terminals available.
  if (!services.terminals.isAvailable()) {
    console.log('Disabling terminals plugin because they are not available on the server');
    return;
  }
  let { commands, keymap } = app;
  let newTerminalId = 'terminal:create-new';
  let increaseTerminalFontSize = 'terminal:increase-font';
  let decreaseTerminalFontSize = 'terminal:decrease-font';
  let toggleTerminalTheme = 'terminal:toggle-theme';
  let openTerminalId = 'terminal:open';
  let options = {
    background: 'black',
    color: 'white',
    fontSize: 13
  };

  // Sync tracker with currently focused widget.
  app.shell.currentChanged.connect((sender, args) => {
    tracker.sync(args.newValue);
  });

  // Add terminal commands.
  commands.addCommand(newTerminalId, {
    label: 'New Terminal',
    caption: 'Start a new terminal session',
    execute: args => {
      let name = args ? args['name'] as string : '';
      let term = new TerminalWidget(options);
      term.title.closable = true;
      term.title.icon = `${LANDSCAPE_ICON_CLASS} ${TERMINAL_ICON_CLASS}`;
      app.shell.addToMainArea(term);
      app.shell.activateMain(term.id);
      tracker.add(term);
      let promise: Promise<TerminalSession.ISession>;
      if (name) {
        promise = services.terminals.connectTo(name);
      } else {
        promise = services.terminals.startNew();
      }
      promise.then(session => {
        let key = `${NAMESPACE}:${session.name}`;
        term.session = session;
        state.save(key, { name: session.name });
        term.disposed.connect(() => { state.remove(key); });
      });
    }
  });

  commands.addCommand(increaseTerminalFontSize, {
    label: 'Increase Terminal Font Size',
    execute: () => {
      if (options.fontSize < 72) {
        options.fontSize++;
        tracker.forEach(widget => { widget.fontSize = options.fontSize; });
      }
    }
  });

  commands.addCommand(decreaseTerminalFontSize, {
    label: 'Decrease Terminal Font Size',
    execute: () => {
      if (options.fontSize > 9) {
        options.fontSize--;
        tracker.forEach(widget => { widget.fontSize = options.fontSize; });
      }
    }
  });

  commands.addCommand(toggleTerminalTheme, {
    label: 'Toggle Terminal Theme',
    caption: 'Switch Terminal Background and Font Colors',
    execute: () => {
      if (options.background === 'black') {
        options.background = 'white';
        options.color = 'black';
      } else {
        options.background = 'black';
        options.color = 'white';
      }
      tracker.forEach(widget => {
        widget.background = options.background;
        widget.color = options.color;
      });
    }
  });

  commands.addCommand(openTerminalId, {
    execute: args => {
      let name = args['name'] as string;
      // Check for a running terminal with the given name.
      let widget = tracker.find(value => value.session.name === name);
      if (widget) {
        app.shell.activateMain(widget.id);
      } else {
        // Otherwise, create a new terminal with a given name.
        commands.execute(newTerminalId, { name });
      }
    }
  });

  // Reload any terminals whose state has been stored.
  Promise.all([state.fetchNamespace(NAMESPACE), app.started])
    .then(([items]) => {
      let create = 'terminal:create-new';
      items.forEach(item => { app.commands.execute(create, item.value); });
    });

  // Add command palette items.
  let category = 'Terminal';
  [
    newTerminalId,
    increaseTerminalFontSize,
    decreaseTerminalFontSize,
    toggleTerminalTheme
  ].forEach(command => palette.addItem({ command, category }));

  // Add menu items.
  let menu = new Menu({ commands, keymap });
  menu.title.label = 'Terminal';
  menu.addItem({ command: newTerminalId });
  menu.addItem({ command: increaseTerminalFontSize });
  menu.addItem({ command: decreaseTerminalFontSize });
  menu.addItem({ command: toggleTerminalTheme });

  mainMenu.addMenu(menu, {rank: 40});
}
