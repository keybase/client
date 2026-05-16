import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {generateGUIID, ignorePromise} from '@/constants/utils'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {navigateAppend, navigateUp} from '@/constants/router'
import {
  identifyResultToDetailsState,
  makeDetails,
  noNonUserDetails,
  updateTrackerDetailsBlocked,
  updateTrackerDetailsReset,
  updateTrackerDetailsResult,
  updateTrackerDetailsRow,
  updateTrackerDetailsSummary,
  updateTrackerDetailsUserCard,
} from './model'

type Options = {
  reloadOnFocus?: boolean
}

const makeNonUserDetails = (): T.Tracker.NonUserDetails => ({...noNonUserDetails})
type NonUserDetailsState = {
  details: T.Tracker.NonUserDetails
  username: string
}

export const useTrackerProfile = (username: string, options?: Options) => {
  const currentUser = useCurrentUserState(
    C.useShallow(s => ({
      uid: s.uid,
      username: s.username,
    }))
  )
  const [details, setDetails] = React.useState<T.Tracker.Details>(() => makeDetails(username))
  const [nonUserDetails, setNonUserDetails] = React.useState<NonUserDetailsState>(() => ({
    details: makeNonUserDetails(),
    username,
  }))
  const requestVersionRef = React.useRef(0)
  const detailsRef = React.useRef(details)
  const hasSeenFocusRef = React.useRef(false)

  React.useEffect(() => {
    detailsRef.current = details
  }, [details])

  const loadNonUserProfile = React.useCallback(() => {
    if (!username) {
      return
    }
    const assertion = username
    const version = requestVersionRef.current
    const f = async () => {
      try {
        const res = await T.RPCGen.userSearchGetNonUserDetailsRpcPromise({assertion})
        if (requestVersionRef.current !== version || !res.isNonUser) {
          return
        }
        const common = {
          assertionKey: res.assertionKey,
          assertionValue: res.assertionValue,
          description: res.description,
          siteIcon: res.siteIcon || [],
          siteIconDarkmode: res.siteIconDarkmode || [],
          siteIconFull: res.siteIconFull || [],
          siteIconFullDarkmode: res.siteIconFullDarkmode || [],
          siteURL: '',
        }
        if (res.service) {
          setNonUserDetails({details: {...makeNonUserDetails(), ...common, ...res.service}, username})
        } else {
          const {formatPhoneNumberInternational} = await import('@/util/phone-numbers')
          const formattedName =
            res.assertionKey === 'phone' ? formatPhoneNumberInternational('+' + res.assertionValue) : undefined
          const fullName = res.contact?.contactName ?? ''
          if (requestVersionRef.current !== version) {
            return
          }
          setNonUserDetails({
            details: {...makeNonUserDetails(), ...common, formattedName, fullName},
            username,
          })
        }
      } catch (error) {
        if (error instanceof RPCError) {
          logger.warn(`Error loading non user profile: ${error.message}`)
        }
      }
    }
    ignorePromise(f())
  }, [username])

  const loadProfile = React.useCallback(
    (ignoreCache = true) => {
      if (!username) {
        return
      }
      const guiID = generateGUIID()
      const version = requestVersionRef.current + 1
      requestVersionRef.current = version
      const preserveExistingData = detailsRef.current.username === username

      setDetails(prev => ({
        ...(preserveExistingData ? prev : makeDetails(username)),
        guiID,
        reason: preserveExistingData && prev.resetBrokeTrack ? prev.reason : '',
        resetBrokeTrack: preserveExistingData ? prev.resetBrokeTrack : false,
        state: 'checking',
      }))

      const load = async () => {
        try {
          await T.RPCGen.identify3Identify3RpcListener({
            incomingCallMap: {},
            params: {assertion: username, guiID, ignoreCache},
            waitingKey: C.waitingKeyTrackerProfileLoad,
          })
        } catch (error) {
          if (!(error instanceof RPCError) || requestVersionRef.current !== version) {
            return
          }
          if (error.code === T.RPCGen.StatusCode.scresolutionfailed) {
            setDetails(prev => ({...prev, state: 'notAUserYet'}))
            loadNonUserProfile()
          } else if (error.code === T.RPCGen.StatusCode.scnotfound) {
            navigateUp()
            navigateAppend({
              name: 'keybaseLinkError',
              params: {
                error: `You followed a profile link for a user (${username}) that does not exist.`,
              },
            })
          }
          logger.error(`Error loading profile: ${error.message}`)
        }
      }
      ignorePromise(load())

      const loadFollowers = async () => {
        try {
          const fs = await T.RPCGen.userListTrackersUnverifiedRpcPromise(
            {assertion: username},
            C.waitingKeyTrackerProfileLoad
          )
          if (requestVersionRef.current !== version) {
            return
          }
          setDetails(prev => ({
            ...prev,
            followers: new Set((fs.users ?? []).map(f => f.username)),
            followersCount: fs.users?.length ?? 0,
          }))
          if (fs.users) {
            useUsersState
              .getState()
              .dispatch.updates(fs.users.map(u => ({info: {fullname: u.fullName}, name: u.username})))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error loading follower info: ${error.message}`)
          }
        }
      }
      ignorePromise(loadFollowers())

      const loadFollowing = async () => {
        try {
          const fs = await T.RPCGen.userListTrackingRpcPromise(
            {assertion: username, filter: ''},
            C.waitingKeyTrackerProfileLoad
          )
          if (requestVersionRef.current !== version) {
            return
          }
          setDetails(prev => ({
            ...prev,
            following: new Set((fs.users ?? []).map(f => f.username)),
            followingCount: fs.users?.length ?? 0,
          }))
          if (fs.users) {
            useUsersState
              .getState()
              .dispatch.updates(fs.users.map(u => ({info: {fullname: u.fullName}, name: u.username})))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error loading following info: ${error.message}`)
          }
        }
      }
      ignorePromise(loadFollowing())
    },
    [loadNonUserProfile, username]
  )

  React.useEffect(() => {
    if (username) {
      loadProfile()
    }
  }, [loadProfile, username])

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
      loadProfile(false)
    }, [loadProfile, options?.reloadOnFocus])
  )

  useEngineActionListener('keybase.1.NotifyTracking.trackingChanged', action => {
    if (action.payload.params.username === username && detailsRef.current.guiID) {
      loadProfile()
    }
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3Result', action => {
    const {guiID, result} = action.payload.params
    if (guiID !== detailsRef.current.guiID) {
      return
    }
    setDetails(prev => updateTrackerDetailsResult(prev, identifyResultToDetailsState(result)))
  })

  useEngineActionListener('keybase.1.NotifyUsers.userChanged', action => {
    if (currentUser.username === username && currentUser.uid === action.payload.params.uid) {
      loadProfile(false)
    }
  })

  useEngineActionListener('keybase.1.NotifyTracking.notifyUserBlocked', action => {
    setDetails(prev => updateTrackerDetailsBlocked(prev, action.payload.params.b))
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3UpdateRow', action => {
    const {row} = action.payload.params
    if (row.guiID !== detailsRef.current.guiID) {
      return
    }
    setDetails(prev => updateTrackerDetailsRow(prev, row))
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3UserReset', action => {
    if (action.payload.params.guiID !== detailsRef.current.guiID) {
      return
    }
    setDetails(prev => updateTrackerDetailsReset(prev))
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3UpdateUserCard', action => {
    const {guiID, card} = action.payload.params
    if (guiID !== detailsRef.current.guiID) {
      return
    }
    setDetails(prev => updateTrackerDetailsUserCard(prev, card))
    useUsersState.getState().dispatch.updates([{info: {fullname: card.fullName}, name: username}])
  })

  useEngineActionListener('keybase.1.identify3Ui.identify3Summary', action => {
    const {summary} = action.payload.params
    if (summary.guiID !== detailsRef.current.guiID) {
      return
    }
    setDetails(prev => updateTrackerDetailsSummary(prev, summary))
  })

  const detailsForUsername = details.username === username ? details : makeDetails(username)
  const nonUserDetailsForUsername =
    nonUserDetails.username === username ? nonUserDetails.details : makeNonUserDetails()

  return {
    details: detailsForUsername,
    loadNonUserProfile,
    loadProfile,
    nonUserDetails: nonUserDetailsForUsername,
  }
}
