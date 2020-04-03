import * as React from 'react'
import {Question1, Question2} from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

export type Props = Container.RouteProps<{username: string}>

export const WotAuthorRoot = (props: Props) => {
  const voucheeUsername = Container.getRouteProps(props, 'username', '')
  const dispatch = Container.useDispatch()
  const [whichQuestion, setWhichQuestion] = React.useState<'question1' | 'question2'>('question1')
  let {error, initialVerificationType} = Container.useSelector(state => state.profile.wotAuthor)
  if (!error && !voucheeUsername) {
    error = 'Routing missing username.'
  }
  if (whichQuestion === 'question1') {
    const proofs = [{key: 'web', value: 'fake.proof'}] // PICNIC-1088 TODO
    const onSubmit = answer => {
      console.log(answer) // PICNIC-1087 TODO use values
      setWhichQuestion('question2')
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
      dispatch(RouteTreeGen.createNavigateUp()) // xxx todo nav
    }
    return (
      <Question2
        error={error}
        onBack={() => setWhichQuestion('question1')}
        onSubmit={onSubmit}
        voucheeUsername={voucheeUsername}
      />
    )
  }
}

export default WotAuthorRoot
