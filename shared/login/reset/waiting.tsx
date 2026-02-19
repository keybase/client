import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'
import {addTicker, removeTicker} from '@/util/second-timer'
import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import {useSafeNavigation} from '@/util/safe-navigation'
import {formatDurationForAutoreset as formatDuration} from '@/util/timestamp'

type Props = {pipelineStarted: boolean}

const formatTimeLeft = (endTime: number) => {
  return formatDuration(endTime - Date.now())
}

const Waiting = (props: Props) => {
  const {pipelineStarted} = props
  const endTime = AutoReset.useAutoResetState(s => s.endTime)
  const [formattedTime, setFormattedTime] = React.useState('a bit')
  const [hasSentAgain, setHasSentAgain] = React.useState(false)
  const [sendAgainSuccess, setSendAgainSuccess] = React.useState(false)
  const nav = useSafeNavigation()
  const onClose = React.useCallback(() => nav.safeNavigateAppend('login', true), [nav])
  const resetAccount = AutoReset.useAutoResetState(s => s.dispatch.resetAccount)
  const onSendAgain = React.useCallback(() => {
    setHasSentAgain(true)
    setSendAgainSuccess(false)
    resetAccount()
  }, [resetAccount])
  const _sendAgainWaiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const sendAgainWaiting = hasSentAgain && _sendAgainWaiting
  const prevSendAgainWaitingRef = React.useRef(sendAgainWaiting)
  React.useEffect(() => {
    if (prevSendAgainWaitingRef.current && !sendAgainWaiting) {
      setSendAgainSuccess(true)
    }
    prevSendAgainWaitingRef.current = sendAgainWaiting
  }, [sendAgainWaiting])

  React.useEffect(() => {
    if (!pipelineStarted) {
      return
    }
    function tick() {
      const newFormattedTime = formatTimeLeft(endTime)
      if (formattedTime !== newFormattedTime) {
        setFormattedTime(newFormattedTime)
      }
      if (endTime < Date.now()) {
        nav.safeNavigateAppend('resetEnterPassword', true)
      }
    }

    const tickerID = addTicker(tick)
    return function cleanup() {
      removeTicker(tickerID)
    }
  }, [endTime, setFormattedTime, formattedTime, pipelineStarted, nav])

  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      banners={
        sendAgainSuccess ? (
          <Kb.Banner color="green" key="success">
            Instructions sent.
          </Kb.Banner>
        ) : null
      }
      buttons={[{label: 'Close', onClick: onClose, type: 'Dim'}]}
    >
      <Kb.Box2
        direction="vertical"
        gap="medium"
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
        style={styles.topGap}
      >
        <Kb.Icon
          type={pipelineStarted ? 'iconfont-wave-2' : 'iconfont-mailbox'}
          color={Kb.Styles.globalColors.black}
          fontSize={24}
        />
        <Kb.Box2 direction="vertical" centerChildren={true} gap="small">
          <Kb.Text type="Header" center={true}>
            {pipelineStarted ? `Check back in ${formattedTime}` : 'Check your email or phone.'}
          </Kb.Text>
          {pipelineStarted ? (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body" style={styles.mainText} center={true}>
                The reset has been initiated. For security reasons, nothing will happen in the next{' '}
                {formattedTime}. We will notify you once you can proceed with the reset.
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body" style={styles.mainText} center={true}>
                We are sending instructions to your email address or phone number.
              </Kb.Text>
              <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.positionRelative}>
                <Kb.Text type="BodyPrimaryLink" onClick={sendAgainWaiting ? undefined : onSendAgain}>
                  Send again
                </Kb.Text>
                {sendAgainWaiting && (
                  <Kb.Box2 direction="horizontal" style={styles.progressContainer} centerChildren={true}>
                    <Kb.ProgressIndicator />
                  </Kb.Box2>
                )}
              </Kb.Box2>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

export default Waiting

const styles = Kb.Styles.styleSheetCreate(() => ({
  mainText: {
    ...Kb.Styles.padding(0, Kb.Styles.globalMargins.xsmall),
    maxWidth: 300,
  },
  positionRelative: {
    position: 'relative',
  },
  progressContainer: {
    ...Kb.Styles.globalStyles.fillAbsolute,
    backgroundColor: Kb.Styles.globalColors.white_40OrBlack_60,
  },
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))
