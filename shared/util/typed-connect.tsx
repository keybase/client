import {
  connect,
  MapStateToProps,
  MapDispatchToProps,
  MergeProps,
  InferableComponentEnhancer,
  InferableComponentEnhancerWithProps,
} from 'react-redux'
import {compose, setDisplayName} from 'recompose'
export default connect

type State = any

export const namedConnect = <TStateProps, TDispatchProps, TOwnProps, TMergedProps>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, State>,
  mapDispatchToProps: MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string
): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
  compose(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps
    ),
    setDisplayName(displayName)
  )
