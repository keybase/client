import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

// Type for extra RouteProp passed to block modal sometimes when launching the
// modal from specific places from the app.
export type BlockModalContext =
  | 'message-popup-single' // message popup in 1-on-1 conv
  | 'message-popup' // message popup in bigger convs (incl. team chats)

export type BlockType = 'chatBlocked' | 'followBlocked'
export type ReportSettings = {
  extraNotes: string
  includeTranscript: boolean
  reason: string
}
type BlocksForUser = {chatBlocked?: boolean; followBlocked?: boolean; report?: ReportSettings}

export type NewBlocksMap = Map<string, BlocksForUser>
type State = {
  blockTeam: boolean
  finishClicked: boolean
  newBlocks: NewBlocksMap
}

export type Props = {
  adderUsername?: string
  blockUserByDefault?: boolean
  convID?: string
  context?: BlockModalContext
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
  disabled?: boolean
  info?: string
  more?: React.ReactNode
  onCheck: (c: boolean) => void
  text: React.ReactNode
}
const CheckboxRow = (props: CheckboxRowProps) => (
  <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.checkBoxRow}>
    <Kb.Switch
      allowLabelClick={!props.disabled}
      color="red"
      disabled={props.disabled}
      gapSize={Styles.globalMargins.tiny}
      label={props.text}
      on={props.checked}
      onClick={() => props.onCheck(!props.checked)}
      style={styles.shrink}
    />
    <Kb.Box style={styles.iconBox} />
    {props.info && (
      <Kb.WithTooltip
        tooltip={props.info}
        showOnPressMobile={true}
        position={Styles.isMobile ? 'bottom center' : 'top center'}
        multiline={true}
      >
        <Kb.Icon type="iconfont-question-mark" color="grey" />
      </Kb.WithTooltip>
    )}
  </Kb.Box2>
)

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
const defaultReport: ReportSettings = {
  extraNotes: '',
  includeTranscript: true,
  reason: reasons[0],
}
const ReportOptions = (props: ReportOptionsProps) => {
  const {showIncludeTranscript} = props
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
          !showIncludeTranscript && styles.feedbackPaddingBottom,
        ])}
      >
        <Kb.NewInput
          multiline={true}
          placeholder="Extra notes"
          onChangeText={props.setExtraNotes}
          value={props.extraNotes}
        />
      </Kb.Box>
      {showIncludeTranscript && (
        <CheckboxRow
          text="Include the transcript of this chat"
          onCheck={props.setIncludeTranscript}
          checked={props.includeTranscript}
        />
      )}
    </>
  )
}

// In order to have this play nicely with scrolling and keyboards, put all the stuff in a List.
type Item = 'topStuff' | {username: string}

class BlockModal extends React.PureComponent<Props, State> {
  state: State = {
    blockTeam: true,
    finishClicked: false,
    // newBlocks holds a Map of blocks that will be applied when user clicks
    // "Finish" button. reports is the same thing for reporting.
    newBlocks: new Map(),
  }

