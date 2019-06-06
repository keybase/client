import * as RR from 'react-redux'
import {compose, setDisplayName} from 'recompose'
import {TypedState} from '../constants/reducer'

export const connect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps, TypedState>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  options?: RR.Options<TypedState, TStateProps, TOwnProps, TMergedProps>
) => RR.connect(mapStateToProps, mapDispatchToProps, mergeProps, options)

export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps, TypedState>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: RR.Options<TypedState, TStateProps, TOwnProps, TMergedProps>
): RR.InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
  // @ts-ignore
  compose(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options
    ),
    setDisplayName(displayName)
  )

export default connect
