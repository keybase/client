import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {navUpToScreen} from '@/constants/router'
import {usePromptRouteBack} from '@/router-v2/use-prompt-route-back'
import {declineResetPrompt, isResetPromptOpen, resetRunEnded, submitResetPrompt} from './account-reset'

type Props = {route: {params: {hasWallet: boolean; promptId: number}}}

const ConfirmReset = ({route}: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {hasWallet, promptId} = route.params
  const navigation = useNavigation()
  const resolvedRef = React.useRef(false)
  const resolvePrompt = React.useCallback(
    (action: T.RPCGen.ResetPromptResponse) => {
      if (resolvedRef.current) {
        return
      }
      if (submitResetPrompt(promptId, action)) {
        resolvedRef.current = true
      } else {
        // Nothing left to answer (its RPC failed, or the service cancelled the prompt): the screen
        // would be stuck, and it has no back gesture, so go where an answer would have
        navUpToScreen('login')
      }
    },
    [promptId]
  )

  // A back answers nothing, which goes up to login
  const onBack = React.useCallback(() => {
    resolvePrompt(T.RPCGen.ResetPromptResponse.nothing)
  }, [resolvePrompt])
  React.useEffect(() => {
    navigation.setOptions(
      isIOS
        ? ({unstable_headerLeftItems: () => [Kb.nativeBackHeaderItem(onBack)]} as object)
        : {headerLeft: () => <Kb.HeaderLeftButton onPress={onBack} />}
    )
  }, [navigation, onBack])

  // So does a back of the visible screen (Android's hardware back, Escape), in place of the pop.
  // Removed any other way (a dismissal, clearModals, its root swapped out, while hidden under
  // others), it answers nothing without navigating, once its route has left the navigation state.
  usePromptRouteBack({
    decline: declineResetPrompt,
    isOpen: isResetPromptOpen,
    onBack,
    promptId,
    until: resetRunEnded,
  })

  const onContinue = () => {
    resolvePrompt(T.RPCGen.ResetPromptResponse.confirmReset)
  }
  const onCancelReset = () => {
    resolvePrompt(T.RPCGen.ResetPromptResponse.cancelReset)
  }
  const onClose = () => {
    resolvePrompt(T.RPCGen.ResetPromptResponse.nothing)
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
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        gap="medium"
        alignItems="center"
        alignSelf="center"
        padding="medium"
        style={styles.container}
      >
        <Kb.Icon type="iconfont-skull" sizeType="Big" color={theme.black} />
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
      <Kb.ModalFooter style={styles.footer}>
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
      </Kb.ModalFooter>
    </>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  buttonBar: {
    alignItems: 'center',
  },
  container: Kb.Styles.platformStyles({
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
