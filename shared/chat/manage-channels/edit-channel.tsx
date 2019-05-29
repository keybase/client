import * as React from 'react'
import DeleteChannel from './delete-channel'
import {
  Avatar,
  Text,
  Box,
  Button,
  HeaderOrPopupWithHeader,
  Input,
  ProgressIndicator,
  ButtonBar,
} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'

export type Props = {
  teamname: string
  channelName: string
  topic: string
  loadChannelInfo: () => void
  onCancel: () => void
  onSave: (channelName: string, topic: string) => void
  onConfirmedDelete: () => void
  showDelete: boolean
  title: string
  deleteRenameDisabled: boolean
  waitingForGetInfo: boolean
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
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.channelName !== this.props.channelName) {
      this._onChangeChannelName(this.props.channelName)
    }
    if (prevProps.topic !== this.props.topic) {
      this._onChangeTopic(this.props.topic)
    }
  }

  render() {
    return (
      <Box style={_boxStyle}>
        <Avatar isTeam={true} teamname={this.props.teamname} size={32} />
        <Text type="BodySmallSemibold" style={{marginTop: globalMargins.xtiny}}>
          {this.props.teamname}
        </Text>
        {this.props.waitingForGetInfo ? (
          <ProgressIndicator
            style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny, width: 20}}
          />
        ) : (
          !isMobile && (
            <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
              {this.props.title}
            </Text>
          )
        )}
        <Box style={{position: 'relative'}}>
          <Input
            onChangeText={this._onChangeChannelName}
            hintText={this.props.waitingForGetInfo ? 'Loading channel name...' : 'Channel name'}
            editable={!this.props.waitingForGetInfo && !this.props.deleteRenameDisabled}
            value={this.state.newChannelName}
          />

          {this.props.deleteRenameDisabled && (
            <Text
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
            </Text>
          )}

          <Input
            onChangeText={this._onChangeTopic}
            editable={!this.props.waitingForGetInfo}
            hintText={
              this.props.waitingForGetInfo
                ? 'Loading channel description...'
                : 'Description or topic (optional)'
            }
            value={this.state.newTopic}
          />
        </Box>
        <Box style={_bottomRowStyle}>
          {!isMobile && this.props.showDelete && !this.props.deleteRenameDisabled && (
            <DeleteChannel
              channelName={this.props.channelName}
              onConfirmedDelete={this.props.onConfirmedDelete}
              disabled={this.props.deleteRenameDisabled}
            />
          )}
          <ButtonBar>
            <Button type="Dim" label="Cancel" onClick={this.props.onCancel} />
            <Button
              label="Save"
              disabled={
                this.props.channelName === this.state.newChannelName &&
                this.props.topic === this.state.newTopic
              }
              onClick={this._onSave}
              style={{marginLeft: globalMargins.tiny}}
            />
          </ButtonBar>
        </Box>
        {isMobile && this.props.showDelete && !this.props.deleteRenameDisabled && (
          <DeleteChannel
            channelName={this.props.channelName}
            onConfirmedDelete={this.props.onConfirmedDelete}
            disabled={false}
          />
        )}
      </Box>
    )
  }
}
const EditChannel = HeaderOrPopupWithHeader(_EditChannel)

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingBottom: globalMargins.medium,
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
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
