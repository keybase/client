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
  a = C.useTrackerState(s => {
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
  const _metas = a.metas
  const _sigID = a.sigID
  const color = a.color
  const proofURL = a.proofURL
  const siteIcon = a.siteIcon
  const siteIconDarkmode = a.siteIconDarkmode
  const siteIconFull = a.siteIconFull
  const siteIconFullDarkmode = a.siteIconFullDarkmode
  const siteURL = a.siteURL
  const state = a.state
  const timestamp = a.timestamp
  const type = a.type
  const value = a.value
  const addProof = C.useProfileState(s => s.dispatch.addProof)
  const hideStellar = C.useProfileState(s => s.dispatch.hideStellar)
  const recheckProof = C.useProfileState(s => s.dispatch.recheckProof)
  const _onCreateProof = (type: string) => {
    addProof(type, 'profile')
  }
  const _onHideStellar = (hidden: boolean) => {
    hideStellar(hidden)
  }
  const _onRecheck = (sigID: string) => {
    recheckProof(sigID)
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onRevokeProof = (
    type: T.More.PlatformsExpandedType,
    value: string,
    id: string,
    icon: T.Tracker.SiteIconSet
  ) => {
    navigateAppend({
      props: {icon, platform: type, platformHandle: value, proofId: id},
      selected: 'profileRevoke',
    })
  }
  const props = {
    color: color,
    isSuggestion: !!ownProps.isSuggestion,
    isYours: isYours,
    metas: _metas.map(({color, label}) => ({color, label})),
    notAUser: notAUser,
    onCreateProof: notAUser ? undefined : ownProps.isSuggestion ? () => _onCreateProof(type) : undefined,
    onHideStellar: (hidden: boolean) => _onHideStellar(hidden),
    onRecheck: () => _onRecheck(_sigID),
    onRevoke: () => {
      _onRevokeProof(type as T.More.PlatformsExpandedType, value, _sigID, siteIconFull)
    },
    onShowProof: notAUser || !proofURL ? undefined : () => openUrl(proofURL),
    onShowSite: notAUser || !siteURL ? undefined : () => openUrl(siteURL),
    proofURL: proofURL,
    siteIcon: siteIcon,
    siteIconDarkmode: siteIconDarkmode,
    siteIconFull: siteIconFull,
    siteIconFullDarkmode: siteIconFullDarkmode,
    siteURL: siteURL,
    state: state,
    stellarHidden: stellarHidden,
    timestamp: timestamp,
    type: type,
    value: value,
  }
  return <Assertion {...props} />
}

export default Container
