// @flow
import * as ProfileGen from '../../actions/profile-gen'
import ProveWebsiteChoice from '.'
import {connect} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(ProfileGen.createCancelAddProof()),
  onDNS: choice => dispatch(ProfileGen.createAddProof({platform: 'dns'})),
  onFile: choice => dispatch(ProfileGen.createAddProof({platform: 'web'})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ProveWebsiteChoice)
