import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ProveWebsiteChoice from '.'
import {connect} from '../../util/container'

type OwnProps = {}

export default connect(
  state => ({}),
  dispatch => ({
    onCancel: () => {
      dispatch(ProfileGen.createCancelAddProof())
      dispatch(RouteTreeGen.createClearModals())
    },
    onDNS: () => dispatch(ProfileGen.createAddProof({platform: 'dns'})),
    onFile: () => dispatch(ProfileGen.createAddProof({platform: 'web'})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(ProveWebsiteChoice)
