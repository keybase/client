import * as React from 'react'
import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/autoreset'
import {formatDurationForAutoreset} from '../../util/timestamp'

const ResetModal = () => {
  const isResetActive = Constants.useState(s => s.active)
  return isResetActive ? <ResetModalImpl /> : null
}

const ResetModalImpl = () => {
  const active = Constants.useState(s => s.active)
  const endTime = Constants.useState(s => s.endTime)
  const error = Constants.useState(s => s.error)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  React.useEffect(() => {
    if (!active) {
      navigateUp()
    }
  }, [active, navigateUp])
  const now = Date.now()
  const timeLeft = endTime - now

  const msg =
    timeLeft < 0
      ? 'This account is eligible to be reset.'
      : `This account will reset in ${formatDurationForAutoreset(timeLeft)}.`

  const onCancelReset = Constants.useState(s => s.dispatch.cancelReset)

  return (
    <Kb.SafeAreaView
      style={{
        backgroundColor: Styles.globalColors.white,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      }}
    >
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
          error ? (
            <Kb.Banner color="red" key="errors">
              <Kb.BannerParagraph bannerColor="red" content={error} />
            </Kb.Banner>
          ) : null
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
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Modal>
    </Kb.SafeAreaView>
  )
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
