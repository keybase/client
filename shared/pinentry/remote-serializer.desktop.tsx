export const serialize = {
  cancelLabel: v => v,
  prompt: v => v,
  retryLabel: v => v,
  sessionID: v => v,
  showTyping: v => v,
  submitLabel: v => v,
  submitted: v => v,
  type: v => v,
  windowComponent: v => v,
  windowOpts: v => v,
  windowParam: v => v,
  windowPositionBottomRight: v => v,
  windowTitle: v => v,
}
const initialState = {}

export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state

  return {
    ...state,
    ...props,
  }
}
