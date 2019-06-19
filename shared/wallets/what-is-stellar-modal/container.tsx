import WhatIsStellarModal from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(WhatIsStellarModal)
