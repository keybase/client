import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/tracker2'
import * as ConfigConstants from '../../constants/config'
import type * as Types from '../../constants/types/tracker2'
import Assertion from '.'
import openUrl from '../../util/open-url'
import type {PlatformsExpandedType} from '../../constants/types/more'

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

export default (ownProps: OwnProps) => {
  let a = Constants.noAssertion
  let notAUser = false
  let stellarHidden = false
  const isYours = ConfigConstants.useConfigState(s => ownProps.username === s.username)
  a = Container.useSelector(state => {
    if (ownProps.isSuggestion) {
      a =
        state.tracker2.proofSuggestions.find(s => s.assertionKey === ownProps.assertionKey) ||
        Constants.noAssertion
    } else {
      const d = Constants.getDetails(state, ownProps.username)
      if (isYours && d.stellarHidden) {
        stellarHidden = true
      }
      notAUser = d.state === 'notAUserYet'
      if (notAUser) {
        const nonUserDetails = Constants.getNonUserDetails(state, ownProps.username)
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

  const dispatch = Container.useDispatch()
  const _onCreateProof = (type: string) => {
    dispatch(ProfileGen.createAddProof({platform: type, reason: 'profile'}))
  }
  const _onHideStellar = (hidden: boolean) => {
    dispatch(ProfileGen.createHideStellar({hidden}))
  }
  const _onRecheck = (sigID: string) => {
    dispatch(ProfileGen.createRecheckProof({sigID}))
  }
  const _onRevokeProof = (
    type: PlatformsExpandedType,
    value: string,
    id: string,
    icon: Types.SiteIconSet
  ) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {props: {icon, platform: type, platformHandle: value, proofId: id}, selected: 'profileRevoke'},
        ],
      })
    )
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
      if (siteIconFull) _onRevokeProof(type as PlatformsExpandedType, value, _sigID, siteIconFull)
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
