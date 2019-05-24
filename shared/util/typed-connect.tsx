import {
  connect,
  MapStateToProps,
  MapDispatchToProps,
  MergeProps,
  Options,
  InferableComponentEnhancerWithProps,
  ResolveThunks,
} from 'react-redux'
import {setDisplayName, compose} from 'recompose'
export default connect

export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps, State>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, State>,
  mapDispatchToProps: MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: Options<State, TStateProps, TOwnProps, TMergedProps>
): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
  compose(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options
    ),
    setDisplayName(displayName)
  )
