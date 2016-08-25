// @flow

const requestIdleCallback = typeof window !== 'undefined' && window.requestIdleCallback ||
  function (cb: any) {
    var start = Date.now()
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: function () {
          return Math.max(0, 50 - (Date.now() - start))
        },
      })
    }, 1)
  }

const cancelIdleCallback = typeof window !== 'undefined' && window.cancelIdleCallback ||
  function (id: any) {
    clearTimeout(id)
  }

export {
  requestIdleCallback,
  cancelIdleCallback,
}
