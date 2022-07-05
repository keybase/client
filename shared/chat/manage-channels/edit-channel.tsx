import * as React from 'react'
import DeleteChannel from './delete-channel'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  teamname: string
  channelName: string
  errorText: string
  topic: string
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

class EditChannel extends React.Component<Props, State> {
  state = {newChannelName: this.props.channelName, newTopic: this.props.topic}

  private onChangeChannelName = (newChannelName: string) => this.setState({newChannelName})
  private onChangeTopic = (newTopic: string) => this.setState({newTopic})
  private onSave = () => this.props.onSave(this.state.newChannelName, this.state.newTopic)

  componentDidMount() {
    this.props.onSetChannelCreationError('')
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.channelName !== this.props.channelName) {
      this.onChangeChannelName(this.props.channelName)
    }
    if (prevProps.topic !== this.props.topic) {
      this.onChangeTopic(this.props.topic)
    }
    if (prevProps.waitingOnSave && !this.props.waitingOnSave && !this.props.errorText) {
      this.props.onSaveSuccess()
    }
  }

  render() {
    return (
      <Kb.PopupWrapper onCancel={this.props.onCancel} title={this.props.title}>
        <Kb.ScrollView style={styles.scroll}>
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
                <Kb.Box2 direction="horizontal" fullWidth={true}>
                  <Kb.Text center={true} lineClamp={1} type="Header" style={styles.title}>
                    {this.props.title}
                  </Kb.Text>
                </Kb.Box2>
              )
            )}

            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bannerContainer}>
              {!!this.props.errorText && (
                <Kb.Banner color="red">
                  <Kb.BannerParagraph bannerColor="red" content={this.props.errorText} />
                </Kb.Banner>
              )}
              {this.props.deleteRenameDisabled && (
                <Kb.Banner color="blue">
                  <Kb.BannerParagraph bannerColor="blue" content="#general can’t be renamed or deleted." />
                </Kb.Banner>
              )}
            </Kb.Box2>

            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.inputContainer}>
              <Kb.LabeledInput
                autoFocus={true}
                onChangeText={this.onChangeChannelName}
                placeholder={this.props.waitingForGetInfo ? 'Loading channel name...' : 'Channel name'}
                disabled={this.props.waitingForGetInfo || this.props.deleteRenameDisabled}
                value={this.state.newChannelName}
              />
              <Kb.LabeledInput
                onChangeText={this.onChangeTopic}
                disabled={this.props.waitingForGetInfo}
                placeholder={
                  this.props.waitingForGetInfo
                    ? 'Loading channel description...'
                    : 'Add a description or topic...'
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
            </Kb.Box2>
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
                <Kb.Button type="Dim" label="Cancel" onClick={this.props.onCancel} />
                <Kb.Button
                  label="Save"
                  disabled={
                    this.props.channelName === this.state.newChannelName &&
                    this.props.topic === this.state.newTopic
                  }
                  waiting={this.props.waitingOnSave}
                  onClick={this.onSave}
                />
              </Kb.ButtonBar>
              {this.props.showDelete && !this.props.deleteRenameDisabled && (
                <DeleteChannel
                  channelName={this.props.channelName}
                  onConfirmedDelete={this.props.onConfirmedDelete}
                  disabled={this.props.deleteRenameDisabled}
                />
              )}
            </Kb.Box2>
          </Kb.Box>
        </Kb.ScrollView>
      </Kb.PopupWrapper>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bannerContainer: {
        marginBottom: Styles.globalMargins.small,
      },
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.medium,
        paddingTop: Styles.globalMargins.medium,
        ...(Styles.isMobile ? {flex: 1} : {}),
      },
      buttonBar: {alignItems: 'center'},
      inputContainer: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.large,
          paddingRight: Styles.globalMargins.large,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      scroll: Styles.platformStyles({
        common: {flex: 1},
        isElectron: {width: 400},
      }),
      title: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
        width: '100%',
      },
    } as const)
)

export default EditChannel
