// @flow
import {remote} from 'electron'

export function autoResize() {
  let previousHeight = 0

  // This only works when I delay a frame, unclear what the solution is but this seems fine for now
  setTimeout(() => {
    try {
      const element = window.document.getElementById('RemoteComponentRoot')
        .firstChild
      const browserWindow = remote.getCurrentWindow()
      if (
        element &&
        element.scrollHeight != null &&
        element.offsetTop != null &&
        !browserWindow.isDestroyed()
      ) {
        // try 5 times to get a stable window size, doesn't seem like a better way to do this...
        getStableHeight(element, 5, 1, () => {
          // Height of remote component + offset from parent + top/bottom border
          const originalResizableState = browserWindow.isResizable()
          browserWindow.setResizable(true)
          browserWindow.setContentSize(
            browserWindow.getSize()[0],
            element.scrollHeight + 2 * element.offsetTop + 2
          )
          browserWindow.setResizable(originalResizableState)
        })
      }
    } catch (e) {
      console.error('error in resizing frame', e)
    }

    function getStableHeight(element, left, delay, done) {
      const height = element.scrollHeight

      // Stable now
      if (height === previousHeight) {
        done()
      } else {
        // keep waiting a bit
        previousHeight = height
        if (left < 0) {
          done() // meh, just do it
        } else {
          setTimeout(
            () => getStableHeight(element, left - 1, delay, done),
            delay
          )
        }
      }
    }
  }, 1)
}
