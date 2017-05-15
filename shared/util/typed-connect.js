// @flow
import {Component} from 'react'
import {connect} from 'react-redux'

type TypedMergeProps<State, Dispatch, OwnProps, Props> = (
  state: State,
  dispatch: Dispatch,
  ownProps: OwnProps
) => Props

export class ConnectedComponent<OwnProps> extends Component<void, OwnProps, void> {}

export class TypedConnector<State, Dispatch, OwnProps, Props> {
  connect(
    mergeProps: TypedMergeProps<State, Dispatch, OwnProps, Props>
  ): (smartComponent: ReactClass<*>) => Class<ConnectedComponent<OwnProps>> {
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
