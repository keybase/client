export const autoResize = () => {
  if (__STORYBOOK__) {
    return
  }
  let previousHeight = 0

  // This only works when I delay a frame, unclear what the solution is but this seems fine for now
  setTimeout(() => {
    try {
      const el = window.document.getElementById('RemoteComponentRoot')
      const element: any = el && el.firstChild
      if (element && element.scrollHeight != null && element.offsetTop != null) {
        // try 5 times to get a stable window size, doesn't seem like a better way to do this...
        getStableHeight(element, 5, 1, () => {
          // Height of remote component + offset from parent + top/bottom border
          KB.resizeWindow(element.scrollHeight, element.offsetTop)
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
          setTimeout(() => getStableHeight(element, left - 1, delay, done), delay)
        }
      }
    }
  }, 1)
}
