import ExplodingExplainer from '.'
import {RouteProps} from '../../../../route-tree/render-route'
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
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(ExplodingExplainer)
