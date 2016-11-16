// @flow
// Can't tell which thread we're in so let's try both
import electron from 'electron'
import {executeActionsForContext} from '../shared/util/quit-helper.desktop'
// $FlowIssue doens't understand symlinks
import {isDarwin} from '../shared/constants/platform'

const Menu = electron.Menu || electron.remote.Menu
const shell = electron.shell || electron.remote.shell

export default function makeMenu (window: any) {
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
    ].concat(__DEV__ ? ([ // eslint-disable-line no-undef
      {label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: (item, focusedWindow) => focusedWindow && focusedWindow.reload(),
      },
      {label: 'Toggle Developer Tools',
        accelerator: (() => isDarwin ? 'Alt+Command+I' : 'Ctrl+Shift+I')(),
        click: (item, focusedWindow) => focusedWindow && focusedWindow.toggleDevTools(),
      },
    ]) : []),
  }
  const helpMenu = {
    label: 'Help',
    submenu: [{label: 'Learn More', click () { shell.openExternal('https://keybase.io') }}],
  }

  if (isDarwin) {
    const template = [{
      label: 'Keybase',
      submenu: [
        {label: 'About Keybase', role: 'about'},
        {type: 'separator'},
        {label: 'Hide Keybase', accelerator: 'CmdOrCtrl+H', role: 'hide'},
        {label: 'Hide Others', accelerator: 'CmdOrCtrl+Shift+H', role: 'hideothers'},
        {label: 'Show All', role: 'unhide'},
        {type: 'separator'},
        {label: 'Quit', accelerator: 'CmdOrCtrl+Q', click () { executeActionsForContext('uiWindow') }},
      ],
    }, {
      ...editMenu,
    }, {
      ...windowMenu,
    }, {
      ...helpMenu,
    }]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    const template = [{
      label: '&File',
      submenu: [
       {label: '&Close', accelerator: 'CmdOrCtrl+W', role: 'close'},
       {label: '&Quit', accelerator: 'CmdOrCtrl+Q', click () { executeActionsForContext('uiWindow') }},
      ],
    }, {
      ...editMenu,
    }, {
      ...windowMenu,
    }, {
      ...helpMenu,
    }]
    const menu = Menu.buildFromTemplate(template)
    window.setMenu(menu)
  }
}

export function setupContextMenu (window: any) {
  const InputMenu = Menu.buildFromTemplate([
    {label: 'Undo', role: 'undo'},
    {label: 'Redo', role: 'redo'},
    {type: 'separator'},
    {label: 'Cut', role: 'cut'},
    {label: 'Copy', role: 'copy'},
    {label: 'Paste', role: 'paste'},
    {type: 'separator'},
    {label: 'Select all', role: 'selectall'},
  ])

  // $FlowIssue
  document.body.addEventListener('contextmenu', e => {
    e.preventDefault()
    e.stopPropagation()

    let node = e.target

    while (node) {
      if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
        InputMenu.popup(window)
        break
      }
      node = node.parentNode
    }
  })
}
