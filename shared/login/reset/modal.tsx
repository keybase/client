import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {formatDurationForAutoreset} from '@/util/timestamp'

const ResetModal = () => {
  const isResetActive = AutoReset.useAutoResetState(s => s.active)
  return isResetActive ? <ResetModalImpl /> : null
}

const ResetModalImpl = () => {
  const {active, endTime, error, onCancelReset} = AutoReset.useAutoResetState(
    C.useShallow(s => ({
      active: s.active,
      endTime: s.endTime,
      error: s.error,
      onCancelReset: s.dispatch.cancelReset,
    }))
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  React.useEffect(() => {
    if (!active) {
      navigateUp()
    }
  }, [active, navigateUp])
  const [now] = React.useState(() => Date.now())
  const timeLeft = endTime - now

  const msg =
    timeLeft < 0
      ? 'This account is eligible to be reset.'
      : `This account will reset in ${formatDurationForAutoreset(timeLeft)}.`

  return (
    <Kb.SafeAreaView
      style={{
        backgroundColor: Kb.Styles.globalColors.white,
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
              waitingKey={C.waitingKeyAutoresetCancel}
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
              type={Kb.Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'}
              color={Kb.Styles.globalColors.black_20}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  textContainer: Kb.Styles.platformStyles({
    common: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
    isElectron: {
      paddingBottom: Kb.Styles.globalMargins.xlarge,
      paddingTop: Kb.Styles.globalMargins.xlarge,
    },
  }),
}))

export default ResetModal
