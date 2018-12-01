// @flow
// Entrypoint for the menubar node part
import menubar from 'menubar'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {isDarwin, isWindows, isLinux} from '../../constants/platform'
import {resolveImage, resolveRootAsURL} from './resolve-root.desktop'
import type {BadgeType} from '../../constants/types/notifications'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug.desktop'
import logger from '../../logger'

const htmlFile = resolveRootAsURL('dist', `menubar${__DEV__ ? '.dev' : ''}.html`)

let iconType: BadgeType = 'regular'

const isDarkMode = () => isDarwin && SafeElectron.getSystemPreferences().isDarkMode()

const getIcon = invertColors => {
  const devMode = __DEV__ ? '-dev' : ''
  let color = 'white'
  let platform = ''

  if (isDarwin) {
    color = isDarkMode() ? 'white' : 'black'
  } else if (isWindows) {
    color = 'black'
    platform = 'windows-'
  }

  const size = isWindows ? 16 : 22

  color = invertColors ? {black: 'white', white: 'black'}[color] : color

  return resolveImage(
    'menubarIcon',
    `icon-${platform}keybase-menubar-${iconType}-${color}-${size}${devMode}@2x.png`
  )
}

export default function(menubarWindowIDCallback: (id: number) => void) {
  const mb = menubar({
    hasShadow: true,
    height: 480,
    icon: getIcon(false),
    index: htmlFile,
    preloadWindow: true,
    resizable: false,
    showDockIcon: true,
    transparent: true,
    // Without this flag set, menubar will hide the dock icon when the app
    // ready event fires. We manage the dock icon ourselves, so this flag
    // prevents menubar from changing the state.
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: false,
    },
    width: 360,
  })

  const updateIcon = invertColors => {
    mb.tray.setImage(getIcon(invertColors))
  }

  if (isDarwin && SafeElectron.getSystemPreferences().subscribeNotification) {
    SafeElectron.getSystemPreferences().subscribeNotification(
      'AppleInterfaceThemeChangedNotification',
      () => {
        updateIcon(false)
      }
    )
  }

  SafeElectron.getIpcMain().on('showTray', (event, type, count) => {
    iconType = type
    updateIcon(false)
    const dock = SafeElectron.getApp().dock
    if (dock && dock.isVisible()) {
      SafeElectron.getApp().setBadgeCount(count)
    }
  })

  mb.on('ready', () => {
    menubarWindowIDCallback(mb.window.id)

    if (showDevTools && !skipSecondaryDevtools) {
      mb.window.webContents.openDevTools({mode: 'detach'})
    }

    // Hack: open widget when left/right/double clicked
    mb.tray.on('right-click', (e, bounds) => {
      e.preventDefault()
      setImmediate(() => mb.tray.emit('click', {...e}, {...bounds}))
    })
    mb.tray.on('double-click', e => e.preventDefault())

    // prevent the menubar's window from dying when we quit
    // We remove any existing listeners to close because menubar has one that deletes the reference to mb.window
    mb.window.removeAllListeners('close')
    mb.window.on('close', event => {
      event.preventDefault()
      mb.hideWindow()
    })

    if (isLinux) {
      mb.tray.setToolTip('Show Keybase')
    }

    mb.on('show', () => {
      // Account for different taskbar positions on Windows
      if (isWindows && mb.window && mb.tray) {
        const cursorPoint = SafeElectron.getScreen().getCursorScreenPoint()
        const screenSize = SafeElectron.getScreen().getDisplayNearestPoint(cursorPoint).workArea
        let menuBounds = mb.window.getBounds()
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

      isDarwin && updateIcon(!isDarkMode())
    })
    mb.on('hide', () => {
      isDarwin && updateIcon(false)
    })
    mb.on('after-show', () => {
      logger.info('Showing menubar at', mb.window && mb.window.getBounds())
    })
    mb.tray.on('click', (e, bounds) => {
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
