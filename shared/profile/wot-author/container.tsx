import * as React from 'react'
import {Question1, Question2, Proof} from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/profile'
import * as Tracker2Constants from '../../constants/tracker2'

export type Props = Container.RouteProps<{username: string; question?: Types.WotAuthorQuestion}>

export const WotAuthorRoot = (props: Props) => {
  const voucheeUsername = Container.getRouteProps(props, 'username', '')
  const whichQuestion = Container.getRouteProps(props, 'question', 'question1')
  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  let {error, initialVerificationType} = Container.useSelector(state => state.profile.wotAuthor)
  if (!error && !voucheeUsername) {
    error = 'Routing missing username.'
  }
  const {username: trackerUsername, assertions} = Container.useSelector(state =>
    Tracker2Constants.getDetails(state, voucheeUsername)
  )
  if (whichQuestion === 'question1') {
    let proofs: Proof[] = []
    if (trackerUsername === voucheeUsername) {
      if (assertions) {
        proofs = Array.from(assertions, ([_, assertion]) => assertion).filter(x => x.type !== 'stellar')
      }
    } else {
      error = `Proofs not loaded: ${trackerUsername} != ${voucheeUsername}`
    }
    const onSubmit = answer => {
      console.log(answer) // PICNIC-1087 TODO use values
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {question: 'question2', username: voucheeUsername}, selected: 'profileWotAuthor'}],
        })
      )
    }
    return (
      <Question1
        error={error}
        initialVerificationType={initialVerificationType}
        onSubmit={onSubmit}
        proofs={proofs}
        voucheeUsername={voucheeUsername}
      />
    )
  } else {
    const onSubmit = answer => {
      console.log(answer) // PICNIC-1087 TODO use values
      dispatch(RouteTreeGen.createClearModals())
    }
    return (
      <Question2
        error={error}
        onBack={() => dispatch(nav.safeNavigateUpPayload())}
        onSubmit={onSubmit}
        voucheeUsername={voucheeUsername}
      />
    )
  }
}

export default WotAuthorRoot