  componentDidMount() {
    // Once we get here, trigger actions to refresh current block state of
    // users.
    this.props.refreshBlocks()

    // Set default checkbox block values for adder user. We don't care if they
    // are already blocked, setting a block is idempotent.
    if (this.props.blockUserByDefault && this.props.adderUsername) {
      const map = this.state.newBlocks
      map.set(this.props.adderUsername, {chatBlocked: true, followBlocked: true})
      this.setState({newBlocks: new Map(map)})
    }
    if (this.props.context === 'message-popup') {
      // Do not block conversation by default when coming from message popup
      // menu.
      this.setState({blockTeam: false})
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

  setReportForUsername = (username: string, shouldReport: boolean) => {
    const {newBlocks} = this.state
    const current = newBlocks.get(username)
    if (current) {
      if (current.report === undefined && shouldReport) {
        current.report = {...defaultReport}
      } else if (current.report && !shouldReport) {
        current.report = undefined
      }
      newBlocks.set(username, current)
    } else {
      newBlocks.set(username, {report: {...defaultReport}})
    }
    // Need to make a new object so the component re-renders.
    this.setState({newBlocks: new Map(newBlocks)})
  }

  setReportReasonForUsername = (username: string, reason: string) => {
    const {newBlocks} = this.state
    const current = newBlocks.get(username)
    if (current && current.report) {
      current.report.reason = reason
      newBlocks.set(username, current)
      this.setState({newBlocks: new Map(newBlocks)})
    }
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

  setExtraNotesForUsername = (username: string, extraNotes: string) => {
    const {newBlocks} = this.state
    const current = newBlocks.get(username)
    if (current && current.report) {
      current.report.extraNotes = extraNotes
      newBlocks.set(username, current)
      this.setState({newBlocks: new Map(newBlocks)})
    }
  }

  setIncludeTranscriptForUsername = (username: string, includeTranscript: boolean) => {
    const {newBlocks} = this.state
    const current = newBlocks.get(username)
    if (current && current.report) {
      current.report.includeTranscript = includeTranscript
      newBlocks.set(username, current)
      this.setState({newBlocks: new Map(newBlocks)})
    }
  }

  onFinish = () => {
    this.setState({finishClicked: true})
    this.props.onFinish(this.state.newBlocks, this.state.blockTeam)
  }

  shouldShowReport = (username: string): boolean => {
    if (this.props.adderUsername) {
      return username === this.props.adderUsername
    }
    return true
  }

  getShouldReport = (username: string): boolean => this.state.newBlocks.get(username)?.report !== undefined
  getIncludeTranscript = (username: string): boolean =>
    this.state.newBlocks.get(username)?.report?.includeTranscript ?? false
  getReportReason = (username: string): string =>
    this.state.newBlocks.get(username)?.report?.reason ?? reasons[0]
  getExtraNotes = (username: string): string => this.state.newBlocks.get(username)?.report?.extraNotes ?? ''

  renderRowsForUsername = (username: string, last: boolean, teamLabel?: boolean): React.ReactElement => (
    <>
      <CheckboxRow
        text={!teamLabel ? `Block ${username}` : `Block ${username} from messaging me directly`}
        onCheck={checked => this.setBlockFor(username, 'chatBlocked', checked)}
        checked={this.getBlockFor(username, 'chatBlocked')}
        info={`${username} won't be able to start any new conversations with you, and they won't be able to add you to any teams.`}
        key={`block-${username}`}
      />
      <CheckboxRow
        text={`Hide ${username} from your followers`}
        onCheck={checked => this.setBlockFor(username, 'followBlocked', checked)}
        checked={this.getBlockFor(username, 'followBlocked')}
        info={`If ${username} chooses to follow you on Keybase, they still won't show up in the list when someone views your profile.`}
        key={`hide-${username}`}
      />
      {this.shouldShowReport(username) && (
        <>
          <CheckboxRow
            text={`Report ${username} to Keybase admins`}
            onCheck={shouldReport => this.setReportForUsername(username, shouldReport)}
            checked={this.getShouldReport(username)}
            key={`report-${username}`}
          />
          {this.getShouldReport(username) && (
            <>
              <ReportOptions
                extraNotes={this.getExtraNotes(username)}
                includeTranscript={this.getIncludeTranscript(username)}
                reason={this.getReportReason(username)}
                setExtraNotes={(notes: string) => this.setExtraNotesForUsername(username, notes)}
                setIncludeTranscript={(include: boolean) =>
                  this.setIncludeTranscriptForUsername(username, include)
                }
                setReason={(reason: string) => this.setReportReasonForUsername(username, reason)}
                showIncludeTranscript={!!this.props.convID}
                key={`reportoptions-${username}`}
              />
            </>
          )}
        </>
      )}
      {!last && <Kb.Divider key={`divider-${username}`} />}
    </>
  )
  render() {
    const {teamname, adderUsername} = this.props

    const header = {
      leftButton: Styles.isMobile ? (
        <Kb.Text onClick={this.props.onClose} type="BodyPrimaryLink">
          Cancel
        </Kb.Text>
      ) : (
        undefined
      ),
      title: <Kb.Icon type="iconfont-user-block" sizeType="Big" color={Styles.globalColors.red} />,
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

    const teamCheckboxDisabled = !!teamname && !this.props.otherUsernames?.length && !adderUsername
    const teamLabel = this.props.context === 'message-popup'

    const topStuff = (
      <React.Fragment key="topStuff">
        {(!!teamname || !adderUsername) && (
          <>
            <CheckboxRow
              text={`Leave and block ${teamname || 'this conversation'}`}
              onCheck={this.setBlockTeam}
              checked={this.state.blockTeam}
              disabled={teamCheckboxDisabled}
            />
            <Kb.Divider />
          </>
        )}
        {!!adderUsername && this.renderRowsForUsername(adderUsername, true, teamLabel)}
        {!!this.props.otherUsernames?.length && (
          <Kb.Box2 direction="horizontal" style={styles.greyBox} fullWidth={true}>
            <Kb.Text type="BodySmall">Also block {adderUsername ? 'others' : 'individuals'}?</Kb.Text>
          </Kb.Box2>
        )}
      </React.Fragment>
    )

    var items: Array<Item> = ['topStuff']
    this.props.otherUsernames?.forEach(username => items.push({username}))
    return (
      <Kb.Modal
        mode="Default"
        onClose={this.props.onClose}
        header={header}
        footer={{
          content: (
            <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
              {!Styles.isMobile && (
                <Kb.Button fullWidth={true} label="Cancel" onClick={this.props.onClose} type="Dim" />
              )}
              <Kb.WaitingButton
                label="Finish"
                onClick={this.onFinish}
                fullWidth={true}
                type="Danger"
                waitingKey={null}
              />
            </Kb.ButtonBar>
          ),
        }}
        noScrollView={true}
      >
        <Kb.List
          items={items}
          renderItem={(idx: number, item: Item) =>
            item === 'topStuff'
              ? topStuff
              : this.renderRowsForUsername(item.username, idx === this.props.otherUsernames?.length)
          }
          indexAsKey={true}
          style={
            Styles.isMobile
              ? styles.grow
              : getListHeightStyle(
                  this.props.otherUsernames?.length ?? 0,
                  !!this.props.adderUsername && this.getShouldReport(this.props.adderUsername)
                )
          }
        />
      </Kb.Modal>
    )
  }
}

export default BlockModal

const getListHeightStyle = (numOthers: number, expanded: boolean) => ({
  height:
    120 +
    (numOthers >= 1
      ? // "Also block others" is 41px, every row is 2 * 40px rows + a 1px divider.
        // We cap the count at 4 but even that is greater than the max modal height in Keybase.
        41 + (numOthers >= 4 ? 4 : numOthers) * 81
      : 0) +
    (expanded
      ? // When you expand the report menu, every option gets an 18px row + 54px for the extra notes + 40px transcript
        reasons.length * 18 + 54 + 40
      : 0),
})

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {minHeight: undefined},
  checkBoxRow: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  feedback: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, 0),
  feedbackPaddingBottom: {paddingBottom: Styles.globalMargins.small},
  greyBox: {
    backgroundColor: Styles.globalColors.blueGrey,
    color: Styles.globalColors.black_50,
    width: '100%',
    ...Styles.padding(Styles.globalMargins.xsmall),
  },
  grow: {flexGrow: 1},
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
    alignSelf: 'center',
    padding: Styles.globalMargins.medium,
  },
  radioButton: {marginLeft: Styles.globalMargins.large},
  scroll: Styles.platformStyles({isMobile: {height: '100%'}}),
  shrink: {flexShrink: 1},
}))
