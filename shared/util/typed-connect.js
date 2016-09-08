// @flow

import {Component} from 'react'
import {connect} from 'react-redux'

type TypedMergeProps<State, Dispatch, OwnProps, Props> = (stateProps: State, dispatchProps: Dispatch, ownProps: OwnProps) => Props

export class ConnectedComponent<OwnProps> extends Component<void, OwnProps, void> {}

export class TypedConnector<State, Dispatch, OwnProps, Props> {
  connect (mergeProps: TypedMergeProps<State, Dispatch, OwnProps, Props>): (smartComponent: ReactClass<*>) => Class<ConnectedComponent<OwnProps>> {
    return connect(
      state => ({state}),
      dispatch => ({dispatch}),
      ({state}, {dispatch}, ownProps) => {
        return mergeProps(state, dispatch, ownProps)
      }
    )
  }
}

class _TypedConnectorV2<Props, StateProps, DispatchProps, OwnProps, Dispatch: Function, State> {
  connect(
    mapStateToProps: (state: Object, ownProps: OwnProps) => StateProps,
    mapDispatchToProps: (dispatch: Dispatch, ownProps: OwnProps) => DispatchProps,
    mergeProps: TypedMergeProps<StateProps, DispatchProps, OwnProps, Props>,
    options?: {pure?: boolean, withRef?: boolean}
  ): (component: ReactClass<Props>) => ReactClass<OwnProps> {
    return connect(mapStateToProps, mapDispatchToProps, mergeProps, options)
  }
}

export class TypedConnectorV2<State, Props, OwnProps> extends _TypedConnectorV2<Props, *, *, OwnProps, *, State> {}
