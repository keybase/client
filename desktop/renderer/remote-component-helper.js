import electron from 'electron'
import {globalStyles} from '../shared/styles/style-guide'

const remote = electron.remote

export function autoResize () {
  // This only works when I delay a frame, unclear what the solution is but this seems fine for now
  setTimeout(() => {
    try {
      const element = window.document.getElementById('remoteComponent')
      const browserWindow = remote.getCurrentWindow()
      if (element && (element.scrollHeight != null) && (element.offsetTop != null) && !browserWindow.isDestroyed()) {
        // Height of remote component + offset from parent + top/bottom border
        const originalResizableState = browserWindow.isResizable()
        browserWindow.setResizable(true)
        browserWindow.setSize(browserWindow.getSize()[0], element.scrollHeight + 2 * element.offsetTop + 2 * globalStyles.windowBorder.borderWidth)
        browserWindow.setResizable(originalResizableState)
      }
    } catch (e) {
      console.error('error in resizing frame', e)
    }
  }, 1)
}
