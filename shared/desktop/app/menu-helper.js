// @flow
// Can't tell which thread we're in so let's try both
import electron from 'electron'
import {executeActionsForContext} from '../../util/quit-helper.desktop'
import {isDarwin} from '../../constants/platform'

const Menu = electron.Menu || electron.remote.Menu
const shell = electron.shell || electron.remote.shell

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
      {label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize'},
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
              click: (item, focusedWindow) => focusedWindow && focusedWindow.toggleDevTools(),
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
          shell.openExternal('https://keybase.io')
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
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
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
      },
      {
        ...windowMenu,
      },
      {
        ...helpMenu,
      },
    ]
    const menu = Menu.buildFromTemplate(template)
    window.setMenu(menu)
  }
}

export function setupContextMenu(window: any) {
  const selectionMenu = Menu.buildFromTemplate([{role: 'copy'}])

  const inputMenu = Menu.buildFromTemplate([
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
