import {
  connect,
  MapStateToProps,
  MapDispatchToProps,
  MergeProps,
  Options,
  InferableComponentEnhancerWithProps,
  ResolveThunks,
} from 'react-redux'
import {setDisplayName} from 'recompose'
export default connect

// typed for real in the js.flow file
export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps, State>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, State>,
  mapDispatchToProps: MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: Options<State, TStateProps, TOwnProps, TMergedProps>
): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
  setDisplayName(displayName)(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options
    )
  )
