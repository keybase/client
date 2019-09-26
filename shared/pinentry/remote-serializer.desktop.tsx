export const serialize = {
  cancelLabel: (v: any) => v,
  darkMode: (v: any) => v,
  prompt: (v: any) => v,
  retryLabel: (v: any) => v,
  sessionID: (v: any) => v,
  showTyping: (v: any) => v,
  submitLabel: (v: any) => v,
  submitted: (v: any) => v,
  type: (v: any) => v,
  windowComponent: (v: any) => v,
  windowOpts: (v: any) => v,
  windowParam: (v: any) => v,
  windowPositionBottomRight: (v: any) => v,
  windowTitle: (v: any) => v,
}
const initialState = {}

export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state

  return {
    ...state,
    ...props,
  }
}
