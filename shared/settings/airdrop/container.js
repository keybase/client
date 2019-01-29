// @flow
import Airdrop from '.'
// import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  // TODO
  signedUp: false,
})

const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  onCheckQualify: () => dispatch(navigateAppend(['airdropQualify'])),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Airdrop)
