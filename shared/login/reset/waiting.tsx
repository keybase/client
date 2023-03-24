import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import {addTicker, removeTicker} from '../../util/second-timer'
import * as Constants from '../../constants/autoreset'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'

type Props = Container.RouteProps<'resetWaiting'>

const Waiting = (props: Props) => {
  const pipelineStarted = props.route.params?.pipelineStarted ?? false
  const endTime = Container.useSelector(state => state.autoreset.endTime)
  const [formattedTime, setFormattedTime] = React.useState('a bit')
  const [hasSentAgain, setHasSentAgain] = React.useState(false)
  const [sendAgainSuccess, setSendAgainSuccess] = React.useState(false)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  // const onCancelReset = React.useCallback(() => dispatch(AutoresetGen.createCancelReset()), [dispatch])
  const onClose = React.useCallback(
    () => dispatch(nav.safeNavigateAppendPayload({path: ['login'], replace: true})),
    [dispatch, nav]
  )

  const onSendAgain = React.useCallback(() => {
    setHasSentAgain(true)
    setSendAgainSuccess(false)
    dispatch(AutoresetGen.createResetAccount({}))
  }, [dispatch])
  const _sendAgainWaiting = Container.useAnyWaiting(Constants.enterPipelineWaitingKey)
  const sendAgainWaiting = hasSentAgain && _sendAgainWaiting
  const prevSendAgainWaiting = Container.usePrevious(sendAgainWaiting)
  React.useEffect(() => {
    if (prevSendAgainWaiting !== undefined && prevSendAgainWaiting && !sendAgainWaiting) {
      setSendAgainSuccess(true)
    }
  }, [prevSendAgainWaiting, sendAgainWaiting])

  React.useEffect(() => {
    if (!pipelineStarted) {
      return
    }
    function tick() {
      const newFormattedTime = Constants.formatTimeLeft(endTime)
      if (formattedTime !== newFormattedTime) {
        setFormattedTime(newFormattedTime)
      }
      if (endTime < Date.now()) {
        dispatch(nav.safeNavigateAppendPayload({path: ['resetEnterPassword'], replace: true}))
      }
    }

    const tickerID = addTicker(tick)
    return function cleanup() {
      removeTicker(tickerID)
    }
  }, [endTime, setFormattedTime, formattedTime, pipelineStarted, dispatch, nav])

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
          color={Styles.globalColors.black}
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
              {/* <Kb.Text type="Body">Unless you would like to</Kb.Text>
              <Kb.Text type="BodyPrimaryLink" onClick={onCancelReset}>
                cancel the reset.
              </Kb.Text> */}
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

Waiting.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

export default Waiting

const styles = Styles.styleSheetCreate(() => ({
  mainText: {
    ...Styles.padding(0, Styles.globalMargins.xsmall),
    maxWidth: 300,
  },
  positionRelative: {
    position: 'relative',
  },
  progressContainer: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.white_40OrBlack_60,
  },
  topGap: Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))
