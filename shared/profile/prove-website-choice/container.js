// @flow
import * as ProfileGen from '../../actions/profile-gen'
import ProveWebsiteChoice from '.'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => dispatch(ProfileGen.createCancelAddProof()),
  onOptionClick: choice => dispatch(ProfileGen.createAddProof({platform: choice === 'file' ? 'web' : 'dns'})),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(
  ProveWebsiteChoice
)
