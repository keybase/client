import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as UsersGen from '../../actions/users-gen'
import * as TeamsGen from '../../actions/teams-gen'

type OwnProps = Container.RouteProps<{
  blockByDefault?: boolean
  others?: Array<string>
  team?: string
  username: string
}>

type CheckboxRowProps = {
  text: React.ReactNode
  onCheck: (boolean) => void
  more?: React.ReactNode
  info?: string
  checked: boolean
}
const CheckboxRow = (props: CheckboxRowProps) => {
  const [infoShowing, setInfoShowing] = React.useState(false)
  return (
    <>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.checkBoxRow}>
        <Kb.Switch
          color="red"
          onClick={() => props.onCheck(!props.checked)}
          on={props.checked}
          label={props.text}
          labelSubtitle={infoShowing ? props.info : undefined}
          gapSize={Styles.globalMargins.tiny}
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
const reasons = ["I don't know this person", 'Spam', 'Harassment', 'Obscene material', 'Other...']
const BlockModal = (props: OwnProps) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  // Route props
  const teamname = Container.getRouteProps(props, 'team', undefined)
  const adderUsername = Container.getRouteProps(props, 'username', '')
  const otherUsernames = Container.getRouteProps(props, 'others', undefined)
  // If we are coming from chat, we want to block `username` by default in this
  // form. But if we are managing blocking from user profile, we want to
  // display current block status.
  const blockByDefault = Container.getRouteProps(props, 'blockByDefault', false)

  // TODO: If there are "others" that are already blocked, exclude them from
  // the checkboxes

  // Once we get here, trigger actions to refresh current block state of users.
  React.useEffect(() => {
    const usernames = [adderUsername].concat(otherUsernames || []).filter(Boolean)
    if (usernames.length) {
      dispatch(UsersGen.createGetBlockState({usernames}))
    }
  }, [dispatch, adderUsername, otherUsernames])

  const [blockTeam, setBlockTeam] = React.useState(true)
  const [report, setReport] = React.useState(false)
  const [includeTranscript, setIncludeTranscript] = React.useState(false)
  const [reportReason, setReportReason] = React.useState(reasons[0])
  const [extraNotes, setExtraNotes] = React.useState('')

  const storeBlockMap = Container.useSelector(state => state.users.blockMap)

  // newBlocks holds a Map of blocks that will be applied when user clicks
  // "Finish" button.
  const [newBlocks, setNewBlocks] = React.useState(
    new Map<string, {chatBlocked?: boolean; followBlocked?: boolean}>()
  )

  // Set default checkbox block values for adder user. We don't care if they
  // are already blocked, setting a block is idempotent.
  React.useEffect(() => {
    if (blockByDefault) {
      setNewBlocks(n => {
        n.set(adderUsername, {chatBlocked: true, followBlocked: true})
        return new Map(n)
      })
    }
  }, [adderUsername, blockByDefault, setNewBlocks])

  type blockType = 'chatBlocked' | 'followBlocked'
  const setBlockFor = (username: string, which: blockType) => (blocked: boolean) => {
    const current = newBlocks.get(username)
    if (current) {
      current[which] = blocked
      newBlocks.set(username, current)
    } else {
      newBlocks.set(username, {[which]: blocked})
    }
    // Need to make a new object so the component re-renders.
    setNewBlocks(new Map(newBlocks))
  }

  const getBlockFor = (username: string, which: blockType): boolean => {
    // First get a current setting from a checkbox, if user has checked anything.
    const current = newBlocks.get(username)
    if (current && current[which] !== undefined) {
      return current[which] || false
    }
    // If we don't have a checkbox, check the store for current block value.
    const storeBlocks = storeBlockMap.get(username)
    if (storeBlocks) {
      return storeBlocks[which]
    }
    return false
  }

  // Button handlers
  const onCancel = () => dispatch(nav.safeNavigateUpPayload())
  const onFinish = () => {
    if (teamname && blockTeam) {
      dispatch(TeamsGen.createLeaveTeam({context: 'chat', teamname}))
    }
    if (newBlocks.size) {
      const blocks = Array.from(newBlocks).map(([username, blocks]) => ({
        setChatBlock: blocks.chatBlocked,
        setFollowBlock: blocks.followBlocked,
        username,
      }))
      dispatch(UsersGen.createSetUserBlocks({blocks}))
    }
  }

  const RadioButton = ({reason}: {reason: string}) => (
    // TODO: make it red
    <Kb.RadioButton
      label={reason}
      onSelect={() => setReportReason(reason)}
      selected={reportReason === reason}
      style={styles.radioButton}
    />
  )

  return (
    <Kb.Modal
      mode="Default"
      header={{
        leftButton: (
          <Kb.Text onClick={onCancel} type="BodyPrimaryLink">
            Cancel
          </Kb.Text>
        ),
        title: <Kb.Icon type="iconfont-block-user" sizeType="Big" color="red" />,
      }}
      footer={{
        content: <Kb.Button label="Finish" onClick={onFinish} fullWidth={true} type="Danger" />,
      }}
    >
      <Kb.ScrollView style={styles.scroll}>
        {teamname && (
          <>
            <CheckboxRow text={`Leave and block ${teamname}`} onCheck={setBlockTeam} checked={blockTeam} />
            <Kb.Divider />
          </>
        )}
        <CheckboxRow
          text={`Block ${adderUsername}`}
          onCheck={setBlockFor(adderUsername, 'chatBlocked')}
          checked={getBlockFor(adderUsername, 'chatBlocked')}
          info={`${adderUsername} won't be able to start any new conversations with you, and they won't be able to add you to any teams.`}
        />
        <Kb.Divider />
        <CheckboxRow
          text={`Hide ${adderUsername} from your followers`}
          onCheck={setBlockFor(adderUsername, 'followBlocked')}
          checked={getBlockFor(adderUsername, 'followBlocked')}
          info={`If ${adderUsername} chooses to follow you on Keybase, they still won't show up in the list when someone views your profile.`}
        />
        <Kb.Divider />
        <CheckboxRow
          text={`Report ${adderUsername} to Keybase admins`}
          onCheck={setReport}
          checked={report}
        />
        {report && (
          <>
            {reasons.map(reason => (
              <RadioButton reason={reason} key={reason} />
            ))}
            <Kb.Box style={styles.feedback}>
              <Kb.NewInput
                multiline={true}
                placeholder="Extra notes"
                onChangeText={setExtraNotes}
                value={extraNotes}
              />
            </Kb.Box>
            <CheckboxRow
              text="Include the transcript of this chat"
              onCheck={setIncludeTranscript}
              checked={includeTranscript}
            />
          </>
        )}
        {otherUsernames && (
          <>
            <Kb.Box2 direction="horizontal" style={styles.greyBox} fullWidth={true}>
              <Kb.Text type="BodySmall">Also block others?</Kb.Text>
            </Kb.Box2>
            {otherUsernames.map(other => (
              <>
                <CheckboxRow
                  text={`Block ${other}`}
                  onCheck={setBlockFor(other, 'chatBlocked')}
                  checked={getBlockFor(other, 'chatBlocked')}
                />
                <Kb.Divider />
                <CheckboxRow
                  text={`Hide ${other} from your followers`}
                  onCheck={setBlockFor(other, 'followBlocked')}
                  checked={getBlockFor(other, 'followBlocked')}
                />
                <Kb.Divider />
              </>
            ))}
          </>
        )}
      </Kb.ScrollView>
    </Kb.Modal>
  )
}

export default BlockModal

const styles = Styles.styleSheetCreate(() => ({
  checkBoxRow: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  feedback: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, 0),
  greyBox: {
    backgroundColor: Styles.globalColors.blueGrey,
    color: Styles.globalColors.black_50,
    width: '100%',
    ...Styles.padding(Styles.globalMargins.xsmall),
  },
  iconBox: {flex: 1, paddingLeft: Styles.globalMargins.tiny},
  radioButton: {marginLeft: Styles.globalMargins.large},
  scroll: {width: '100%'},
  shrink: {flexShrink: 1},
}))
