// @flow
import * as React from 'react'
import {connect} from 'react-redux'

type TypedMergeProps<State, Dispatch, OwnProps, Props> = (
  state: State,
  dispatch: Dispatch,
  ownProps: OwnProps
) => Props

export class ConnectedComponent<OwnProps> extends React.Component<OwnProps> {}

export class TypedConnector<State, Dispatch, OwnProps, Props> {
  connect(
    mergeProps: TypedMergeProps<State, Dispatch, OwnProps, Props>
  ): (smartComponent: React.ComponentType<*>) => Class<ConnectedComponent<OwnProps>> {
    // $FlowIssue doesn't play nice with other typed connect
    return connect(
      state => ({state}),
      dispatch => ({dispatch}),
      ({state}, {dispatch}, ownProps) => {
        return mergeProps(state, dispatch, ownProps)
      }
    )
  }
}
