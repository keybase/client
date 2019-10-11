import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/autoreset'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as AutoresetGen from '../../actions/autoreset-gen'
import {formatDurationForAutoreset} from '../../util/timestamp'

export type Props = {}

const ResetModal = (_: Props) => {
  const {active, endTime} = Container.useSelector(s => s.autoreset)
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (!active) {
      dispatch(RouteTreeGen.createNavigateUp())
    }
  }, [active, dispatch])
  let msg = ''
  const now = Date.now()
  const timeLeft = endTime - now
  if (timeLeft < 0) {
    msg = 'This account is eligible to be reset.'
  } else {
    msg = `This account will reset in ${formatDurationForAutoreset(timeLeft)}.`
  }
  const onCancelReset = () => {
    dispatch(AutoresetGen.createCancelReset())
  }

  return (
    <Kb.ScrollView>
      <Kb.Box2 fullWidth={true} direction="vertical" style={styles.wrapper}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer} alignItems="center">
          <Kb.Text type="Header">Account reset initiated</Kb.Text>
        </Kb.Box2>
        <Kb.Box2
          gap="small"
          direction="vertical"
          fullWidth={true}
          style={styles.textContainer}
          centerChildren={true}
        >
          <Kb.Icon type="icon-skull-48" />
          <Kb.Text type="Body" center={true}>
            {msg}
          </Kb.Text>
          <Kb.Text type="Body" center={true}>
            But... it looks like you’re already logged in. Congrats! You should cancel the reset, since
            clearly you have access to your devices.
          </Kb.Text>
          {/* <Kb.Text type="Body">The reset was triggered by the following device:</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="small" fullWidth={true} style={styles.deviceContainer}>
            <Kb.Image src={props.mapURL} style={{height: 100, width: 100}} />
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySmallExtrabold">iPhone in New York, NY, US</Kb.Text>
              <Kb.Text type="BodySmall">Verified using the password</Kb.Text>
              <Kb.Text type="BodySmall">Entered on August 8, 2019</Kb.Text>
              <Kb.Text type="BodySmall">IP address: 127.0.0.1</Kb.Text>
            </Kb.Box2>
          </Kb.Box2> */}
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonContainer}>
          <Kb.WaitingButton
            type="Danger"
            fullWidth={true}
            onClick={onCancelReset}
            waitingKey={Constants.cancelResetWaitingKey}
            label="Cancel account reset"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

ResetModal.navigationOptions = {
  gesturesEnabled: false,
}

const styles = Styles.styleSheetCreate(() => ({
  buttonContainer: {
    padding: Styles.globalMargins.small,
  },
  deviceContainer: {},
  headerContainer: {
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.small,
  },
  textContainer: {
    ...Styles.globalStyles.flexGrow,
    padding: Styles.globalMargins.small,
    paddingBottom: 0,
  },
  wrapper: Styles.platformStyles({
    isElectron: {
      height: 415,
      width: 360,
    },
  }),
}))

export default Kb.HeaderOrPopupWithHeader(ResetModal)
