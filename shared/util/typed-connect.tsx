import {
  connect,
  MapStateToProps,
  MapDispatchToProps,
  MergeProps,
  Options,
  InferableComponentEnhancerWithProps,
} from 'react-redux'
import {setDisplayName, compose} from 'recompose'
import {TypedState} from '../constants/reducer'
export default connect

type PassThrough <T> = (t: T) => T

export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, TypedState>,
  mapDispatchToProps: MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: Options<TypedState, TStateProps, TOwnProps, TMergedProps>
): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> => {
    // const ignoredSDN: PassThrough =  setDisplayName(displayName)
    // return compose(
    return connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    options
    )//,
// ignoredSDN
    // )
}
