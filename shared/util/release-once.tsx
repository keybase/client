// A release that does its work the first time it is called and nothing after
export const releaseOnce = (release: () => void): (() => void) => {
  let released = false
  return () => {
    if (!released) {
      released = true
      release()
    }
  }
}
