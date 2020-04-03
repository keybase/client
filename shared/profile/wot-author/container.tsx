import * as React from 'react'
import {Question1, Question2} from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/profile'

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
  if (whichQuestion === 'question1') {
    const proofs = [{key: 'web', value: 'fake.proof'}] // PICNIC-1088 TODO
    const onSubmit = answer => {
      console.log(answer) // PICNIC-1087 TODO use values
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {username: voucheeUsername, question: 'question2'}, selected: 'profileWotAuthor'}],
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
