// Entrypoint for the menubar node part
import * as ConfigGen from '../../actions/config-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Electron from 'electron'
import logger from '../../logger'
import {isDarwin, isWindows, isLinux, getAssetPath} from '../../constants/platform.desktop'
import {menubar} from 'menubar'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug'
import {getMainWindow} from './main-window.desktop'
import getIcons from '../../menubar/icons'
import os from 'os'
import {assetRoot, htmlPrefix} from './html-root.desktop'
import KB2 from '../../util/electron.desktop'

const {mainWindowDispatch} = KB2.functions

const htmlFile = `${htmlPrefix}${assetRoot}menubar${__FILE_SUFFIX__}.html?param=menubar`

// support dynamic dark mode system bar in big sur
const useImageTemplate = os.platform() === 'darwin' && parseInt(os.release().split('.')[0], 10) >= 20

let iconPath = getIcons('regular', false, Electron.nativeTheme.shouldUseDarkColors)
// only use imageTemplate if its not badged, else we lose the orange
let iconPathIsBadged = false

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

const MenuBar = (menubarWindowIDCallback: (id: number) => void) => {
  const icon = Electron.nativeImage.createFromPath(getAssetPath('images', 'menubarIcon', iconPath))
  if (useImageTemplate && !iconPathIsBadged) {
    icon.setTemplateImage(true)
  }
  const mb = menubar({
    browserWindow: {
      hasShadow: true,
      height: 640,
      resizable: false,
      transparent: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        preload: `${assetRoot}preload${__FILE_SUFFIX__}.bundle.js`,
      },
      width: 360,
    },
    icon,
    index: false,
    preloadWindow: true,
    // Without this flag set, menubar will hide the dock icon when the app
    // ready event fires. We manage the dock icon ourselves, so this flag
    // prevents menubar from changing the state.
    showDockIcon: true,
  })

  Electron.app.on('ready', () => {
    mb.window
      ?.loadURL(htmlFile)
      .then(() => {})
      .catch(() => {})
  })

  const updateIcon = () => {
    try {
      const resolved = getAssetPath('images', 'menubarIcon', iconPath)
      const i = Electron.nativeImage.createFromPath(resolved)
      if (useImageTemplate && !iconPathIsBadged) {
        i.setTemplateImage(true)
      }
      mb.tray.setImage(i)
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
        iconPathIsBadged = action.payload.desktopAppBadgeCount > 0
        updateIcon()
        const dock = Electron.app.dock
        if (dock?.isVisible()) {
          Electron.app.badgeCount = action.payload.desktopAppBadgeCount
        }

        // Windows just lets us set (or unset, with null) a single 16x16 icon
        // to be used as an overlay in the bottom right of the taskbar icon.
        if (isWindows) {
          const mw = getMainWindow()
          const overlay =
            action.payload.desktopAppBadgeCount > 0
              ? getAssetPath('images', 'icons', 'icon-windows-badge.png')
              : null
          // @ts-ignore overlay can be a string but TS is wrong
          mw?.setOverlayIcon(overlay, 'new activity')
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
      mb.window?.webContents.openDevTools({mode: 'detach'})
    }

    // Hack: open widget when left/right/double clicked
    mb.tray.on('right-click', (e: Electron.KeyboardEvent, bounds: Bounds) => {
      // @ts-ignore
      e?.preventDefault()
      setTimeout(() => mb.tray.emit('click', {...e}, {...bounds}), 0)
    })
    mb.tray.on('double-click', (e: Electron.KeyboardEvent) => {
      // @ts-ignore
      e?.preventDefault()
    })

    // prevent the menubar's window from dying when we quit
    // We remove any existing listeners to close because menubar has one that deletes the reference to mb.window

    mb.window?.removeAllListeners('close')
    mb.window?.on('close', event => {
      event.preventDefault()
      mb.hideWindow()
    })

    mb.window?.on('show', () => {
      mainWindowDispatch(ConfigGen.createUpdateWindowShown({component: 'menu'}))
    })

    if (isLinux) {
      mb.tray.setToolTip('Show Keybase')
    }

    const adjustForWindows = () => {
      // Account for different taskbar positions on Windows
      if (!isWindows || !mb.window) {
        return
      }
      const cursorPoint = Electron.screen.getCursorScreenPoint()
      const screenSize = Electron.screen.getDisplayNearestPoint(cursorPoint).workArea
      const menuBounds = mb.window.getBounds()
      logger.info('Showing menu:', cursorPoint, screenSize)
      const iconBounds = mb.tray.getBounds()
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
      mb.window.setPosition(x, y)
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
      logger.info('Showing menubar at', mb.window?.getBounds())
    })
    mb.tray.on('click', (_, bounds: Bounds) => {
      logger.info('Clicked tray icon:', bounds)
    })
  })

  // Work around an OS X bug that leaves a gap in the status bar if you exit
  // without removing your status bar icon.
  if (isDarwin) {
    mb.app.on('before-quit', () => {
      mb.tray.destroy()
    })
  }
}
export default MenuBar
