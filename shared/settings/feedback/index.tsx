import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  feedback?: string
  loggedOut: boolean
  onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => void
  sending: boolean
  sendError: string
  showInternalSuccessBanner: boolean // if true, enables the internal success bar
  onFeedbackDone: (success: boolean) => void
}

const clickThreshold = 7

const Feedback = (props: Props) => {
  const {sending, sendError, onFeedbackDone, showInternalSuccessBanner} = props
  const [clickCount, setClickCount] = React.useState(0)
  const [email, setEmail] = React.useState<string | undefined>(undefined)
  const [feedback, setFeedback] = React.useState(props.feedback || '')
  const [sendLogs, setSendLogs] = React.useState(true)
  const [showSuccessBanner, setShowSuccessBanner] = React.useState(false)

  const _onLabelClick = () => {
    setClickCount(prevCount => {
      const newCount = prevCount + 1
      if (newCount < clickThreshold) {
        console.log(`clickCount = ${newCount} (${clickThreshold - newCount} away from sending full logs)`)
      }
      return newCount
    })
  }

  const lastSendingRef = React.useRef(props.sending)
  const lastSendErrorRef = React.useRef(props.sendError)

  React.useEffect(() => {
    if (lastSendingRef.current !== sending || sendError !== lastSendErrorRef.current) {
      const success = !sending && !sendError
      setFeedback(success ? '' : feedback)
      setShowSuccessBanner(showInternalSuccessBanner && success)
      onFeedbackDone(success)
    }
    lastSendingRef.current = sending
    lastSendErrorRef.current = sendError
  }, [sending, sendError, onFeedbackDone, feedback, showInternalSuccessBanner])

  const _onChangeFeedback = (feedback: string) => {
    setFeedback(feedback)
  }

  const _onChangeSendLogs = (sendLogs: boolean) => {
    setSendLogs(sendLogs)
  }

  const _onChangeEmail = (email: string) => {
    setEmail(email)
  }

  const _sendMaxBytes = () => clickCount >= clickThreshold

  const _onSendFeedback = () => {
    const sendMaxBytes = _sendMaxBytes()
    setClickCount(0)
    setShowSuccessBanner(false)
    props.onSendFeedback(email ? `${feedback} (email: ${email || ''} )` : feedback, sendLogs, sendMaxBytes)
  }

  return (
    <Kb.ScrollView alwaysBounceVertical={false}>
      <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
        {showSuccessBanner && (
          <Kb.Banner color="green">
            <Kb.BannerParagraph bannerColor="green" content="Thanks! Your feedback was sent." />
          </Kb.Banner>
        )}
        <Kb.Box2 direction="vertical" style={styles.mainBox} gap="xsmall">
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.NewInput
              autoCapitalize="sentences"
              autoCorrect={true}
              autoFocus={true}
              containerStyle={styles.input}
              multiline={true}
              onChangeText={_onChangeFeedback}
              placeholder="Please tell us what you were doing, your experience, or anything else we should know. Thanks!"
              resize={true}
              rowsMin={4}
              rowsMax={Kb.Styles.isMobile ? 4 : 10}
              value={feedback}
            />
          </Kb.Box2>
          {_sendMaxBytes() && (
            <Kb.Banner color="green">
              <Kb.BannerParagraph bannerColor="green" content="next send will include full logs" />
            </Kb.Banner>
          )}
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
            <Kb.ClickableBox onClick={_onLabelClick} style={styles.includeLogs}>
              <Kb.Checkbox
                label="Include your logs"
                labelSubtitle="This includes some private metadata info (e.g., file sizes, but not names or contents) but it will help the developers fix bugs more quickly."
                checked={sendLogs}
                onCheck={_onChangeSendLogs}
              />
            </Kb.ClickableBox>
          </Kb.Box2>
          {props.loggedOut && (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.NewInput
                containerStyle={styles.input}
                placeholder="Your email address"
                onChangeText={_onChangeEmail}
              />
            </Kb.Box2>
          )}
          <Kb.Box2 alignSelf={props.loggedOut ? 'center' : 'flex-start'} direction="horizontal" gap="tiny">
            <Kb.ButtonBar>
              <Kb.Button
                label="Send"
                onClick={_onSendFeedback}
                waiting={sending}
                fullWidth={!Kb.Styles.isTablet}
              />
            </Kb.ButtonBar>
          </Kb.Box2>
          {sendError && (
            <Kb.Box2 direction="vertical" gap="small">
              <Kb.Text type="BodySmallError">Could not send log</Kb.Text>
              <Kb.Text type="BodySmall" selectable={true}>
                {sendError}
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

export default Feedback

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {flex: 1},
      }),
      includeLogs: {
        ...Kb.Styles.globalStyles.fullWidth,
      },
      input: Kb.Styles.platformStyles({
        isElectron: {padding: Kb.Styles.globalMargins.tiny},
        isMobile: {...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small)},
      }),
      mainBox: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.small,
        },
        isElectron: {
          maxWidth: 550,
          width: '100%',
        },
        isTablet: {
          alignSelf: 'flex-start',
          width: Kb.Styles.globalStyles.largeWidthPercent,
        },
      }),
      outerStyle: {backgroundColor: Kb.Styles.globalColors.white},
      smallLabel: {color: Kb.Styles.globalColors.black},
    }) as const
)
