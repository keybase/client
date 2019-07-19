import ExplodingExplainer from '.'
import {RouteProps} from '../../../../route-tree/render-route'
import {compose, connect} from '../../../../util/container'

type OwnProps = RouteProps

const mapStateToProps = _ => ({})

const mapDispatchToProps = () => ({
  onCancel: () => {},
})

const mergeProps = (_, dispatchProps, __: OwnProps) => ({
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
