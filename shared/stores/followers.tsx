import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
// This store has no dependencies on other stores and is safe to import directly from other stores.
type Store = T.Immutable<{
  followers: Set<string>
  following: Set<string>
}>
const initialStore: Store = {
  followers: new Set(),
  following: new Set(),
}

export interface State extends Store {
  dispatch: {
    resetState: 'default'
    replace: (followers: ReadonlySet<string>, following: ReadonlySet<string>) => void
    updateFollowing: (user: string, add: boolean) => void
    updateFollowers: (user: string, add: boolean) => void
  }
}
export const useFollowerState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    replace: (followers, following) => {
      set(s => {
        s.followers = T.castDraft(followers)
        s.following = T.castDraft(following)
      })
    },
    resetState: 'default',
    updateFollowers: (user, add) => {
      set(s => {
        if (add) {
          s.followers.add(user)
        } else {
          s.followers.delete(user)
        }
      })
    },
    updateFollowing: (user, add) => {
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
