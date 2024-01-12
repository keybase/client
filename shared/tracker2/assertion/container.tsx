import * as React from 'react'
import * as C from '@/constants'
import * as Constants from '@/constants/tracker2'
import type * as T from '@/constants/types'
import Assertion from '.'
import openUrl from '@/util/open-url'

type OwnProps = {
  isSuggestion?: boolean
  username: string
  assertionKey: string
}

const notAUserAssertion = {
  assertionKey: '',
  belowFold: false,
  color: 'gray' as const,
  kid: '',
  metas: [{color: 'gray' as const, label: 'PENDING'}],
  pickerSubtext: '',
  pickerText: '',
  priority: 0,
  proofURL: '',
  sigID: '0',
  siteIcon: null,
  siteIconDarkmode: null,
  siteIconFull: null,
  siteIconFullDarkmode: null,
  siteURL: '',
  state: 'checking' as const,
  timestamp: 0,
}

const Container = (ownProps: OwnProps) => {
  let a = Constants.noAssertion
  let notAUser = false as boolean
  let stellarHidden = false
  const isYours = C.useCurrentUserState(s => ownProps.username === s.username)
  a = C.useTrackerState(
    C.useShallow(s => {
      if (ownProps.isSuggestion) {
        a = s.proofSuggestions.find(s => s.assertionKey === ownProps.assertionKey) || Constants.noAssertion
      } else {
        const d = Constants.getDetails(s, ownProps.username)
        if (isYours && d.stellarHidden) {
          stellarHidden = true
        }
        notAUser = d.state === 'notAUserYet'
        if (notAUser) {
          const nonUserDetails = Constants.getNonUserDetails(s, ownProps.username)
          a = {
            ...notAUserAssertion,
            siteIcon: nonUserDetails.siteIcon,
            siteIconDarkmode: nonUserDetails.siteIconDarkmode,
            siteIconFull: nonUserDetails.siteIconFull,
            siteIconFullDarkmode: nonUserDetails.siteIconFullDarkmode,
            siteURL: nonUserDetails.siteURL,
            type: nonUserDetails.assertionKey,
            value: nonUserDetails.assertionValue,
          }
        } else if (d.assertions) {
          a = d.assertions.get(ownProps.assertionKey) || Constants.noAssertion
        }
      }
      return a
    })
  )
  const {color, metas: _metas, proofURL, sigID, siteIcon} = a
  const {siteIconDarkmode, siteIconFull, siteIconFullDarkmode, siteURL, state, timestamp, type, value} = a
  const addProof = C.useProfileState(s => s.dispatch.addProof)
  const hideStellar = C.useProfileState(s => s.dispatch.hideStellar)
  const recheckProof = C.useProfileState(s => s.dispatch.recheckProof)
  const _onCreateProof = React.useCallback(() => {
    addProof(type, 'profile')
  }, [addProof, type])
  const onHideStellar = React.useCallback(
    (hidden: boolean) => {
      hideStellar(hidden)
    },
    [hideStellar]
  )
  const onRecheck = React.useCallback(() => {
    recheckProof(sigID)
  }, [recheckProof, sigID])

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const onRevoke = React.useCallback(() => {
    navigateAppend({
      props: {
        icon: siteIconFull,
        platform: type as T.More.PlatformsExpandedType,
        platformHandle: value,
        proofId: sigID,
      },
      selected: 'profileRevoke',
    })
  }, [type, value, sigID, siteIconFull, navigateAppend])

  const metas = React.useMemo(() => _metas.map(({color, label}) => ({color, label})), [_metas])

  const onCreateProof = notAUser ? undefined : ownProps.isSuggestion ? _onCreateProof : undefined

  const openProof = React.useCallback(() => {
    openUrl(proofURL)
  }, [proofURL])
  const openSite = React.useCallback(() => {
    openUrl(siteURL)
  }, [siteURL])

  const onShowProof = notAUser || !proofURL ? undefined : openProof
  const onShowSite = notAUser || !siteURL ? undefined : openSite
  const isSuggestion = !!ownProps.isSuggestion

  const props = {
    color,
    isSuggestion,
    isYours,
    metas,
    notAUser,
    onCreateProof,
    onHideStellar,
    onRecheck,
    onRevoke,
    onShowProof,
    onShowSite,
    proofURL,
    siteIcon,
    siteIconDarkmode,
    siteIconFull,
    siteIconFullDarkmode,
    siteURL,
    state,
    stellarHidden,
    timestamp,
    type,
    value,
  }
  return <Assertion {...props} />
}

export default Container
