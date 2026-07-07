import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as T from '@/constants/types'
import {SignupScreen, errorBanner} from '@/signup/common'
import {QuestionBody} from '../common'
import type {ButtonType} from '@/common-adapters/button'
import {enterResetPipeline} from '@/login/reset/account-reset'
import {startRecoverPassword, submitRecoverPasswordReset} from './flow'

export type Props = {
  resetPassword?: boolean
  skipPassword: boolean
  username: string
}

const PromptReset = (props: Props) => {
  const nav = useSafeNavigation()
  const [error, setError] = React.useState('')
  const {resetPassword, skipPassword, username} = props

  const onContinue = () => {
    // dont do this in preflight
    if (C.androidIsTestDevice) {
      nav.safeNavigateUp()
      return
    }
    if (resetPassword) {
      submitRecoverPasswordReset(T.RPCGen.ResetPromptResponse.confirmReset)
    }
    if (skipPassword) {
      enterResetPipeline({onError: setError, username})
    } else {
      nav.safeNavigateAppend({name: 'resetKnowPassword', params: {username}}, true)
    }
  }
  const onBack = () => {
    if (skipPassword) {
      startRecoverPassword({replaceRoute: true, username})
    } else {
      nav.safeNavigateUp()
    }
  }
  const title = props.resetPassword ? 'Reset password' : skipPassword ? 'Recover password' : 'Account reset'

  return (
    <SignupScreen
      buttons={[
        {
          label: props.resetPassword ? 'Send a link' : 'Start account reset',
          onClick: onContinue,
          type: 'Default' as ButtonType,
          waitingKey: C.waitingKeyAutoresetEnterPipeline,
        },
      ]}
      banners={errorBanner(error)}
      onBack={onBack}
      noBackground={true}
      title={title}
    >
      <QuestionBody
        centered={false}
        icon={<Kb.Icon type="iconfont-skull" sizeType="Big" color={Kb.Styles.globalColors.black} />}
      >
        {props.resetPassword ? (
          <Kb.Text type="Body" center={true} style={styles.main}>
            If you have forgotten your password you can reset it here. You will keep your username, but{' '}
            <Kb.Text type="BodyBold">
              lose all your encrypted data, including all of your uploaded private PGP keys
            </Kb.Text>
            .
          </Kb.Text>
        ) : (
          <>
            <Kb.Text type="Body" center={true} style={styles.main}>
              If you have lost all of your devices, or if you logged out or uninstalled Keybase from all of
              them and forgot your password, you can reset your account.
            </Kb.Text>
            <Kb.Text type="Body" center={true} style={styles.main}>
              You will keep your username but{' '}
              <Kb.Text type="BodyBold">
                lose all your data (chat, files, git repos) and be removed from teams.
              </Kb.Text>{' '}
              Teams for which you were the last admin or owner will be lost forever.
            </Kb.Text>
          </>
        )}
      </QuestionBody>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  main: {
    ...Kb.Styles.padding(0, Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.small),
    maxWidth: 500,
  },
}))

export default PromptReset
