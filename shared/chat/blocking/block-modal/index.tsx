import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'

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
export type NewBlocksMap = Map<string, BlocksForUser>
type BlocksForUser = {chatBlocked?: boolean; followBlocked?: boolean; report?: ReportSettings}

export type Props = {
  adderUsername?: string
  blockUserByDefault?: boolean
  filterUserByDefault?: boolean
  flagUserByDefault?: boolean
  reportsUserByDefault?: boolean
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
const reasons = ["I don't know this person", 'Spam', 'Harassment', 'Obscene material', 'Other...'] as const
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
        <Kb.Text type="BodySmall" style={{marginLeft: 4}}>
          We will review this report within 24 hours and take an action
        </Kb.Text>
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

const BlockModal = React.memo((p: Props) => {
  const {finishWaiting, onClose, refreshBlocks, context, blockUserByDefault, adderUsername, otherUsernames} =
    p
  const {reportsUserByDefault, flagUserByDefault} = p
  const [blockTeam, setBlockTeam] = React.useState(true)
  const [finishClicked, setFinishClicked] = React.useState(false)
  // newBlocks holds a Map of blocks that will be applied when user clicks
  // "Finish" button. reports is the same thing for reporting.
  const [newBlocks, setNewBlocks] = React.useState<NewBlocksMap>(new Map())

  const loadedOnceRef = React.useRef(false)
  React.useEffect(() => {
    if (loadedOnceRef.current) return
    loadedOnceRef.current = true

    // Once we get here, trigger actions to refresh current block state of
    // users.
    refreshBlocks()

    // Set default checkbox block values for adder user. We don't care if they
    // are already blocked, setting a block is idempotent.
    if (blockUserByDefault && adderUsername) {
      const map = newBlocks
      map.set(adderUsername, {
        chatBlocked: true,
        followBlocked: true,
        report: reportsUserByDefault
          ? {
              ...defaultReport,
              ...(flagUserByDefault ? {reason: reasons[reasons.length - 2]} : {}),
            }
          : undefined,
      })
      setNewBlocks(new Map(map))
    }
    if (context === 'message-popup') {
      // Do not block conversation by default when coming from message popup
      // menu.
      setBlockTeam(false)
    }
  }, [
    adderUsername,
    blockUserByDefault,
    context,
    flagUserByDefault,
    newBlocks,
    refreshBlocks,
    reportsUserByDefault,
  ])

  const lastFinishWaitingRef = React.useRef(finishWaiting)
  React.useEffect(() => {
    if (finishClicked && lastFinishWaitingRef.current && !finishWaiting) {
      onClose()
    }
    lastFinishWaitingRef.current = finishWaiting
  }, [finishClicked, onClose, finishWaiting])

  const getBlockFor = (username: string, which: BlockType) => {
    // First get a current setting from a checkbox, if user has checked anything.
    const current = newBlocks.get(username)
    if (current?.[which] !== undefined) {
      return current[which] || false
    }
    // If we don't have a checkbox, check the store for current block value.
    return p.isBlocked(username, which)
  }

  const setReportForUsername = (username: string, shouldReport: boolean) => {
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
    setNewBlocks(new Map(newBlocks))
  }

  const setReportReasonForUsername = (username: string, reason: string) => {
    const current = newBlocks.get(username)
    if (current?.report) {
      current.report.reason = reason
      newBlocks.set(username, current)
      setNewBlocks(new Map(newBlocks))
    }
  }

  const setBlockFor = (username: string, which: BlockType, block: boolean) => {
    const current = newBlocks.get(username)
    if (current) {
      current[which] = block
      newBlocks.set(username, current)
    } else {
      newBlocks.set(username, {[which]: block})
    }
    // Need to make a new object so the component re-renders.
    setNewBlocks(new Map(newBlocks))
  }

  const setExtraNotesForUsername = (username: string, extraNotes: string) => {
    const current = newBlocks.get(username)
    if (current?.report) {
      current.report.extraNotes = extraNotes
      newBlocks.set(username, current)
      setNewBlocks(new Map(newBlocks))
    }
  }

  const setIncludeTranscriptForUsername = (username: string, includeTranscript: boolean) => {
    const current = newBlocks.get(username)
    if (current?.report) {
      current.report.includeTranscript = includeTranscript
      newBlocks.set(username, current)
      setNewBlocks(new Map(newBlocks))
    }
  }

  const onFinish = () => {
    setFinishClicked(true)
    p.onFinish(newBlocks, blockTeam)
  }

  const shouldShowReport = (username: string): boolean => {
    if (adderUsername) {
      return username === adderUsername
    }
    return true
  }

  const getShouldReport = (username: string): boolean => newBlocks.get(username)?.report !== undefined
  const getIncludeTranscript = (username: string): boolean =>
    newBlocks.get(username)?.report?.includeTranscript ?? false
  const getReportReason = (username: string): string => newBlocks.get(username)?.report?.reason ?? reasons[0]
  const getExtraNotes = (username: string): string => newBlocks.get(username)?.report?.extraNotes ?? ''

  const renderRowsForUsername = (
    username: string,
    last: boolean,
    teamLabel?: boolean
  ): React.ReactElement => (
    <>
      <CheckboxRow
        text={
          !teamLabel
            ? `${p.filterUserByDefault ? 'Filter' : 'Block'} ${username}`
            : `${p.filterUserByDefault ? 'Filter' : 'Block'} ${username} from messaging me directly`
        }
        onCheck={checked => setBlockFor(username, 'chatBlocked', checked)}
        checked={getBlockFor(username, 'chatBlocked')}
        info={`${username} won't be able to start any new conversations with you, and they won't be able to add you to any teams.`}
        key={`block-${username}`}
      />
      <CheckboxRow
        text={`Hide ${username} from your followers`}
        onCheck={checked => setBlockFor(username, 'followBlocked', checked)}
        checked={getBlockFor(username, 'followBlocked')}
        info={`If ${username} chooses to follow you on Keybase, they still won't show up in the list when someone views your profile.`}
        key={`hide-${username}`}
      />
      {shouldShowReport(username) && (
        <>
          <CheckboxRow
            text={`Report ${username} to Keybase admins`}
            onCheck={shouldReport => setReportForUsername(username, shouldReport)}
            checked={getShouldReport(username)}
            key={`report-${username}`}
          />
          {getShouldReport(username) && (
            <>
              <ReportOptions
                extraNotes={getExtraNotes(username)}
                includeTranscript={getIncludeTranscript(username)}
                reason={getReportReason(username)}
                setExtraNotes={(notes: string) => setExtraNotesForUsername(username, notes)}
                setIncludeTranscript={(include: boolean) =>
                  setIncludeTranscriptForUsername(username, include)
                }
                setReason={(reason: string) => setReportReasonForUsername(username, reason)}
                showIncludeTranscript={!!p.convID}
                key={`reportoptions-${username}`}
              />
            </>
          )}
        </>
      )}
      {!last && <Kb.Divider key={`divider-${username}`} />}
    </>
  )

  const {teamname} = p

  const header = {
    leftButton: Styles.isMobile ? (
      <Kb.Text onClick={onClose} type="BodyPrimaryLink">
        Cancel
      </Kb.Text>
    ) : undefined,
    title: <Kb.Icon type="iconfont-user-block" sizeType="Big" color={Styles.globalColors.red} />,
  }

  if (p.loadingWaiting) {
    return (
      <Kb.Modal mode="Default" header={header}>
        <Kb.Box style={styles.loadingAnimationBox}>
          <Kb.Animation animationType="spinner" style={styles.loadingAnimation} />
        </Kb.Box>
      </Kb.Modal>
    )
  }

  const teamCheckboxDisabled = !!teamname && !otherUsernames?.length && !adderUsername
  const teamLabel = context === 'message-popup'

  const topStuff = (
    <React.Fragment key="topStuff">
      {(!!teamname || !adderUsername) && (
        <>
          <CheckboxRow
            text={`Leave and block ${teamname || 'this conversation'}`}
            onCheck={setBlockTeam}
            checked={blockTeam}
            disabled={teamCheckboxDisabled}
          />
          <Kb.Divider />
        </>
      )}
      {!!adderUsername && renderRowsForUsername(adderUsername, true, teamLabel)}
      {!!otherUsernames?.length && (
        <Kb.Box2 direction="horizontal" style={styles.greyBox} fullWidth={true}>
          <Kb.Text type="BodySmall">Also block {adderUsername ? 'others' : 'individuals'}?</Kb.Text>
        </Kb.Box2>
      )}
    </React.Fragment>
  )

  const items: Array<Item> = ['topStuff']
  otherUsernames?.forEach(username => items.push({username}))
  return (
    <Kb.Modal
      mode="Default"
      onClose={onClose}
      header={header}
      footer={{
        content: (
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            {!Styles.isMobile && <Kb.Button fullWidth={true} label="Cancel" onClick={onClose} type="Dim" />}
            <Kb.WaitingButton label="Finish" onClick={onFinish} fullWidth={true} type="Danger" />
          </Kb.ButtonBar>
        ),
      }}
      noScrollView={true}
    >
      <Kb.List
        keyboardDismissMode="none"
        items={items}
        renderItem={(idx: number, item: Item) =>
          item === 'topStuff'
            ? topStuff
            : renderRowsForUsername(item.username, idx === otherUsernames?.length)
        }
        indexAsKey={true}
        style={
          Styles.isMobile
            ? styles.grow
            : getListHeightStyle(
                otherUsernames?.length ?? 0,
                !!adderUsername && getShouldReport(adderUsername)
              )
        }
      />
    </Kb.Modal>
  )
})

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
