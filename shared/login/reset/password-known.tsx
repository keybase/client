import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from '@/signup/common'
import {QuestionBody} from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'
import {enterResetPipeline} from './account-reset'

type Props = {route: {params: {username: string}}}

const KnowPassword = ({route}: Props) => {
  const {username} = route.params
  const [error, setError] = React.useState('')
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const nav = useSafeNavigation()
  const onCancel = () => nav.safeNavigateUp()
  const onYes = () => nav.safeNavigateAppend({name: 'resetEnterPassword', params: {username}})
  const onNo = () => enterResetPipeline({onError: setError, username})
  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      onBack={onCancel}
      banners={errorBanner(error)}
      buttons={[
        {label: 'Yes', onClick: onYes, type: 'Success'},
        {label: 'No', onClick: onNo, type: 'Dim', waiting},
      ]}
    >
      <QuestionBody icon={<Kb.Icon type="iconfont-password" color={Kb.Styles.globalColors.black} fontSize={24} />}>
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="Header" center={true}>
            Do you know your
          </Kb.Text>
          <Kb.Text type="Header" center={true}>
            password?
          </Kb.Text>
        </Kb.Box2>
      </QuestionBody>
    </SignupScreen>
  )
}

export default KnowPassword
