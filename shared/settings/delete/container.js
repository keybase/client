// @flow
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Delete from './index'
import {connect} from '../../util/container'

type OwnProps = {||}
const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onDelete: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Delete)
