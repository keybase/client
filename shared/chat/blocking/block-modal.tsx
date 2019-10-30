import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const todo = () => console.log('TODO')
type Props = {
  team?: string
  adder: string
  others?: Array<string>
}

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
const BlockModal = (props: Props) => {
  const onFinish = todo
  const [blockTeam, setBlockTeam] = React.useState(true)
  const [blockAdder, setBlockAdder] = React.useState(true)
  const [hideAdder, setHideAdder] = React.useState(true)
  const [report, setReport] = React.useState(false)
  const [includeTranscript, setIncludeTranscript] = React.useState(false)
  const [reportReason, setReportReason] = React.useState(reasons[0])
  const [extraNotes, setExtraNotes] = React.useState('')
  const [otherBlocked, setOtherBlocked] = React.useState(new Map<string, boolean>())

  const setBlockedOther = (username: string, block: string) => (blocked: boolean) => {
    otherBlocked.set(`${username}:${block}`, blocked)
    setOtherBlocked(new Map(otherBlocked))
  }
  const getBlockedOther = (username: string, block: string) =>
    otherBlocked.get(`${username}:${block}`) || false

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
          <Kb.Text onClick={todo} type="BodyPrimaryLink">
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
        {props.team && (
          <>
            <CheckboxRow text={`Leave and block ${props.team}`} onCheck={setBlockTeam} checked={blockTeam} />
            <Kb.Divider />
          </>
        )}
        <CheckboxRow
          text={`Block ${props.adder}`}
          onCheck={setBlockAdder}
          checked={blockAdder}
          info={`${
            props.adder
          } won't be able to start any new conversations with you, and they won't be able to add you to any teams.`}
        />
        <Kb.Divider />
        <CheckboxRow
          text={`Hide ${props.adder} from your followers`}
          onCheck={setHideAdder}
          checked={hideAdder}
          info={`If ${
            props.adder
          } chooses to follow you on Keybase, they still won't show up in the list when someone views your profile.`}
        />
        <Kb.Divider />
        <CheckboxRow text={`Report ${props.adder} to Keybase admins`} onCheck={setReport} checked={report} />
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
        {props.others && (
          <>
            <Kb.Box2 direction="horizontal" style={styles.greyBox} fullWidth={true}>
              <Kb.Text type="BodySmall">Also block others?</Kb.Text>
            </Kb.Box2>
            {props.others.map(other => (
              <>
                <CheckboxRow
                  text={
                    <Kb.Text type="Body">
                      Block <Kb.Text type="BodySemibold">{other}</Kb.Text>
                    </Kb.Text>
                  }
                  onCheck={setBlockedOther(other, 'block')}
                  checked={getBlockedOther(other, 'block')}
                />
                <Kb.Divider />
                <CheckboxRow
                  text={
                    <Kb.Text type="Body">
                      Hide <Kb.Text type="BodySemibold">{props.adder}</Kb.Text> from your followers
                    </Kb.Text>
                  }
                  onCheck={setBlockedOther(other, 'follow')}
                  checked={getBlockedOther(other, 'follow')}
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
