import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

type Props = {route: {params: {hasWallet: boolean}}}

const ConfirmReset = ({route}: Props) => {
  const {hasWallet} = route.params
  const error = AutoReset.useAutoResetState(s => s.error)
  const submitResetPrompt = AutoReset.useAutoResetState(s => s.dispatch.dynamic.submitResetPrompt)
  const onContinue = () => {
    submitResetPrompt?.(T.RPCGen.ResetPromptResponse.confirmReset)
  }
  const onCancelReset = () => {
    submitResetPrompt?.(T.RPCGen.ResetPromptResponse.cancelReset)
  }
  const onClose = () => {
    submitResetPrompt?.(T.RPCGen.ResetPromptResponse.nothing)
  }

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
    <>
      {error ? (
        <Kb.Banner color="red" key="errors">
          <Kb.BannerParagraph bannerColor="red" content={error} />
        </Kb.Banner>
      ) : null}
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
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={Kb.Styles.collapseStyles([styles.modalFooter, styles.footer])}>
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
      </Kb.Box2>
    </>
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
}))

export default ConfirmReset
