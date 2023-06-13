import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

export type ZStore = {
  followers: Set<string>
  following: Set<string>
}
const initialZState: ZStore = {
  followers: new Set(),
  following: new Set(),
}

type ZState = ZStore & {
  dispatch: {
    reset: () => void
    replace: (followers: Set<string>, following: Set<string>) => void
    updateFollowing: (user: string, add: boolean) => void
    updateFollowers: (user: string, add: boolean) => void
  }
}
export const useFollowerState = createZustand(
  immerZustand<ZState>(set => {
    const dispatch = {
      replace: (followers: Set<string>, following: Set<string>) => {
        set(s => {
          s.followers = followers
          s.following = following
        })
      },
      reset: () => {
        set(() => ({
          ...initialZState,
        }))
      },
      updateFollowers: (user: string, add: boolean) => {
        set(s => {
          if (add) {
            s.followers.add(user)
          } else {
            s.followers.delete(user)
          }
        })
      },
      updateFollowing: (user: string, add: boolean) => {
        set(s => {
          if (add) {
            s.following.add(user)
          } else {
            s.following.delete(user)
          }
        })
      },
    }

    return {
      ...initialZState,
      dispatch,
    }
  })
)
