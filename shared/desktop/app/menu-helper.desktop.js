// @flow
import * as SafeElectron from '../../util/safe-electron.desktop'
import {executeActionsForContext} from '../../util/quit-helper.desktop'
import {isDarwin} from '../../constants/platform'

let devToolsState = false

export default function makeMenu(window: any) {
  const editMenu = {
    label: 'Edit',
    submenu: [
      {label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
      {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo'},
      {type: 'separator'},
      {label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut'},
      {label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy'},
      {label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste'},
      {label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall'},
    ],
  }
  const windowMenu = {
    label: 'Window',
    submenu: [
      {label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn'},
      {label: 'Zoom Out', role: 'zoomOut'},
      {label: 'Reset zoom ', role: 'resetZoom'},
      {label: 'Minimize', role: 'minimize'},
      {label: 'Minimize', role: 'minimize'},
      {label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close'},
      {type: 'separator'},
      {label: 'Bring All to Front', role: 'front'},
    ].concat(
      __DEV__
        ? [
            // eslint-disable-line no-undef
            {
              label: 'Reload',
              accelerator: 'CmdOrCtrl+R',
              click: (item, focusedWindow) => focusedWindow && focusedWindow.reload(),
            },
            {
              label: 'Toggle Developer Tools',
              accelerator: (() => (isDarwin ? 'Alt+Command+I' : 'Ctrl+Shift+I'))(),
              click: (item, focusedWindow) => {
                devToolsState = !devToolsState
                SafeElectron.BrowserWindow.getAllWindows().map(bw =>
                  devToolsState
                    ? bw.webContents.openDevTools({mode: 'detach'})
                    : bw.webContents.closeDevTools()
                )
              },
            },
          ]
        : []
    ),
  }
  const helpMenu = {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click() {
          SafeElectron.getShell().openExternal('https://keybase.io')
        },
      },
    ],
  }

  if (isDarwin) {
    const template = [
      {
        label: 'Keybase',
        submenu: [
          {label: 'About Keybase', role: 'about'},
          {type: 'separator'},
          {label: 'Hide Keybase', accelerator: 'CmdOrCtrl+H', role: 'hide'},
          {label: 'Hide Others', accelerator: 'CmdOrCtrl+Shift+H', role: 'hideothers'},
          {label: 'Show All', role: 'unhide'},
          {type: 'separator'},
          {
            label: 'Quit',
            accelerator: 'CmdOrCtrl+Q',
            click() {
              executeActionsForContext('uiWindow')
            },
          },
        ],
      },
      {
        ...editMenu,
      },
      {
        ...windowMenu,
      },
      {
        ...helpMenu,
      },
    ]
    // $FlowIssue not sure yet
    const menu = SafeElectron.Menu.buildFromTemplate(template)
    SafeElectron.Menu.setApplicationMenu(menu)
  } else {
    const template = [
      {
        label: '&File',
        submenu: [
          {label: '&Close', accelerator: 'CmdOrCtrl+W', role: 'close'},
          {
            label: '&Quit',
            accelerator: 'CmdOrCtrl+Q',
            click() {
              executeActionsForContext('uiWindow')
            },
          },
        ],
      },
      {
        ...editMenu,
        label: '&Edit',
      },
      {
        ...windowMenu,
        label: '&Window',
      },
      {
        ...helpMenu,
        label: '&Help',
      },
    ]
    // $FlowIssue not sure yet
    const menu = SafeElectron.Menu.buildFromTemplate(template)
    window.setMenu(menu)
  }
}

export function setupContextMenu(window: any) {
  const selectionMenu = SafeElectron.Menu.buildFromTemplate([{role: 'copy'}])

  const inputMenu = SafeElectron.Menu.buildFromTemplate([
    {role: 'undo'},
    {role: 'redo'},
    {type: 'separator'},
    {role: 'cut'},
    {role: 'copy'},
    {role: 'paste'},
    {type: 'separator'},
    {role: 'selectall'},
  ])

  window.webContents.on('context-menu', (e, props) => {
    const {selectionText, isEditable} = props
    if (isEditable) {
      inputMenu.popup(window)
    } else if (selectionText && selectionText.trim() !== '') {
      selectionMenu.popup(window)
    }
  })
}
