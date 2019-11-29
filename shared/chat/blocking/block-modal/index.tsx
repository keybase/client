import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export type BlockType = 'chatBlocked' | 'followBlocked'
type BlocksForUser = {chatBlocked?: boolean; followBlocked?: boolean}

export type ReportSettings = {
  extraNotes: string
  includeTranscript: boolean
  reason: string
}

export type NewBlocksMap = Map<string, BlocksForUser>
type State = {
  blockTeam: boolean
  extraNotes: string
  finishClicked: boolean
  includeTranscript: boolean
  newBlocks: NewBlocksMap
  reportReason: string
  shouldReport: boolean
}

export type Props = {
  adderUsername: string
  blockByDefault?: boolean
  convID?: string
  finishWaiting: boolean
  isBlocked: (username: string, which: BlockType) => boolean
  loadingWaiting: boolean
  onClose: () => void
  onFinish: (newBlocks: NewBlocksMap, blockTeam: boolean, report?: ReportSettings) => void
  otherUsernames?: Array<string>
  refreshBlocks: () => void
  teamname?: string
}

type CheckboxRowProps = {
  checked: boolean
  info?: string
  more?: React.ReactNode
  onCheck: (boolean) => void
  text: React.ReactNode
}
const CheckboxRow = (props: CheckboxRowProps) => {
  const [infoShowing, setInfoShowing] = React.useState(false)
  return (
    <>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.checkBoxRow}>
        <Kb.Switch
          color="red"
          gapSize={Styles.globalMargins.tiny}
          label={props.text}
          labelSubtitle={infoShowing ? props.info : undefined}
          on={props.checked}
          onClick={() => props.onCheck(!props.checked)}
          style={styles.shrink}
        />
        <Kb.Box style={styles.iconBox} />
        {props.info && !infoShowing && (
          <Kb.Icon type="iconfont-question-mark" color="grey" onClick={() => setInfoShowing(true)} />
        )}
      </Kb.Box2>
    </>
  )
}

type ReportOptionsProps = {
  extraNotes: string
  includeTranscript: boolean
  reason: string
  setExtraNotes: (text: string) => void
  setIncludeTranscript: (checked: boolean) => void
  setReason: (reason: string) => void
  showIncludeTranscript: boolean
}
const reasons = ["I don't know this person", 'Spam', 'Harassment', 'Obscene material', 'Other...']
const ReportOptions = (props: ReportOptionsProps) => {
  return (
    <>
      {reasons.map(reason => (
        <Kb.RadioButton
          key={reason}
          label={reason}
          onSelect={() => props.setReason(reason)}
          selected={props.reason === reason}
          style={styles.radioButton}
        />
      ))}
      <Kb.Box
        style={Styles.collapseStyles([
          styles.feedback,
          !props.showIncludeTranscript && styles.feedbackPaddingBottom,
        ])}
      >
        <Kb.NewInput
          multiline={true}
          placeholder="Extra notes"
          onChangeText={props.setExtraNotes}
          value={props.extraNotes}
        />
      </Kb.Box>
      {props.showIncludeTranscript && (
        <CheckboxRow
          text="Include the transcript of this chat"
          onCheck={props.setIncludeTranscript}
          checked={props.includeTranscript}
        />
      )}
    </>
  )
}

class BlockModal extends React.PureComponent<Props, State> {
  state = {
    blockTeam: true,
    extraNotes: '',
    finishClicked: false,
    includeTranscript: false,
    // newBlocks holds a Map of blocks that will be applied when user clicks
    // "Finish" button.
    newBlocks: new Map(),
    reportReason: reasons[0],
    shouldReport: false,
  }

  componentDidMount() {
    // Once we get here, trigger actions to refresh current block state of
    // users.
    this.props.refreshBlocks()

    // Set default checkbox block values for adder user. We don't care if they
    // are already blocked, setting a block is idempotent.
    if (this.props.blockByDefault) {
      const map = this.state.newBlocks
      map.set(this.props.adderUsername, {chatBlocked: true, followBlocked: true})
      this.setState({newBlocks: new Map(map)})
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.finishClicked && prevProps.finishWaiting && !this.props.finishWaiting) {
      this.props.onClose()
    }
  }

  getBlockFor(username: string, which: BlockType) {
    // First get a current setting from a checkbox, if user has checked anything.
    const {newBlocks} = this.state
    const current = newBlocks.get(username)
    if (current && current[which] !== undefined) {
      return current[which] || false
    }
    // If we don't have a checkbox, check the store for current block value.
    return this.props.isBlocked(username, which)
  }

  setReport = (checked: boolean) => {
    this.setState({shouldReport: checked})
  }

  setReportReason = (reason: string) => {
    this.setState({reportReason: reason})
  }

  setBlockFor(username: string, which: BlockType, block: boolean) {
    const {newBlocks} = this.state
    const current = newBlocks.get(username)
    if (current) {
      current[which] = block
      newBlocks.set(username, current)
    } else {
      newBlocks.set(username, {[which]: block})
    }
    // Need to make a new object so the component re-renders.
    this.setState({newBlocks: new Map(newBlocks)})
  }

  setBlockTeam = (checked: boolean) => {
    this.setState({blockTeam: checked})
  }

