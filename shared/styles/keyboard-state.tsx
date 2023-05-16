// Keep track of keyboard state, ran by the ReduxHelper in main app
// Keyboard.isVisible() internal bookkeeping is actually racy and can't be trusted
let _up = false

export const setKeyboardUp = (up: boolean) => {
  _up = up
}
export const getKeyboardUp = () => _up
