import * as Z from '../util/zustand'

export type Store = {
  followers: Set<string>
  following: Set<string>
}
const initialStore: Store = {
  followers: new Set(),
  following: new Set(),
}

type State = Store & {
  dispatch: {
    resetState: () => void
    replace: (followers: Set<string>, following: Set<string>) => void
    updateFollowing: (user: string, add: boolean) => void
    updateFollowers: (user: string, add: boolean) => void
  }
}
export const useFollowerState = Z.createZustand<State>(set => {
  const dispatch = {
    replace: (followers: Set<string>, following: Set<string>) => {
      set(s => {
        s.followers = followers
        s.following = following
      })
    },
    resetState: () => {
      set(s => ({...s, ...initialStore}))
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
    ...initialStore,
    dispatch,
  }
})
