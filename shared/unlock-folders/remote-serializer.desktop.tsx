export const serialize = {
  devices: (v: any) => v,
  paperkeyError: (v: any) => v,
  phase: (v: any) => v,
  waiting: (v: any) => v,
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
