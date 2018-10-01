// @flow
export const serialize = {}
const initialState = {}

export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state

  return {
    ...state,
    ...props,
  }
}
