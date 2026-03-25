import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from './common'
import {useSignupState} from '@/stores/signup'
import {useProvisionState} from '@/stores/provision'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {isValidUsername} from '@/util/simple-validators'

const ConnectedEnterUsername = () => {
  const initialUsername = useSignupState(s => s.username)
  const {resetState, setUsername} = useSignupState(
    C.useShallow(s => ({
      resetState: s.dispatch.resetState,
      setUsername: s.dispatch.setUsername,
    }))
  )
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySignup)
  const {navigateAppend, navigateUp} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      navigateUp: s.dispatch.navigateUp,
    }))
  )
  const onBack = () => {
    resetState()
    navigateUp()
  }
  const [error, setError] = React.useState('')
  const [usernameTaken, setUsernameTaken] = React.useState('')
  const onUsernameChange = () => {
    setError('')
    setUsernameTaken('')
  }
  const onContinue = (username: string) => {
    onUsernameChange()
    const localError = isValidUsername(username)
    if (localError) {
      setError(localError)
      return
    }
    const f = async () => {
      logger.info(`checking ${username}`)
      try {
        await T.RPCGen.signupCheckUsernameAvailableRpcPromise({username}, C.waitingKeySignup)
        logger.info(`${username} success`)
        setUsername(username)
        navigateAppend('signupEnterDevicename')
      } catch (error_) {
        if (error_ instanceof RPCError) {
          logger.warn(`${username} error: ${error_.message}`)
          if (error_.code === T.RPCGen.StatusCode.scbadsignupusernametaken) {
            setUsernameTaken(username)
            return
          }
          setError(error_.code === T.RPCGen.StatusCode.scinputerror ? C.usernameHint : error_.desc)
        }
      }
    }
    ignorePromise(f())
  }

  const startProvision = useProvisionState(s => s.dispatch.startProvision)
  const onLogin = (initUsername: string) => {
    startProvision(initUsername)
  }
  const props = {
    error,
    initialUsername,
    onBack,
    onContinue,
    onLogin,
    onUsernameChange,
    usernameTaken,
    waiting,
  }
  return <EnterUsername {...props} />
}

type Props = {
  error: string
  initialUsername?: string
  onBack: () => void
  onContinue: (username: string) => void
  onLogin: (username: string) => void
  onUsernameChange: () => void
  usernameTaken?: string
  waiting: boolean
}

const EnterUsername = (props: Props) => {
  const [username, onChangeUsername] = React.useState(props.initialUsername || '')
  const [acceptedEULA, setAcceptedEULA] = React.useState(false)
  const eulaUrlProps = Kb.useClickURL('https://keybase.io/docs/acceptable-use-policy')
  const usernameTrimmed = username.trim()
  const disabled = !usernameTrimmed || usernameTrimmed === props.usernameTaken || !acceptedEULA
  const _onChangeUsername = (username: string) => {
    onChangeUsername(username)
    props.onUsernameChange()
  }
  const onContinue = () => {
    if (disabled) {
      return
    }
    onChangeUsername(usernameTrimmed) // maybe trim the input
    props.onContinue(usernameTrimmed)
  }
  const eulaLabel = (
    <Kb.Text type={Kb.Styles.isMobile ? 'BodySmall' : 'Body'} style={{alignSelf: 'center'}}>
      I accept the{' '}
      <Kb.Text
        type={Kb.Styles.isMobile ? 'BodySmallPrimaryLink' : 'BodyPrimaryLink'}
        {...eulaUrlProps}
      >
        Keybase Acceptable Use Policy
      </Kb.Text>
    </Kb.Text>
  )
  const eulaBlock = (
    <Kb.Checkbox label={eulaLabel} checked={acceptedEULA} onCheck={() => setAcceptedEULA(s => !s)} />
  )
  return (
    <SignupScreen
      banners={
        <>
          {props.usernameTaken ? (
            <Kb.Banner key="usernameTaken" color="blue">
              <Kb.BannerParagraph
                bannerColor="blue"
                content={[
                  'Sorry, this username is already taken. Did you mean to ',
                  {
                    onClick: () => props.usernameTaken && props.onLogin(props.usernameTaken),
                    text: `log in as ${props.usernameTaken}`,
                  },
                  '?',
                ]}
              />
            </Kb.Banner>
          ) : null}
          {errorBanner(props.error)}
        </>
      }
      buttons={[
        {
          disabled: disabled,
          label: 'Continue',
          onClick: onContinue,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      footer={Kb.Styles.isMobile ? eulaBlock : undefined}
      onBack={props.onBack}
      title="Create account"
    >
      <Kb.ScrollView>
        <Kb.Box2
          alignItems="center"
          gap={Kb.Styles.isMobile ? 'small' : 'medium'}
          direction="vertical"
          flex={1}
          fullWidth={true}
        >
          <Kb.Avatar size={C.isLargeScreen ? 96 : 64} />
          <Kb.Box2 direction="vertical" fullWidth={Kb.Styles.isPhone} gap="tiny">
            <Kb.Input3
              autoFocus={true}
              containerStyle={styles.input}
              placeholder="Pick a username"
              maxLength={C.maxUsernameLength}
              onChangeText={_onChangeUsername}
              onEnterKeyDown={onContinue}
              value={username}
            />
            <Kb.Text type="BodySmall">Your username is unique and can not be changed in the future.</Kb.Text>
          </Kb.Box2>
          {!Kb.Styles.isMobile && eulaBlock}
        </Kb.Box2>
      </Kb.ScrollView>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  input: Kb.Styles.platformStyles({
    isElectron: {width: 368},
    isTablet: {width: 368},
  }),
}))

export default ConnectedEnterUsername
