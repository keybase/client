import * as React from 'react'
import DeleteChannel from './delete-channel'
import * as Kb from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'

export type Props = {
  teamname: string
  channelName: string
  errorText: string
  topic: string
  loadChannelInfo: () => void
  onCancel: () => void
  onSetChannelCreationError: (error: string) => void
  onSave: (channelName: string, topic: string) => void
  onSaveSuccess: () => void
  onConfirmedDelete: () => void
  showDelete: boolean
  title: string
  deleteRenameDisabled: boolean
  waitingForGetInfo: boolean
  waitingOnSave: boolean
}

type State = {
  newChannelName: string
  newTopic: string
}

class _EditChannel extends React.Component<Props, State> {
  state = {newChannelName: this.props.channelName, newTopic: this.props.topic}

  _onChangeChannelName = newChannelName => this.setState({newChannelName})
  _onChangeTopic = newTopic => this.setState({newTopic})
  _onSave = () => this.props.onSave(this.state.newChannelName, this.state.newTopic)

  componentDidMount() {
    if (this.props.waitingForGetInfo) {
      this.props.loadChannelInfo()
    }
    this.props.onSetChannelCreationError('')
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.channelName !== this.props.channelName) {
      this._onChangeChannelName(this.props.channelName)
    }
    if (prevProps.topic !== this.props.topic) {
      this._onChangeTopic(this.props.topic)
    }
    if (prevProps.waitingOnSave && !this.props.waitingOnSave && !this.props.errorText) {
      this.props.onSaveSuccess()
    }
  }

  render() {
    return (
      <Kb.Box style={_boxStyle}>
        <Kb.Avatar isTeam={true} teamname={this.props.teamname} size={32} />
        <Kb.Text type="BodySmallSemibold" style={{marginTop: globalMargins.xtiny}}>
          {this.props.teamname}
        </Kb.Text>
        {this.props.waitingForGetInfo ? (
          <Kb.ProgressIndicator
            style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny, width: 20}}
          />
        ) : (
          !isMobile && (
            <Kb.Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
              {this.props.title}
            </Kb.Text>
          )
        )}
        {!!this.props.errorText && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={this.props.errorText} />
          </Kb.Banner>
        )}
        <Kb.Box style={{position: 'relative'}}>
          <Kb.Input
            autoFocus={true}
            onChangeText={this._onChangeChannelName}
            hintText={this.props.waitingForGetInfo ? 'Loading channel name...' : 'Channel name'}
            editable={!this.props.waitingForGetInfo && !this.props.deleteRenameDisabled}
            value={this.state.newChannelName}
          />

          {this.props.deleteRenameDisabled && (
            <Kb.Text
              center={true}
              type="BodySmall"
              style={{
                left: 0,
                position: 'absolute',
                right: 0,
                top: 60,
              }}
            >
              #general can’t be renamed or deleted.
            </Kb.Text>
          )}

          <Kb.Input
            onChangeText={this._onChangeTopic}
            editable={!this.props.waitingForGetInfo}
            hintText={
              this.props.waitingForGetInfo
                ? 'Loading channel description...'
                : 'Description or topic (optional)'
            }
            value={this.state.newTopic}
            multiline={true}
            rowsMin={1}
            rowsMax={isMobile ? 4 : 10}
            autoCorrect={true}
            autoCapitalize="sentences"
            // From go/chat/msgchecker/constants.go#HeadlineMaxLength
            maxLength={280}
          />
        </Kb.Box>
        <Kb.Box style={_bottomRowStyle}>
          {!isMobile && this.props.showDelete && !this.props.deleteRenameDisabled && (
            <DeleteChannel
              channelName={this.props.channelName}
              onConfirmedDelete={this.props.onConfirmedDelete}
              disabled={this.props.deleteRenameDisabled}
            />
          )}
          <Kb.ButtonBar>
            <Kb.Button type="Dim" label="Cancel" onClick={this.props.onCancel} />
            <Kb.Button
              label="Save"
              disabled={
                this.props.channelName === this.state.newChannelName &&
                this.props.topic === this.state.newTopic
              }
              waiting={this.props.waitingOnSave}
              onClick={this._onSave}
              style={{marginLeft: globalMargins.tiny}}
            />
          </Kb.ButtonBar>
        </Kb.Box>
        {isMobile && this.props.showDelete && !this.props.deleteRenameDisabled && (
          <DeleteChannel
            channelName={this.props.channelName}
            onConfirmedDelete={this.props.onConfirmedDelete}
            disabled={false}
          />
        )}
      </Kb.Box>
    )
  }
}
const EditChannel = Kb.HeaderOrPopupWithHeader(_EditChannel)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingBottom: globalMargins.medium,
  paddingTop: globalMargins.medium,
  ...(isMobile ? {flex: 1} : {}),
}

const _bottomRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-end',
  alignSelf: 'stretch',
  flex: 1,
  justifyContent: 'center',
  position: 'relative',
  ...(isMobile ? {} : {minWidth: '500px'}),
}

export default EditChannel
