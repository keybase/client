// @flow
import React, {Component} from 'react'
import PaperKey from '.'
import {connect} from 'react-redux-profiled'
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'

export type Props = {
  onSubmit: (paperKey: string) => void,
  onBack: () => void,
  waitingForResponse?: boolean,
  error: string,
}

export type State = {
  paperKey: string,
}

// TODO remove this class
class _PaperKey extends Component<void, Props, State> {
  state: State

  constructor(props) {
    super(props)

    this.state = {
      paperKey: '',
    }
  }

  render() {
    return (
      <PaperKey
        onSubmit={() => this.props.onSubmit(this.state.paperKey)}
        onChangePaperKey={paperKey => this.setState({paperKey})}
        onBack={this.props.onBack}
        paperKey={this.state.paperKey}
        error={this.props.error}
        waitingForResponse={this.props.waitingForResponse}
      />
    )
  }
}

type OwnProps = RouteProps<
  {
    error: string,
  },
  {}
>

const mapStateToProps = (state: TypedState, {routeProps: {error}}: OwnProps) => ({
  waitingForResponse: state.engine.get('rpcWaitingStates').get('loginRpc'),
  error,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: paperkey => dispatch(Creators.submitPassphrase(new HiddenString(paperkey), false)),
})

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(_PaperKey)
