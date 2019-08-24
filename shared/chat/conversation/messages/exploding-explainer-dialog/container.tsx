import ExplodingExplainer from '.'
import * as Container from '../../../../util/container'

type OwnProps = {}

export default Container.compose(
  Container.connect(
    _ => ({}),
    () => ({onCancel: () => {}}),
    (_, dispatchProps, __: OwnProps) => ({
      onBack: dispatchProps.onCancel,
      onCancel: dispatchProps.onCancel,
    })
  )
)(ExplodingExplainer)
