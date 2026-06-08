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

export type State = Store & {
  dispatch: {
    resetState: () => void
    replace: (followers: ReadonlySet<string>, following: ReadonlySet<string>) => void
    updateFollowing: (user: string, add: boolean) => void
    updateFollowers: (user: string, add: boolean) => void
  }
}
export const useFollowerState = Z.createZustand<State>('followers', set => {
  const dispatch: State['dispatch'] = {
    replace: (followers, following) => {
      set(s => {
        s.followers = T.castDraft(followers)
        s.following = T.castDraft(following)
      })
    },
    resetState: Z.defaultReset,
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
