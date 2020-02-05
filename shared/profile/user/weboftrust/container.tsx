import * as Container from '../../../util/container'
import WebOfTrust from '.'

type OwnProps = {
  webOfTrustAttestation: {
    attestation: string
    attestingUser: string
    dateString: string
  }
}

const Connected = Container.connect(
  (_, ownProps: OwnProps) => {
    console.warn('ownProps', ownProps)
    const {attestation, attestingUser, dateString} = ownProps.webOfTrustAttestation
    return {
      attestation,
      attestingUser,
      dateString,
    }
  },
  () => ({}),
  stateProps => ({
    attestation: stateProps.attestation,
    attestingUser: stateProps.attestingUser,
    dateString: stateProps.dateString,
  })
)(WebOfTrust)

export default Connected
