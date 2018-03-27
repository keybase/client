// @flow
import * as React from 'react'
import {compose, connect, type TypedState} from '../../../util/container'
import {HOCTimers} from '../../../common-adapters'
import {SaveStateComponent} from './notifications'
import {setRetentionLoadingKey} from '../../../constants/chat2'
import {type ConversationIDKey} from '../../../constants/types/chat2'
import RetentionPicker from '../../../teams/team/settings/retention/container'
import {platformStyles} from '../../../styles'

export type OwnProps = {
  conversationIDKey: ConversationIDKey,
  teamname: string,
  isTeamWide: boolean,
  isSmallTeam: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const loading = !!state.chat2.loadingMap.get(setRetentionLoadingKey(ownProps.conversationIDKey))
  return {loading}
}

// How long to stay in the justSaved state.
const savedTimeoutMs = 2500

type Props = OwnProps & {loading: boolean, setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout}

type SaveState = 'same' | 'saving' | 'justSaved'
type State = {
  saveState: SaveState,
}
class InfoPanelRetention extends React.Component<Props, State> {
  _timeoutID: ?number
  state = {saveState: 'same'}

  _clearTimeout = () => {
    this._timeoutID && this.props.clearTimeout(this._timeoutID)
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.loading && !this.props.loading) {
      this._clearTimeout()
      this.setState({saveState: 'saving'})
    } else if (!nextProps.loading && this.props.loading) {
      this.setState({saveState: 'justSaved'})
      this._clearTimeout()
      this._timeoutID = this.props.setTimeout(() => this.setState({saveState: 'same'}), savedTimeoutMs)
    }
  }

  componentWillUnmount() {
    this._clearTimeout()
  }

  render() {
    return (
      <React.Fragment>
        <RetentionPicker
          key="retention"
          containerStyle={retentionStyles.containerStyle}
          dropdownStyle={retentionStyles.dropdownStyle}
          conversationIDKey={this.props.conversationIDKey}
          teamname={this.props.teamname}
          type="auto"
          isTeamWide={this.props.isTeamWide}
          isSmallTeam={this.props.isSmallTeam}
        />
        <SaveStateComponent {...this.state} />
      </React.Fragment>
    )
  }
}

const retentionStyles = {
  containerStyle: platformStyles({
    common: {
      marginLeft: 16,
      marginRight: 45,
    },
  }),
  dropdownStyle: platformStyles({
    common: {
      width: '100%',
    },
  }),
}

export default compose(connect(mapStateToProps), HOCTimers)(InfoPanelRetention)
