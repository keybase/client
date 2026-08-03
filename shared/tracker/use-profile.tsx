import * as React from 'react'
import {makeDetails, noNonUserDetails} from './model'
import {
  getProfileDetails,
  getProfileNonUserDetails,
  loadNonUserProfile,
  loadProfileIdentify,
  subscribeToProfile,
} from './identify-session'

// Reopening a profile you were just looking at re-runs every proof check, and
// each one is an outbound request to a third-party host. Opening it again within
// this window reuses the check that just ran; an explicit reload always forces.
const profileRecheckMs = 30_000

// There is deliberately no focus-based reload here. Only mounting, an explicit
// reload, or a tracking / userChanged notification starts an identify: refocusing
// a screen that stayed mounted is not a signal that the identity changed, and
// treating it as one made every tab switch re-check every proof.

type Options = {
  // surfaces that only want loadProfile() to call after an action, and never
  // read details, can skip the identify their mount would otherwise trigger
  loadOnMount?: boolean
  // Opening a profile means "check this identity now", so it forces a remote
  // check of every proof. Incidental surfaces - a hover card, a follow button in
  // a list - do not: they still need an identify session, but the cached proof
  // results answer them, and forcing one re-fetches every proof from its
  // third-party host, which those hosts rate limit.
  cachedOnMount?: boolean
}

export const useTrackerProfile = (username: string, options?: Options) => {
  const emptyDetails = React.useMemo(() => makeDetails(username), [username])

  const subscribe = React.useCallback((cb: () => void) => subscribeToProfile(username, cb), [username])
  const getDetails = React.useCallback(() => getProfileDetails(username) ?? emptyDetails, [
    emptyDetails,
    username,
  ])
  const getNonUserDetails = React.useCallback(
    () => getProfileNonUserDetails(username) ?? noNonUserDetails,
    [username]
  )
  const details = React.useSyncExternalStore(subscribe, getDetails)
  const nonUserDetails = React.useSyncExternalStore(subscribe, getNonUserDetails)

  const loadNonUser = React.useCallback(() => {
    loadNonUserProfile(username)
  }, [username])

  // Every caller of this is a deliberate user action (opening reload, or a
  // refresh after follow / profile edit), so it never joins an identify that
  // was already running.
  const loadProfile = React.useCallback(
    (ignoreCache = true) => {
      loadProfileIdentify(username, {freshAfter: Infinity, ignoreCache})
    },
    [username]
  )

  const loadOnMount = options?.loadOnMount ?? true
  const cachedOnMount = options?.cachedOnMount ?? false
  React.useEffect(() => {
    if (loadOnMount) {
      loadProfileIdentify(username, {
        freshAfter: 0,
        ignoreCache: !cachedOnMount,
        maxAgeMs: profileRecheckMs,
      })
    }
  }, [cachedOnMount, loadOnMount, username])

  return {
    details,
    loadNonUserProfile: loadNonUser,
    loadProfile,
    nonUserDetails,
  }
}
