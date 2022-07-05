import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import {fakeTeamID, store} from '../stories'
import EditTeamDescription from '.'

const makeStore = (withErr: boolean) =>
  Container.produce(store, draftState => {
    draftState.teams.errorInEditDescription = withErr ? 'Something has gone horribly wrong!!!' : ''
  })

const load = () =>
  Sb.storiesOf('Teams/Edit team description', module)
    .add('Normal', () => (
      <Sb.MockStore store={makeStore(false)}>
        <EditTeamDescription {...Sb.createNavigator({teamID: fakeTeamID})} />
      </Sb.MockStore>
    ))
    .add('Error', () => (
      <Sb.MockStore store={makeStore(true)}>
        <EditTeamDescription {...Sb.createNavigator({teamID: fakeTeamID})} />
      </Sb.MockStore>
    ))

export default load