  setExtraNotes = (text: string) => {
    this.setState({extraNotes: text})
  }

  setIncludeTranscript = (checked: boolean) => {
    this.setState({includeTranscript: checked})
  }

  onFinish = () => {
    if (this.state.newBlocks.size === 0 && this.state.blockTeam && !this.state.shouldReport) {
      // Nothing to do, just close the modal.
      this.props.onClose()
      return
    }

    this.setState({finishClicked: true})
    let report: ReportSettings | undefined = undefined
    if (this.state.shouldReport) {
      report = {
        extraNotes: this.state.extraNotes,
        includeTranscript: this.state.includeTranscript,
        reason: this.state.reportReason,
      }
    }
    this.props.onFinish(this.state.newBlocks, this.state.blockTeam, report)
  }

  render() {
    const {teamname, adderUsername} = this.props

    const header = {
      leftButton: (
        <Kb.Text onClick={this.props.onClose} type="BodyPrimaryLink">
          Cancel
        </Kb.Text>
      ),
      title: <Kb.Icon type="iconfont-block-user" sizeType="Big" color="red" />,
    }

    if (this.props.loadingWaiting) {
      return (
        <Kb.Modal mode="Default" header={header}>
          <Kb.Box style={styles.loadingAnimationBox}>
            <Kb.Animation animationType="spinner" style={styles.loadingAnimation} />
          </Kb.Box>
        </Kb.Modal>
      )
    }

    return (
      <Kb.Modal
        mode="Default"
        header={header}
        footer={{
          content: (
            <Kb.WaitingButton
              label="Finish"
              onClick={this.onFinish}
              fullWidth={true}
              type="Danger"
              waitingKey={null}
            />
          ),
        }}
      >
        {!!teamname && (
          <>
            <CheckboxRow
              text={`Leave and block ${teamname}`}
              onCheck={this.setBlockTeam}
              checked={this.state.blockTeam}
            />
            <Kb.Divider />
          </>
        )}
        <CheckboxRow
          text={`Block ${adderUsername}`}
          onCheck={checked => this.setBlockFor(adderUsername, 'chatBlocked', checked)}
          checked={this.getBlockFor(adderUsername, 'chatBlocked')}
          info={`${adderUsername} won't be able to start any new conversations with you, and they won't be able to add you to any teams.`}
        />
        <Kb.Divider />
        <CheckboxRow
          text={`Hide ${adderUsername} from your followers`}
          onCheck={checked => this.setBlockFor(adderUsername, 'followBlocked', checked)}
          checked={this.getBlockFor(adderUsername, 'followBlocked')}
          info={`If ${adderUsername} chooses to follow you on Keybase, they still won't show up in the list when someone views your profile.`}
        />
        <Kb.Divider />
        <CheckboxRow
          text={`Report ${adderUsername} to Keybase admins`}
          onCheck={this.setReport}
          checked={this.state.shouldReport}
        />
        {this.state.shouldReport && (
          <ReportOptions
            extraNotes={this.state.extraNotes}
            includeTranscript={this.state.includeTranscript}
            reason={this.state.reportReason}
            setExtraNotes={this.setExtraNotes}
            setIncludeTranscript={this.setIncludeTranscript}
            setReason={this.setReportReason}
            showIncludeTranscript={!!this.props.convID}
          />
        )}
        {!!this.props.otherUsernames && (
          <>
            <Kb.Box2 direction="horizontal" style={styles.greyBox} fullWidth={true}>
              <Kb.Text type="BodySmall">Also block others?</Kb.Text>
            </Kb.Box2>
            {this.props.otherUsernames.map(other => (
              <>
                <CheckboxRow
                  text={`Block ${other}`}
                  onCheck={checked => this.setBlockFor(other, 'chatBlocked', checked)}
                  checked={this.getBlockFor(other, 'chatBlocked')}
                />
                <Kb.Divider />
                <CheckboxRow
                  text={`Hide ${other} from your followers`}
                  onCheck={checked => this.setBlockFor(other, 'followBlocked', checked)}
                  checked={this.getBlockFor(other, 'followBlocked')}
                />
                <Kb.Divider />
              </>
            ))}
          </>
        )}
      </Kb.Modal>
    )
  }
}

export default BlockModal

const styles = Styles.styleSheetCreate(() => ({
  checkBoxRow: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  feedback: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, 0),
  feedbackPaddingBottom: {paddingBottom: Styles.globalMargins.small},
  greyBox: {
    backgroundColor: Styles.globalColors.blueGrey,
    color: Styles.globalColors.black_50,
    width: '100%',
    ...Styles.padding(Styles.globalMargins.xsmall),
  },
  iconBox: {flex: 1, paddingLeft: Styles.globalMargins.tiny},
  loadingAnimation: Styles.platformStyles({
    isElectron: {
      height: 32,
      width: 32,
    },
    isMobile: {
      height: 48,
      width: 48,
    },
  }),
  loadingAnimationBox: {
    padding: Styles.globalMargins.medium,
  },
  radioButton: {marginLeft: Styles.globalMargins.large},
  scroll: {width: '100%'},
  shrink: {flexShrink: 1},
}))
