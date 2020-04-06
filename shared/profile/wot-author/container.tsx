import * as React from 'react'
import {Question1, Question2, Proof, Question1Answer} from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'
import * as Tracker2Constants from '../../constants/tracker2'
import * as ProfileGen from '../../actions/profile-gen'

const Question1Wrapper = (props: Container.RouteProps<{username: string}>) => {
  const voucheeUsername = Container.getRouteProps(props, 'username', '')
  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  let error = Container.useSelector(state => state.profile.wotAuthorError)
  if (!error && !voucheeUsername) {
    error = 'Routing missing username.'
  }
  const {username: trackerUsername, assertions} = Container.useSelector(state =>
    Tracker2Constants.getDetails(state, voucheeUsername)
  )
  let proofs: Proof[] = []
  if (trackerUsername === voucheeUsername) {
    if (assertions) {
      proofs = Array.from(assertions, ([_, assertion]) => assertion).filter(x => x.type !== 'stellar')
    }
  } else {
    error = `Proofs not loaded: ${trackerUsername} != ${voucheeUsername}`
  }
  const onSubmit = (answer: Question1Answer) => {
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {question1Answer: answer, username: voucheeUsername}, selected: 'profileWotAuthorQ2'}],
      })
    )
  }
  return (
    <Question1
      error={error}
      initialVerificationType={'in_person'}
      onSubmit={onSubmit}
      proofs={proofs}
      voucheeUsername={voucheeUsername}
    />
  )
}

const Question2Wrapper = (
  props: Container.RouteProps<{
    username: string
    question1Answer: Question1Answer
  }>
) => {
  const voucheeUsername = Container.getRouteProps(props, 'username', '')
  const question1Answer = Container.getRoutePropsOr(props, 'question1Answer', 'error')
  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  let error = Container.useSelector(state => state.profile.wotAuthorError)
  if (!error && !voucheeUsername) {
    error = 'Routing missing username.'
  }
  if (!error && question1Answer === 'error') {
    error = 'Routing missing q1 answer.'
  }
  const waiting = Container.useAnyWaiting(Constants.wotAuthorWaitingKey)
  const onSubmit = ({statement}: {statement: string}) => {
    if (question1Answer === 'error') {
      return
    }
    const {otherText, verificationType} = question1Answer
    dispatch(
      ProfileGen.createWotVouch({
        otherText,
        proofs: [], // PICNIC-1087 TODO
        statement,
        username: voucheeUsername,
        verificationType,
      })
    )
  }
  const onBack = () => {
    dispatch(ProfileGen.createWotVouchSetError({error: ''}))
    dispatch(nav.safeNavigateUpPayload())
  }
  return (
    <Question2
      error={error}
      onBack={onBack}
      onSubmit={onSubmit}
      voucheeUsername={voucheeUsername}
      waiting={waiting}
    />
  )
}

export {Question1Wrapper as Question1, Question2Wrapper as Question2}
