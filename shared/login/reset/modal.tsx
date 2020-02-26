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
  const isResetActive = Container.useSelector(state => state.autoreset.active)
  return isResetActive ? <ResetModalImpl /> : null
}

const ResetModalImpl = (_: Props) => {
  const {active, endTime, error} = Container.useSelector(s => s.autoreset)
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
    <Kb.SafeAreaView style={{backgroundColor: Styles.globalColors.white}}>
      <Kb.Modal
        header={{title: 'Account reset initiated'}}
        footer={{
          content: (
            <Kb.WaitingButton
              type="Danger"
              fullWidth={true}
              onClick={onCancelReset}
              waitingKey={Constants.cancelResetWaitingKey}
              label="Cancel account reset"
            />
          ),
        }}
        banners={
          error
            ? [
                <Kb.Banner color="red" key="errors">
                  <Kb.BannerParagraph bannerColor="red" content={error} />
                </Kb.Banner>,
              ]
            : undefined
        }
      >
        <Kb.Box2 fullWidth={true} direction="vertical">
          <Kb.Box2
            gap="small"
            direction="vertical"
            fullWidth={true}
            fullHeight={true}
            style={styles.textContainer}
            centerChildren={true}
          >
            <Kb.Icon
              type={Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'}
              color={Styles.globalColors.black_20}
              fontSize={48}
            />
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
        </Kb.Box2>
      </Kb.Modal>
    </Kb.SafeAreaView>
  )
}
ResetModal.navigationOptions = {
  gesturesEnabled: false,
}

const styles = Styles.styleSheetCreate(() => ({
  textContainer: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isElectron: {
      paddingBottom: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
    },
  }),
}))

export default ResetModal
