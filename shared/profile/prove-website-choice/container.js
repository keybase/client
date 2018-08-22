// @flow
import * as ProfileGen from '../../actions/profile-gen'
import ProveWebsiteChoice from '.'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // Pass https to addProof because addProof doesn't actually care if it's http/https, it will try
  // both with a preference for https
  onCancel: () => dispatch(ProfileGen.createCancelAddProof()),
  onOptionClick: choice =>
    dispatch(ProfileGen.createAddProof({platform: choice === 'file' ? 'https' : 'dns'})),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(
  ProveWebsiteChoice
)
