import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/autoreset'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
type Props = {}

const ConfirmReset = (_: Props) => {
  const hasWallet = Container.useSelector(state => state.autoreset.hasWallet)
  const error = Container.useSelector(state => state.autoreset.error)

  const dispatch = Container.useDispatch()

  const onContinue = React.useCallback(
    () =>
      dispatch(
        RecoverPasswordGen.createSubmitResetPrompt({action: RPCTypes.ResetPromptResponse.confirmReset})
      ),
    [dispatch]
  )
  const onCancelReset = React.useCallback(() => {
    dispatch(RecoverPasswordGen.createSubmitResetPrompt({action: RPCTypes.ResetPromptResponse.cancelReset}))
  }, [dispatch])
  const onClose = React.useCallback(
    () =>
      dispatch(RecoverPasswordGen.createSubmitResetPrompt({action: RPCTypes.ResetPromptResponse.nothing})),
    [dispatch]
  )

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
      header={Styles.isMobile ? {title: 'Account reset'} : undefined}
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
              waitingKey={Constants.actuallyResetWaitingKey}
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
        <Kb.Icon type="iconfont-skull" sizeType="Big" color={Styles.globalColors.black} />
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
                  <Kb.Text type="Body" style={Styles.globalStyles.flexOne}>
                    You will <Kb.Text type="BodyExtrabold">lose access to your wallet funds</Kb.Text> if you
                    haven't backed up your Stellar private keys outside of Keybase.
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
ConfirmReset.navigationOptions = {
  gesturesEnabled: false,
}

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {
    alignItems: 'center',
  },
  container: Styles.platformStyles({
    common: {
      alignSelf: 'center',
      padding: Styles.globalMargins.medium,
    },
    isElectron: {
      width: 368 + Styles.globalMargins.medium * 2,
    },
  }),
  footer: Styles.platformStyles({
    isMobile: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    },
  }),
}))

export default ConfirmReset
