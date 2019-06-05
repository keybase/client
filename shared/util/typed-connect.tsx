import {connect, MapStateToProps, MapDispatchToProps, MergeProps, Options} from 'react-redux'
import {setDisplayName, compose} from 'recompose'
import {TypedState} from '../constants/reducer'
export default connect

export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, TypedState>,
  mapDispatchToProps: MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: Options<TypedState, TStateProps, TOwnProps, TMergedProps>
) =>
  compose(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      options
    ),
    setDisplayName(displayName)
  )
