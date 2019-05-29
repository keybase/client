import {
  connect,
  MapStateToProps,
  MapDispatchToProps,
  MergeProps,
  Options,
  InferableComponentEnhancerWithProps,
  ResolveThunks,
} from 'react-redux'
export default connect

export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps, State>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, State>,
  mapDispatchToProps: MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: Options<State, TStateProps, TOwnProps, TMergedProps>
): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    {...options, getDisplayName: () => displayName}
  )
