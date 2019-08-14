import {executeActionsForContext} from '../../util/quit-helper.desktop'
import {isDarwin} from '../../constants/platform'

let devToolsState = false

export default function makeMenu(window: any) {
  const editMenu = {
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
  }
  const windowMenu = {
    label: 'Window',
    submenu: [
      {accelerator: 'CmdOrCtrl+=', label: 'Zoom In', role: 'zoomIn'},
      {label: 'Zoom Out', role: 'zoomOut'},
      {label: 'Reset zoom ', role: 'resetZoom'},
      {label: 'Minimize', role: 'minimize'},
      {accelerator: 'CmdOrCtrl+W', label: 'Close', role: 'close'},
      {type: 'separator'},
      {label: 'Bring All to Front', role: 'front'},
    ].concat(
      __DEV__
        ? [
            // eslint-disable-line no-undef
            {
              accelerator: 'CmdOrCtrl+R',
              // @ts-ignore codemode issue
              click: (item, focusedWindow) => focusedWindow && focusedWindow.reload(),
              label: 'Reload',
            },
            {
              accelerator: (() => (isDarwin ? 'Alt+Command+I' : 'Ctrl+Shift+I'))(),
              click: () => {
                devToolsState = !devToolsState
                KB.DEV.toggleDevTools(devToolsState)
              },
              label: 'Toggle Developer Tools',
            },
          ]
        : []
    ),
  }
  const helpMenu = {
    label: 'Help',
    submenu: [
      {
        click() {
          KB.electron.shell.openExternal('https://keybase.io')
        },
        label: 'Learn More',
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
          {accelerator: 'CmdOrCtrl+H', label: 'Hide Keybase', role: 'hide'},
          {accelerator: 'CmdOrCtrl+Shift+H', label: 'Hide Others', role: 'hideothers'},
          {label: 'Show All', role: 'unhide'},
          {type: 'separator'},
          {
            accelerator: 'CmdOrCtrl+Q',
            click() {
              executeActionsForContext('uiWindow')
            },
            label: 'Minimize to Tray',
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
    const menu = KB.electron.menu.buildFromTemplate(template)
    KB.electron.menu.setApplicationMenu(menu)
  } else {
    const template = [
      {
        label: '&File',
        submenu: [
          {accelerator: 'CmdOrCtrl+W', label: '&Close', role: 'close'},
          {
            accelerator: 'CmdOrCtrl+Q',
            click() {
              executeActionsForContext('uiWindow')
            },
            label: '&Minimize to Tray',
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
    const menu = KB.electron.menu.buildFromTemplate(template)
    window.setAutoHideMenuBar(true)
    window.setMenuBarVisibility(false)
    window.setMenu(menu)
  }
}

export function setupContextMenu() {
  const selectionMenu = KB.electron.menu.buildFromTemplate([{role: 'copy'}])

  const inputMenu = KB.electron.menu.buildFromTemplate([
    {role: 'undo'},
    {role: 'redo'},
    {type: 'separator'},
    {role: 'cut'},
    {role: 'copy'},
    {role: 'paste'},
    {type: 'separator'},
    {role: 'selectall'},
  ])

  KB.electron.currentWindow.webContents.onContextMenu((_, props) => {
    const {selectionText, isEditable} = props
    if (isEditable) {
      KB.electron.currentWindow.popup(inputMenu)
    } else if (selectionText && selectionText.trim() !== '') {
      KB.electron.currentWindow.popup(selectionMenu)
    }
  })
}
