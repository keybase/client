import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/profile'
import WebOfTrust from '.'

type OwnProps = {
  webOfTrustAttestation: {
    attestation: string
    attestingUser: string
    dateString: string
    pending: boolean
    verificationType: Types.WebOfTrustVerificationType
  }
}

const Connected = Container.connect(
  (state, ownProps: OwnProps) => {
    const {attestation, attestingUser, dateString, pending, verificationType} = ownProps.webOfTrustAttestation
    return {
      attestation,
      attestingUser,
      dateString,
      pending,
      username: state.config.username,
      verificationType,
    }
  },
  () => ({
    _onAccept: () => {},
    _onHide: () => {},
    _onReject: () => {},
  }),
  (stateProps, dispatchProps) => ({
    attestation: stateProps.attestation,
    attestingUser: stateProps.attestingUser,
    dateString: stateProps.dateString,
    // Send these callback down based on what type of attestation it is.
    onAccept: dispatchProps._onAccept,
    onHide: dispatchProps._onHide,
    onReject: dispatchProps._onReject,
    pending: stateProps.pending,
    verificationType: stateProps.verificationType,
  })
)(WebOfTrust)

export default Connected
