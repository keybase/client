import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ProveWebsiteChoice from '.'
import {connect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(ProfileGen.createCancelAddProof())
    dispatch(RouteTreeGen.createClearModals())
  },
  onDNS: () => dispatch(ProfileGen.createAddProof({platform: 'dns'})),
  onFile: () => dispatch(ProfileGen.createAddProof({platform: 'web'})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ProveWebsiteChoice)
