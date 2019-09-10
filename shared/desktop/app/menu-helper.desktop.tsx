import {isDarwin} from '../../constants/platform'

const Electron = KB.__electron

let devToolsState = false

const windowQuit = () => {
  Electron.app.emit('KBkeybase', '', {type: 'closeWindows'})
}

export default function makeMenu(window: Electron.BrowserWindow) {
  const editMenu = new Electron.MenuItem({
    label: 'Edit',
    submenu: [
      {accelerator: 'CmdOrCtrl+Z', label: 'Undo', role: 'undo'},
      {accelerator: 'Shift+CmdOrCtrl+Z', label: 'Redo', role: 'redo'},
      {type: 'separator'},
      {accelerator: 'CmdOrCtrl+X', label: 'Cut', role: 'cut'},
      {accelerator: 'CmdOrCtrl+C', label: 'Copy', role: 'copy'},
      {accelerator: 'CmdOrCtrl+V', label: 'Paste', role: 'paste'},
      {accelerator: 'CmdOrCtrl+A', label: 'Select All', role: 'selectall'},
    ],
  })

  const windowMenu = new Electron.MenuItem({
    label: 'Window',
    submenu: Electron.Menu.buildFromTemplate([
      new Electron.MenuItem({accelerator: 'CmdOrCtrl+=', label: 'Zoom In', role: 'zoomin'}),
      new Electron.MenuItem({label: 'Zoom Out', role: 'zoomout'}),
      new Electron.MenuItem({label: 'Reset zoom ', role: 'resetzoom'}),
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
        submenu: [
          {label: 'About Keybase', role: 'about'},
          {type: 'separator'},
          {accelerator: 'CmdOrCtrl+H', label: 'Hide Keybase', role: 'hide'},
          {accelerator: 'CmdOrCtrl+Shift+H', label: 'Hide Others', role: 'hideothers'},
          {label: 'Show All', role: 'unhide'},
          {type: 'separator'},
          {
            accelerator: 'CmdOrCtrl+Q',
            click() {
              windowQuit()
            },
            label: 'Minimize to Tray',
          },
        ],
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
  const selectionMenu = Electron.Menu.buildFromTemplate([{role: 'copy'}])

  const inputMenu = Electron.Menu.buildFromTemplate([
    {role: 'undo'},
    {role: 'redo'},
    {type: 'separator'},
    {role: 'cut'},
    {role: 'copy'},
    {role: 'paste'},
    {type: 'separator'},
    {role: 'selectall'},
  ])

  window.webContents.on('context-menu', (_: Electron.Event, props: Electron.ContextMenuParams) => {
    const {selectionText, isEditable} = props
    if (isEditable) {
      inputMenu.popup({window})
    } else if (selectionText && selectionText.trim() !== '') {
      selectionMenu.popup({window})
    }
  })
}
