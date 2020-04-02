import * as Container from '../../../util/container'
import * as UsersGen from '../../../actions/users-gen'
import WebOfTrust from '.'
import {WebOfTrustVerificationType} from '../../../constants/types/more'
import {wotReactWaitingKey} from '../../../constants/users'
import {WotReactionType, WotStatusType} from '../../../constants/types/rpc-gen'

type OwnProps = {
  webOfTrustAttestation: {
    attestation: string
    attestingUser: string
    status: WotStatusType
    verificationType: WebOfTrustVerificationType
    vouchedAt: number
  }
  username: string
}

const Connected = Container.connect(
  (state, ownProps: OwnProps) => {
    const {username, webOfTrustAttestation} = ownProps
    const {attestation, attestingUser, vouchedAt, status, verificationType} = webOfTrustAttestation
    const userIsYou = ownProps.username === state.config.username
    return {
      attestation,
      attestingUser,
      status,
      userIsYou,
      username,
      verificationType,
      vouchedAt,
    }
  },
  (dispatch: Container.TypedDispatch, {webOfTrustAttestation}: OwnProps) => {
    const {status, attestingUser} = webOfTrustAttestation
    return {
      _onAccept: () =>
        status === WotStatusType.proposed
          ? dispatch(UsersGen.createWotReact({reaction: WotReactionType.accept, voucher: attestingUser}))
          : null,
      _onReject: () =>
        status === WotStatusType.proposed
          ? dispatch(UsersGen.createWotReact({reaction: WotReactionType.reject, voucher: attestingUser}))
          : null,
    }
  },
  (stateProps, dispatchProps) => ({
    attestation: stateProps.attestation,
    attestingUser: stateProps.attestingUser,
    onAccept: dispatchProps._onAccept,
    onReject: dispatchProps._onReject,
    reactWaitingKey: wotReactWaitingKey,
    status: stateProps.status,
    userIsYou: stateProps.userIsYou,
    username: stateProps.username,
    verificationType: stateProps.verificationType,
    vouchedAt: stateProps.vouchedAt,
  })
)(WebOfTrust)

export default Connected
