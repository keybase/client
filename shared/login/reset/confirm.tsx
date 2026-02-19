import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useState as useRecoverState} from '@/stores/recover-password'

const ConfirmReset = () => {
  const hasWallet = AutoReset.useAutoResetState(s => s.hasWallet)
  const error = AutoReset.useAutoResetState(s => s.error)
  const submitResetPassword = useRecoverState(s => s.dispatch.dynamic.submitResetPassword)
  const onContinue = React.useCallback(() => {
    submitResetPassword?.(T.RPCGen.ResetPromptResponse.confirmReset)
  }, [submitResetPassword])
  const onCancelReset = React.useCallback(() => {
    submitResetPassword?.(T.RPCGen.ResetPromptResponse.cancelReset)
  }, [submitResetPassword])
  const onClose = React.useCallback(() => {
    submitResetPassword?.(T.RPCGen.ResetPromptResponse.nothing)
  }, [submitResetPassword])

  const [checks, setChecks] = React.useState({
    checkData: false,
    checkNewPerson: false,
    checkTeams: false,
    checkWallet: false,
  })
  const onCheck = (which: keyof typeof checks) => (enable: boolean) => setChecks({...checks, [which]: enable})
  const {checkData, checkTeams, checkWallet, checkNewPerson} = checks
  let disabled = !checkData || !checkTeams || !checkNewPerson
  if (hasWallet) {
    disabled = disabled || !checkWallet
  }

  return (
    <Kb.Modal
      header={Kb.Styles.isMobile ? {title: 'Account reset'} : undefined}
      fullscreen={true}
      footer={{
        content: (
          <Kb.ButtonBar direction="column" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              disabled={disabled}
              label="Yes, reset account"
              onClick={onContinue}
              type="Danger"
              fullWidth={true}
              waitingKey={C.waitingKeyAutoresetActuallyReset}
            />
            <Kb.Button label="Close" onClick={onClose} type="Dim" fullWidth={true} />
          </Kb.ButtonBar>
        ),
        style: styles.footer,
      }}
      banners={
        error ? (
          <Kb.Banner color="red" key="errors">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        gap="medium"
        alignItems="center"
        style={styles.container}
      >
        <Kb.Icon type="iconfont-skull" sizeType="Big" color={Kb.Styles.globalColors.black} />
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" alignItems="center">
          <Kb.Text type="Header">Go ahead with reset?</Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xsmall" alignItems="flex-start">
            <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true}>
              <Kb.Text type="Body" center={true}>
                You can now fully reset your account.
              </Kb.Text>
              <Kb.Text type="Body" center={true}>
                Please check the boxes below:
              </Kb.Text>
            </Kb.Box2>
            <Kb.Checkbox
              label="You will lose your personal chats, files and git data."
              checked={checkData}
              onCheck={onCheck('checkData')}
            />
            <Kb.Checkbox
              label="You will be removed from teams. If you were the last owner or admin of a team, it'll be orphaned and unrecoverable."
              checked={checkTeams}
              onCheck={onCheck('checkTeams')}
            />
            {hasWallet && (
              <Kb.Checkbox
                labelComponent={
                  <Kb.Text type="Body" style={Kb.Styles.globalStyles.flexOne}>
                    You will <Kb.Text type="BodyExtrabold">lose access to your wallet funds</Kb.Text> if you
                    haven&apos;t backed up your Stellar private keys outside of Keybase.
                  </Kb.Text>
                }
                checked={checkWallet}
                onCheck={onCheck('checkWallet')}
              />
            )}
            <Kb.Checkbox
              label="Cryptographically, you'll be a whole new person."
              checked={checkNewPerson}
              onCheck={onCheck('checkNewPerson')}
            />
          </Kb.Box2>
          <Kb.Text type="Body">
            Or you can{' '}
            <Kb.Text type="BodyPrimaryLink" onClick={onCancelReset}>
              cancel the reset
            </Kb.Text>
            .
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: {
    alignItems: 'center',
  },
  container: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'center',
      padding: Kb.Styles.globalMargins.medium,
    },
    isElectron: {
      width: 368 + Kb.Styles.globalMargins.medium * 2,
    },
  }),
  footer: Kb.Styles.platformStyles({
    isMobile: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
    },
  }),
}))

export default ConfirmReset
