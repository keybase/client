// @flow
import Qualify from '.'
// import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect, type RouteProps} from '../../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  // TODO
  loading: false,
  qualified: false,
  rows: [],
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => console.log('TODO'),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
