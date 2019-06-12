import * as RR from 'react-redux'

type MapStateToProps<TStateProps, TOwnProps, State> = (state: State, ownProps: TOwnProps) => TStateProps

const connect = <RemoteState, TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: MapStateToProps<TStateProps, TOwnProps, RemoteState>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  options?: RR.Options<RemoteState, TStateProps, TOwnProps, TMergedProps>
): RR.InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
    // @ts-ignore
    RR.connect(mapStateToProps, mapDispatchToProps, mergeProps, options)

export default connect
