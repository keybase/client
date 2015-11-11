import app from 'app'

var visibleCount = 0

export default function () {
  if (++visibleCount === 1) {
    app.dock.show()
  }
  let alreadyHidden = false
  return () => {
    if (alreadyHidden) {
      throw new Error('Tried to hide the dock icon twice')
    }
    alreadyHidden = true
    if (--visibleCount === 0) {
      app.dock.hide()
    }
  }
}
