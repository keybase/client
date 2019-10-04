import * as React from 'react'
import DeleteChannel from './delete-channel'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

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
      <Kb.Box style={styles.box}>
        <Kb.Avatar isTeam={true} teamname={this.props.teamname} size={32} />
        <Kb.Text type="BodySmallSemibold" style={{marginTop: Styles.globalMargins.xtiny}}>
          {this.props.teamname}
        </Kb.Text>
        {this.props.waitingForGetInfo ? (
          <Kb.ProgressIndicator
            type="Large"
            style={{marginBottom: Styles.globalMargins.xtiny, marginTop: Styles.globalMargins.xtiny}}
          />
        ) : (
          !Styles.isMobile && (
            <Kb.Text
              type="Header"
              style={{marginBottom: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.tiny}}
            >
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
            rowsMax={Styles.isMobile ? 2 : 10}
            autoCorrect={true}
            autoCapitalize="sentences"
            // From go/chat/msgchecker/constants.go#HeadlineMaxLength
            maxLength={280}
          />
        </Kb.Box>
        <Kb.Box style={styles.bottomRow}>
          {!Styles.isMobile && this.props.showDelete && !this.props.deleteRenameDisabled && (
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
              style={{marginLeft: Styles.globalMargins.tiny}}
            />
          </Kb.ButtonBar>
        </Kb.Box>
        {Styles.isMobile && this.props.showDelete && !this.props.deleteRenameDisabled && (
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bottomRow: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-end',
        alignSelf: 'stretch',
        flex: 1,
        justifyContent: 'center',
        position: 'relative',
        ...(Styles.isMobile ? {} : {minWidth: '500px'}),
      },
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.medium,
        paddingTop: Styles.globalMargins.medium,
        ...(Styles.isMobile ? {flex: 1} : {}),
      },
    } as const)
)

export default EditChannel
