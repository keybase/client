import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import AddFromWhere from './add-from-where'
import EnableContacts from './enable-contacts'
import AddEmail from './add-email'
import AddPhone from './add-phone'
import AddMembersConfirm from './confirm'

const fakeTeamID = 'fakeTeamID'
const commonStore = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    addMembersWizard: {
      ...Constants.addMembersWizardEmptyState,
      addingMembers: [
        {assertion: 'ayoubd', role: 'writer'},
        {assertion: 'max', role: 'writer'},
        {assertion: '+12015550123@phone', role: 'writer'},
        {assertion: '[chris@chris.chris]@email', role: 'writer'},
        {assertion: 'mlsteeele', role: 'writer'},
        {assertion: 'karenm', role: 'writer'},
        {assertion: 'mikem', role: 'writer'},
        {assertion: 'patrickxb', role: 'writer'},
        {assertion: 'jakob223', role: 'writer'},
      ],
      teamID: fakeTeamID,
    },
    teamMeta: new Map([[fakeTeamID, {...Constants.emptyTeamMeta, teamname: 'greenpeace.board'}]]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
  draftState.settings.phoneNumbers.defaultCountry = 'FR'
})
const emailsOnlyStore = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    addMembersWizard: {
      ...Constants.addMembersWizardEmptyState,
      addingMembers: [
        {assertion: '[danny@danny.danny]@email', role: 'writer'},
        {assertion: '[max@max.max]@email', role: 'writer'},
        {assertion: '[mike@mike.mike]@email', role: 'writer'},
        {assertion: '[chris@chris.chris]@email', role: 'writer'},
      ],
      teamID: fakeTeamID,
    },
    teamMeta: new Map([[fakeTeamID, {...Constants.emptyTeamMeta, teamname: 'greenpeace.board'}]]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
  draftState.settings.phoneNumbers.defaultCountry = 'FR'
})

const fromWhereNewProps = Sb.createNavigator({newTeam: true, teamID: fakeTeamID})

const load = () => {
  Sb.storiesOf('Teams/Add member wizard', module)
    .addDecorator(story => <Sb.MockStore store={commonStore}>{story()}</Sb.MockStore>)
    .add('Add from where', () => <AddFromWhere {...Sb.createNavigator({})} />)
    .add('Add from where (new team)', () => <AddFromWhere {...fromWhereNewProps} />)
    .add('Enable contacts', () => <EnableContacts onClose={Sb.action('onClose')} />)
    .add('Add by email', () => <AddEmail teamID={fakeTeamID} errorMessage="" />)
    .add('Add by phone', () => <AddPhone />)

  Sb.storiesOf('Teams/Add member wizard/Confirm', module)
    .add('Mixed types', () => (
      <Sb.MockStore store={commonStore}>
        <AddMembersConfirm />
      </Sb.MockStore>
    ))
    .add('All emails', () => (
      <Sb.MockStore store={emailsOnlyStore}>
        <AddMembersConfirm />
      </Sb.MockStore>
    ))
}

export default load
