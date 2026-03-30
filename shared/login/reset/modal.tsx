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
  const navigateUp = C.Router2.navigateUp
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
      <>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
          <Kb.Box2 direction="horizontal" alignItems="center" fullHeight={true} style={Kb.Styles.globalStyles.flexOne}>
            <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne} />
            <Kb.Text type={Kb.Styles.isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>Account reset initiated</Kb.Text>
            <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne} />
          </Kb.Box2>
        </Kb.Box2>
        {error ? (
          <Kb.Banner color="red" key="errors">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null}
        <Kb.Box2 fullWidth={true} direction="vertical">
          <Kb.Box2
            gap="small"
            direction="vertical"
            fullWidth={true}
            fullHeight={true}
            style={styles.textContainer}
            centerChildren={true}
          >
            <Kb.ImageIcon
              type={Kb.Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'}
              style={styles.skullIcon}
            />
            <Kb.Text type="Body" center={true}>
              {msg}
            </Kb.Text>
            <Kb.Text type="Body" center={true}>
              {"But... it looks like you're already logged in. Congrats! You should cancel the reset, since "}
              clearly you have access to your devices.
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.WaitingButton
            type="Danger"
            fullWidth={true}
            onClick={onCancelReset}
            waitingKey={C.waitingKeyAutoresetCancel}
            label="Cancel account reset"
          />
        </Kb.Box2>
      </>
    </Kb.SafeAreaView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  header: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid' as const,
    minHeight: 48,
  },
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  skullIcon: {
    height: 48,
    width: 48,
  },
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
