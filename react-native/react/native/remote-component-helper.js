import electron from 'electron'

const remote = electron.remote

export function autoResize () {
  // This only works when I delay a frame, unclear what the solution is but this seems fine for now
  setTimeout(() => {
    try {
      const element = window.document.getElementById('remoteComponent')
      const browserWindow = remote.getCurrentWindow()
      browserWindow.setSize(browserWindow.getSize()[0], element.scrollHeight)
    } catch (i) {
    }
  }, 1)
}
