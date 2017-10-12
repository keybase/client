// @flow
import React, {Component} from 'react'
import PaperKey from '.'
import {connect, type TypedState} from '../../../util/container'
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'
import {type RouteProps} from '../../../route-tree/render-route'

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
class _PaperKey extends Component<Props, State> {
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

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => ({
  waitingForResponse: state.engine.get('rpcWaitingStates').get('loginRpc'),
  error: routeProps.get('error'),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: paperkey => dispatch(Creators.submitPassphrase(new HiddenString(paperkey), false)),
})

export default connect(mapStateToProps, mapDispatchToProps)(_PaperKey)
