import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

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
export const useActiveState = createZustand(
  immerZustand<ZState>(set => {
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
