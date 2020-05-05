// Entrypoint for the menubar node part
import * as ConfigGen from '../../actions/config-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Electron from 'electron'
import logger from '../../logger'
import {isDarwin, isWindows, isLinux} from '../../constants/platform'
import {mainWindowDispatch, getMainWindow} from '../remote/util.desktop'
import {menubar} from 'menubar'
import {resolveRoot, resolveImage, resolveRootAsURL} from './resolve-root.desktop'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug.desktop'
import getIcons from '../../menubar/icons'
import {workingIsDarkMode} from '../../util/safe-electron.desktop'

const htmlFile = resolveRootAsURL('dist', `menubar${__DEV__ ? '.dev' : ''}.html?param=menubar`)

let iconPath = getIcons('regular', false, workingIsDarkMode())

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export default (menubarWindowIDCallback: (id: number) => void) => {
  const mb = menubar({
    browserWindow: {
      hasShadow: true,
      height: 640,
      resizable: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: false,
        preload: resolveRoot('dist', `preload-main${__DEV__ ? '.dev' : ''}.bundle.js`),
      },
      width: 360,
    },
    icon: resolveImage('menubarIcon', iconPath),
    index: htmlFile,
    preloadWindow: true,
    // Without this flag set, menubar will hide the dock icon when the app
    // ready event fires. We manage the dock icon ourselves, so this flag
    // prevents menubar from changing the state.
    showDockIcon: true,
  })

  const updateIcon = () => {
    try {
      const resolved = resolveImage('menubarIcon', iconPath)
      mb.tray.setImage(resolved)
    } catch (err) {
      console.error('menu icon err: ' + err)
    }
  }

  type Action = {
    type: 'showTray'
    payload: {
      icon: string
      iconSelected: string
      desktopAppBadgeCount: number
    }
  }

  Electron.ipcMain.handle('KBmenu', (_: any, action: Action) => {
    switch (action.type) {
      case 'showTray': {
        iconPath = action.payload.icon
        updateIcon()
        const dock = Electron.app.dock
        if (dock && dock.isVisible()) {
          Electron.app.badgeCount = action.payload.desktopAppBadgeCount
        }

        // Windows just lets us set (or unset, with null) a single 16x16 icon
        // to be used as an overlay in the bottom right of the taskbar icon.
        if (isWindows) {
          const mw = getMainWindow()
          const overlay =
            action.payload.desktopAppBadgeCount > 0 ? resolveImage('icons', 'icon-windows-badge.png') : null
          // @ts-ignore setOverlayIcon docs say null overlay's fine, TS disagrees
          mw && mw.setOverlayIcon(overlay, 'new activity')
        }

        break
      }
    }
  })

  mb.on('ready', () => {
    // ask for an update in case we missed one
    mainWindowDispatch(
      ConfigGen.createRemoteWindowWantsProps({
        component: 'menubar',
        param: '',
      })
    )

    mb.tray.setIgnoreDoubleClickEvents(true)

    mb.window && menubarWindowIDCallback(mb.window.id)

    if (showDevTools && !skipSecondaryDevtools) {
      mb.window && mb.window.webContents.openDevTools({mode: 'detach'})
    }

    // Hack: open widget when left/right/double clicked
    mb.tray.on('right-click', (e: Electron.Event, bounds: Bounds) => {
      e.preventDefault()
      setTimeout(() => mb.tray.emit('click', {...e}, {...bounds}), 0)
    })
    mb.tray.on('double-click', (e: Electron.Event) => e.preventDefault())

    // prevent the menubar's window from dying when we quit
    // We remove any existing listeners to close because menubar has one that deletes the reference to mb.window

    mb.window && mb.window.removeAllListeners('close')
    mb.window &&
      mb.window.on('close', event => {
        event.preventDefault()
        mb.hideWindow()
      })

    if (isLinux) {
      mb.tray.setToolTip('Show Keybase')
    }

    const adjustForWindows = () => {
      // Account for different taskbar positions on Windows
      if (!isWindows || !mb.window || !mb.tray) {
        return
      }
      const cursorPoint = Electron.screen.getCursorScreenPoint()
      const screenSize = Electron.screen.getDisplayNearestPoint(cursorPoint).workArea
      const menuBounds = mb.window.getBounds()
      logger.info('Showing menu:', cursorPoint, screenSize)
      let iconBounds = mb.tray.getBounds()
      let x = iconBounds.x
      let y = iconBounds.y - iconBounds.height - menuBounds.height

      // rough guess where the menu bar is, since it's not
      // available on electron
      if (cursorPoint.x < screenSize.width / 2) {
        if (cursorPoint.y > screenSize.height / 2) {
          logger.info('- start menu on left -')
          // start menu on left
          x += iconBounds.width
        }
      } else {
        // start menu on top or bottom
        x -= menuBounds.width
        if (cursorPoint.y < screenSize.height / 2) {
          logger.info('- start menu on top -')
          // start menu on top
          y = iconBounds.y + iconBounds.height
        } else {
          // start menu on right/bottom
          logger.info('- start menu on bottom -')
        }
      }
      mb.setOption('x', x)
      mb.setOption('y', y)
    }

    mb.on('show', () => {
      mainWindowDispatch(
        Chat2Gen.createInboxRefresh({
          reason: 'widgetRefresh',
        })
      )
      adjustForWindows()
    })
    mb.on('hide', () => {})
    mb.on('after-show', () => {
      logger.info('Showing menubar at', mb.window && mb.window.getBounds())
    })
    mb.tray.on('click', (_: Electron.Event, bounds: Bounds) => {
      logger.info('Clicked tray icon:', bounds)
    })
  })

  // Work around an OS X bug that leaves a gap in the status bar if you exit
  // without removing your status bar icon.
  if (isDarwin) {
    mb.app.on('before-quit', () => {
      mb.tray && mb.tray.destroy()
    })
  }
}
