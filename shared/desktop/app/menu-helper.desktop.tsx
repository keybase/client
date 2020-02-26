import * as Electron from 'electron'
import {isDarwin} from '../../constants/platform'

let devToolsState = false

const windowQuit = () => {
  Electron.ipcRenderer.invoke('KBkeybase', {type: 'closeWindows'})
}

export default function makeMenu(window: Electron.BrowserWindow) {
  const editMenu = new Electron.MenuItem({
    label: 'Edit',
    submenu: Electron.Menu.buildFromTemplate([
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+Z', label: 'Undo', role: 'undo'}),
      new Electron.MenuItem({accelerator: 'Shift+CmdOrCtrl+Z', label: 'Redo', role: 'redo'}),
      new Electron.MenuItem({type: 'separator'}),
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+X', label: 'Cut', role: 'cut'}),
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+C', label: 'Copy', role: 'copy'}),
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+V', label: 'Paste', role: 'paste'}),
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+A', label: 'Select All', role: 'selectAll'}),
    ]),
  })

  const windowMenu = new Electron.MenuItem({
    label: 'Window',
    submenu: Electron.Menu.buildFromTemplate([
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+=', label: 'Zoom In', role: 'zoomIn'}),
      new Electron.MenuItem({label: 'Zoom Out', role: 'zoomOut'}),
      new Electron.MenuItem({label: 'Reset zoom ', role: 'resetZoom'}),
      new Electron.MenuItem({label: 'Minimize', role: 'minimize'}),
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+W', label: 'Close', role: 'close'}),
      new Electron.MenuItem({type: 'separator'}),
      new Electron.MenuItem({label: 'Bring All to Front', role: 'front'}),
      ...(__DEV__
        ? [
            new Electron.MenuItem({
              accelerator: 'CmdOrCtrl+R',
              click: (_, focusedWindow) => {
                focusedWindow && focusedWindow.reload()
              },
              label: 'Reload',
            }),
            new Electron.MenuItem({
              accelerator: (() => (isDarwin ? 'Alt+Command+I' : 'Ctrl+Shift+I'))(),
              click: () => {
                devToolsState = !devToolsState
                Electron.BrowserWindow.getAllWindows().map(bw =>
                  devToolsState
                    ? bw.webContents.openDevTools({mode: 'detach'})
                    : bw.webContents.closeDevTools()
                )
              },
              label: 'Toggle Developer Tools',
            }),
          ]
        : []),
    ]),
  })
  const helpMenu = new Electron.MenuItem({
    label: 'Help',
    submenu: Electron.Menu.buildFromTemplate([
      new Electron.MenuItem({
        click: () => {
          Electron.shell.openExternal('https://keybase.io')
        },
        label: 'Learn More',
      }),
    ]),
  })

  if (isDarwin) {
    const template = [
      new Electron.MenuItem({
        label: 'Keybase',
        submenu: Electron.Menu.buildFromTemplate([
          new Electron.MenuItem({label: 'About Keybase', role: 'about'}),
          new Electron.MenuItem({type: 'separator'}),
          new Electron.MenuItem({accelerator: 'CmdOrCtrl+H', label: 'Hide Keybase', role: 'hide'}),
          new Electron.MenuItem({accelerator: 'CmdOrCtrl+Shift+H', label: 'Hide Others', role: 'hideOthers'}),
          new Electron.MenuItem({label: 'Show All', role: 'unhide'}),
          new Electron.MenuItem({type: 'separator'}),
          new Electron.MenuItem({
            accelerator: 'CmdOrCtrl+Q',
            click() {
              windowQuit()
            },
            label: 'Minimize to Tray',
          }),
        ]),
      }),
      {...editMenu},
      {...windowMenu},
      {...helpMenu},
    ]
    const menu = Electron.Menu.buildFromTemplate(template)
    Electron.Menu.setApplicationMenu(menu)
  } else {
    const menu = Electron.Menu.buildFromTemplate([
      new Electron.MenuItem({
        label: '&File',
        submenu: [
          {accelerator: 'CmdOrCtrl+W', label: '&Close', role: 'close'},
          {
            accelerator: 'CmdOrCtrl+Q',
            click() {
              windowQuit()
            },
            label: '&Minimize to Tray',
          },
        ],
      }),
      {...editMenu, label: '&Edit'},
      {...windowMenu, label: '&Window'},
      {...helpMenu, label: '&Help'},
    ])
    window.setAutoHideMenuBar(true)
    window.setMenuBarVisibility(false)
    window.setMenu(menu)
  }
  setupContextMenu(window)
}

function setupContextMenu(window: Electron.BrowserWindow) {
  window.webContents.on('context-menu', (_: Electron.Event, props: Electron.ContextMenuParams) => {
    const {selectionText, isEditable} = props
    if (isEditable) {
      const {dictionarySuggestions} = props
      const inputMenu = Electron.Menu.buildFromTemplate([
        ...(props.misspelledWord
          ? [
              ...dictionarySuggestions.map(
                s =>
                  new Electron.MenuItem({
                    click(_, w) {
                      w.webContents.replaceMisspelling(s)
                    },
                    label: s,
                  })
              ),
              ...(dictionarySuggestions.length ? [new Electron.MenuItem({type: 'separator'})] : []),
              new Electron.MenuItem({
                click(_, w) {
                  w.webContents.session.addWordToSpellCheckerDictionary(props.misspelledWord)
                },
                label: 'Add to dictionary',
              }),
              new Electron.MenuItem({type: 'separator'}),
            ]
          : []),
        new Electron.MenuItem({role: 'undo'}),
        new Electron.MenuItem({role: 'redo'}),
        new Electron.MenuItem({type: 'separator'}),
        new Electron.MenuItem({role: 'cut'}),
        new Electron.MenuItem({role: 'copy'}),
        new Electron.MenuItem({role: 'paste'}),
        new Electron.MenuItem({type: 'separator'}),
        new Electron.MenuItem({role: 'selectAll'}),
      ])

      inputMenu.popup({window})
    } else if (selectionText && selectionText.trim() !== '') {
      const selectionMenu = Electron.Menu.buildFromTemplate([{role: 'copy'}])
      selectionMenu.popup({window})
    }
  })
}
