// @flow
import React, {Component} from 'react'
import RemoteComponent from './remote-component.desktop'
import {connect, type TypedState} from '../../util/container'
import {registerRekeyListener, close} from '../../actions/unlock-folders'

type Props = {
  close: () => void,
  closed: boolean,
  registerRekeyListener: () => void,
}

class RemoteUnlockFolders extends Component<Props> {
  componentWillMount() {
    this.props.registerRekeyListener()
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps !== this.props
  }

  render() {
    const {closed} = this.props
    if (closed) {
      return null
    }

    const windowsOpts = {width: 500, height: 300}
    return (
      <div>
        <RemoteComponent
          title="UnlockFolders"
          windowsOpts={windowsOpts}
          waitForState={true}
          onRemoteClose={() => this.props.close()}
          component="unlockFolders"
          onSubmit={() => {}}
          onCancel={() => this.props.close()}
          sessionID={0}
        />
      </div>
    )
  }
}

const mapStateToProps = (state: TypedState) => state.unlockFolders
const mapDispatchToProps = (dispatch: Dispatch) => ({
  registerRekeyListener: () => dispatch(registerRekeyListener()),
  close: () => dispatch(close()),
})
export default connect(mapStateToProps, mapDispatchToProps)(RemoteUnlockFolders)
