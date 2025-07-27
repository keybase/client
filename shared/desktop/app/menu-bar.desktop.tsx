// Entrypoint for the menubar node part
import * as RemoteGen from '@/actions/remote-gen'
import * as R from '@/constants/remote'
import * as Electron from 'electron'
import logger from '@/logger'
import {isDarwin, isWindows, isLinux, getAssetPath} from '@/constants/platform.desktop'
import {menubar} from 'menubar'
import {showDevTools, skipSecondaryDevtools} from '@/local-debug'
import {getMainWindow} from './main-window.desktop'
import {assetRoot, htmlPrefix} from './html-root.desktop'
import type {BadgeType} from '@/constants/notifications'

const getIcons = (iconType: BadgeType, badges: number) => {
  const size = isWindows ? 16 : 22
  const x = isLinux ? '' : '@2x'

  if (badges > 0) {
    if (badges < 5) {
      return `icon-menubar-${badges}@2x.png`
    } else {
      return `icon-menubar-many@2x.png`
    }
  } else {
    const devMode = __DEV__ ? '-dev' : ''
    let color = 'white'
    const badged = badges ? 'badged-' : ''
    let platform = ''

    if (isDarwin) {
      color = 'white'
    } else if (isWindows) {
      color = 'black'
      platform = 'windows-'
    }
    const file = `icon-${platform}keybase-menubar-${badged}${iconType}-${color}-${size}${devMode}${x}.png`
    return file
  }
}

const htmlFile = `${htmlPrefix}${assetRoot}menubar${__FILE_SUFFIX__}.html?param=menubar`

let badgeType: BadgeType = 'regular'
let badges = 0

const getIcon = () => {
  const path = getIcons(badgeType, badges)
  const icon = Electron.nativeImage.createFromPath(getAssetPath('images', 'menubarIcon', path))
  // template it always, else the color is just wrong, lose the orange sadly
  icon.setTemplateImage(true)
  return icon
}

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

const MenuBar = () => {
  const icon = getIcon()
  const mb = menubar({
    browserWindow: {
      ...(isDarwin ? {type: 'panel'} : {}),
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
    showOnAllWorkspaces: true,
  })

  Electron.app.on('ready', () => {
    mb.window
      ?.loadURL(htmlFile)
      .then(() => {})
      .catch(() => {})
  })

  const updateIcon = () => {
    try {
      mb.tray.setImage(getIcon())
    } catch (err) {
      console.error('menu icon err: ' + err)
    }
  }

  type Action = {
    type: 'showTray'
    payload: {
      badgeType: BadgeType
      desktopAppBadgeCount: number
    }
  }

  Electron.ipcMain.handle('KBmenu', (_, action: Action) => {
    switch (action.type) {
      case 'showTray': {
        badgeType = action.payload.badgeType
        badges = action.payload.desktopAppBadgeCount
        updateIcon()
        const _dock = Electron.app.dock
        const dock = _dock as typeof _dock | undefined
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
          overlay 
            ? mw?.setOverlayIcon(Electron.nativeImage.createFromPath(overlay), 'new activity')
            : mw?.setOverlayIcon(null, 'no recent activity');
        }

        break
      }
    }
  })

  mb.on('ready', () => {
    // ask for an update in case we missed one
    R.remoteDispatch(
      RemoteGen.createRemoteWindowWantsProps({
        component: 'menubar',
        param: '',
      })
    )

    mb.tray.setIgnoreDoubleClickEvents(true)

    if (showDevTools && !skipSecondaryDevtools) {
      mb.window?.webContents.openDevTools({
        mode: 'detach',
        title: `${__DEV__ ? 'DEV' : 'Prod'} Menu Devtools`,
      })
    }

    // Hack: open widget when left/right/double clicked
    mb.tray.on('right-click', (e, bounds: Bounds) => {
      setTimeout(() => mb.tray.emit('click', {...e}, {...bounds}), 0)
    })
    mb.tray.on('double-click', () => {})

    // prevent the menubar's window from dying when we quit
    // We remove any existing listeners to close because menubar has one that deletes the reference to mb.window

    mb.window?.removeAllListeners('close')
    mb.window?.on('close', event => {
      event.preventDefault()
      mb.hideWindow()
    })

    mb.window?.on('show', () => {
      R.remoteDispatch(RemoteGen.createUpdateWindowShown({component: 'menu'}))
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
      R.remoteDispatch(RemoteGen.createInboxRefresh())
      adjustForWindows()
    })
    mb.on('hide', () => {})
    mb.on('after-show', () => {
      logger.info('Showing menubar at', mb.window?.getBounds())
    })
    mb.tray.on('click', (_: unknown, bounds: Bounds) => {
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
