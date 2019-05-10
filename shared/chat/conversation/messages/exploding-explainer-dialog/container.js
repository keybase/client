// @flow
import ExplodingExplainer from '.'
import {type RouteProps} from '../../../../route-tree/render-route'
import {compose, connect} from '../../../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state, ownProps: OwnProps) => ({})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onCancel: () => {},
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onCancel,
  onCancel: dispatchProps.onCancel,
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(ExplodingExplainer)
