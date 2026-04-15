import * as C from '@/constants'
import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {formatDurationForAutoreset} from '@/util/timestamp'
import {RPCError} from '@/util/errors'

const ResetModal = () => {
  const {active, endTime} = useConfigState(
    C.useShallow(s => ({
      active: !!s.badgeState?.resetState.active,
      endTime: s.badgeState?.resetState.endTime ?? 0,
    }))
  )
  return active ? <ResetModalImpl endTime={endTime} /> : null
}

const ResetModalImpl = ({endTime}: {endTime: number}) => {
  const [dismissed, setDismissed] = React.useState(false)
  const [error, setError] = React.useState('')
  const [now] = React.useState(() => Date.now())
  const timeLeft = endTime - now
  const onCancelReset = React.useCallback(() => {
    setError('')
    const f = async () => {
      logger.info('Cancelled autoreset from logged-in user')
      try {
        await T.RPCGen.accountCancelResetRpcPromise(undefined, C.waitingKeyAutoresetCancel)
        setDismissed(true)
      } catch (error_) {
        if (!(error_ instanceof RPCError)) {
          return
        }
        logger.error('Error in CancelAutoreset', error_)
        switch (error_.code) {
          case T.RPCGen.StatusCode.scnosession:
          case T.RPCGen.StatusCode.scnotfound:
            setDismissed(true)
            return
          default:
            setError(error_.desc)
        }
      }
    }
    ignorePromise(f())
  }, [])

  if (dismissed) {
    return null
  }

  const msg =
    timeLeft < 0
      ? 'This account is eligible to be reset.'
      : `This account will reset in ${formatDurationForAutoreset(timeLeft)}.`

  return (
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.overlay}>
      <Kb.Box2
        direction="vertical"
        fullHeight={Kb.Styles.isMobile}
        fullWidth={Kb.Styles.isMobile}
        style={styles.modal}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
          <Kb.Box2
            direction="horizontal"
            alignItems="center"
            fullHeight={true}
            style={Kb.Styles.globalStyles.flexOne}
          >
            <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne} />
            <Kb.Text type={Kb.Styles.isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>
              Account reset initiated
            </Kb.Text>
            <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne} />
          </Kb.Box2>
        </Kb.Box2>
        {error ? (
          <Kb.Banner color="red" key="errors">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null}
        <Kb.Box2 fullWidth={true} direction="vertical" style={styles.body}>
          <Kb.Box2
            gap="small"
            direction="vertical"
            fullWidth={true}
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
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexOne,
    },
    isElectron: {
      minHeight: 220,
    },
  }),
  header: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid' as const,
    minHeight: 48,
  },
  modal: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
    },
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      borderRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
      width: 420,
    },
    isMobile: {
      ...Kb.Styles.globalStyles.fillAbsolute,
    },
  }),
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
  overlay: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      zIndex: 1000,
    },
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.black_20,
    },
    isMobile: {
      backgroundColor: Kb.Styles.globalColors.white,
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
      ...Kb.Styles.globalStyles.flexOne,
      paddingBottom: Kb.Styles.globalMargins.xlarge,
      paddingTop: Kb.Styles.globalMargins.xlarge,
    },
  }),
}))

export default ResetModal
