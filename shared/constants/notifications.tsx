import * as Z from '../util/zustand'
// import * as Types from './types/notifications'

type State = {}
const initialState: State = {}

type ZState = State & {
  dispatch: {
    reset: () => void
  }
}

export const useState = Z.createZustand(
  Z.immerZustand<ZState>(set => {
    // const reduxDispatch = Z.getReduxDispatch()

    const dispatch = {
      reset: () => {
        set(() => initialState)
      },
    }
    return {
      ...initialState,
      dispatch,
    }
  })
)
