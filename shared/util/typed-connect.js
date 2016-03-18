// @flow

import {Component} from 'react'
import {connect} from 'react-redux'

type TypedMergeProps<State, Dispatch, OwnProps, Props> = (state: State, dispatch: Dispatch, ownProps: OwnProps) => Props

export class ConnectedComponent<OwnProps> extends Component<void, OwnProps, void> {}

export default function typedConnect<State, Dispatch, OwnProps, Props> (mergeProps: TypedMergeProps<State, Dispatch, OwnProps, Props>): (smartComponent: ReactClass<Props>) => Class<ConnectedComponent<OwnProps>> {
  return connect(
    state => ({state}),
    dispatch => ({dispatch}),
    ({state}, {dispatch}, ownProps) => {
      return mergeProps(state, dispatch, ownProps)
    }
  )
}
