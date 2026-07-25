import * as C from '@/constants'
import * as React from 'react'
import {makeDetails, noNonUserDetails} from './model'
import {
  getProfileDetails,
  getProfileNonUserDetails,
  loadNonUserProfile,
  loadProfileIdentify,
  subscribeToProfile,
} from './identify-session'

type Options = {
  // surfaces that only want loadProfile() to call after an action, and never
  // read details, can skip the identify their mount would otherwise trigger
  loadOnMount?: boolean
  reloadOnFocus?: boolean
}

export const useTrackerProfile = (username: string, options?: Options) => {
  const hasSeenFocusRef = React.useRef(false)
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
  React.useEffect(() => {
    if (loadOnMount) {
      loadProfileIdentify(username, {freshAfter: 0, ignoreCache: true})
    }
  }, [loadOnMount, username])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (!options?.reloadOnFocus) {
        return
      }
      // The initial mount path already loads once. Skip the first focus callback
      // so entering the screen does not immediately trigger a second hard reload.
      if (!hasSeenFocusRef.current) {
        hasSeenFocusRef.current = true
        return
      }
      loadProfileIdentify(username, {freshAfter: 0, ignoreCache: false})
    }, [options?.reloadOnFocus, username])
  )

  return {
    details,
    loadNonUserProfile: loadNonUser,
    loadProfile,
    nonUserDetails,
  }
}
