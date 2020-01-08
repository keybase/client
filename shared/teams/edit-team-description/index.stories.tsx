import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'

import EditTeamDescription from '.'

const fakeTeamID = 'abcd1234'
const makeStore = (withErr: boolean) =>
  Container.produce(Sb.createStoreWithCommon(), draftState => {
    draftState.teams = {
      ...Constants.makeState(),
      editDescriptionError: withErr ? 'Something has gone horribly wrong!!!' : '',
      teamDetails: new Map([[fakeTeamID, {...Constants.emptyTeamDetails, teamname: 'description_changers'}]]),
      teamIDToPublicitySettings: new Map([
        [
          fakeTeamID,
          {
            ...Constants.initialPublicitySettings,
            description: 'A team for people who change team descriptions',
          },
        ],
      ]),
    }
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
