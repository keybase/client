import * as RR from 'react-redux'
import {compose, setDisplayName} from 'recompose'
import {TypedState} from '../constants/reducer'

const connect = RR.connect

export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: RR.Options<TypedState, TStateProps, TOwnProps, TMergedProps>
) =>
  (compose(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options
    ),
    setDisplayName(displayName)
  ) as unknown) as RR.ConnectedComponentType<TMergedProps, TOwnProps>

export const connectDEBUG = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  options?: RR.Options<TypedState, TStateProps, TOwnProps, TMergedProps>
) =>
  (connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    options
  ) as unknown) as RR.ConnectedComponentTypeDEBUG<TMergedProps, TOwnProps>

export default connect
