import * as Z from '../util/zustand'

type ZStore = {
  active: boolean
}
const initialZState: ZStore = {
  active: true,
}
type ZState = ZStore & {
  dispatch: {
    setActive: (a: boolean) => void
  }
}
export const useActiveState = Z.createZustand(
  Z.immerZustand<ZState>(set => {
    const dispatch = {
      setActive: (a: boolean) => {
        set(s => {
          s.active = a
        })
      },
    }
    return {
      ...initialZState,
      dispatch,
    }
  })
)
