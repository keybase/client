import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import AddFromWhere from './add-from-where'
import AddEmail from './add-email'
import AddPhone from './add-phone'
import AddMembersConfirm from './confirm'

const fakeTeamID = 'fakeTeamID'
function makeCommonStore(addingMembers: Types.AddingMember[], membersAlreadyInTeam?: string[]) {
  return Container.produce(Sb.createStoreWithCommon(), draftState => {
    draftState.teams = {
      ...draftState.teams,
      addMembersWizard: {
        ...Constants.addMembersWizardEmptyState,
        addingMembers,
        teamID: fakeTeamID,
        membersAlreadyInTeam: membersAlreadyInTeam ?? [],
      },
      teamMeta: new Map([[fakeTeamID, {...Constants.emptyTeamMeta, teamname: 'greenpeace.board'}]]),
    }
    draftState.config = {
      ...draftState.config,
      username: 'andonuts',
    }
    draftState.settings.phoneNumbers.defaultCountry = 'FR'
  })
}

const commonStore = makeCommonStore([
  {assertion: 'ayoubd', role: 'writer'},
  {assertion: 'max', role: 'writer'},
  {assertion: '+12015550123@phone', role: 'writer'},
  {assertion: '[chris@chris.chris]@email', role: 'writer'},
  {assertion: 'mlsteeele', role: 'writer'},
  {assertion: 'karenm', role: 'writer'},
  {assertion: 'mikem', role: 'writer'},
  {assertion: 'patrickxb', role: 'writer'},
  {assertion: 'jakob223', role: 'writer'},
])

const emailsOnlyStore = makeCommonStore([
  {assertion: '[danny@danny.danny]@email', role: 'writer'},
  {assertion: '[max@max.max]@email', role: 'writer'},
  {assertion: '[mike@mike.mike]@email', role: 'writer'},
  {assertion: '[chris@chris.chris]@email', role: 'writer'},
])

const emailsWithDuplicates = makeCommonStore(
  [
    {assertion: '[danny@danny.danny]@email', role: 'writer'},
    {assertion: '[max@max.max]@email', role: 'writer'},
    {assertion: 'zapu', resolvedFrom: '[michal@zapu.zapu]@email', role: 'writer'},
    // {assertion: 'test', resolvedFrom: '+12125451231@phone', role: 'writer'},
    {assertion: '+48784123123@phone', role: 'writer'},
  ],
  ['[mike@mike.mike]@email', '[chris@chris.chris]@email', '+12015550123@phone']
)

const load = () => {
  Sb.storiesOf('Teams/Add member wizard', module)
    .addDecorator(story => <Sb.MockStore store={commonStore}>{story()}</Sb.MockStore>)
    .add('Add from where', () => <AddFromWhere />)
    .add('Add from where (new team)', () => <AddFromWhere />)
    .add('Add by email', () => <AddEmail teamID={fakeTeamID} errorMessage="" />)
    .add('Add by phone', () => <AddPhone />)

  const sb = Sb.storiesOf('Teams/Add member wizard/Confirm', module)
  for (let [name, store] of [
    ['Mixed types', commonStore],
    ['All emails', emailsOnlyStore],
    ['Members already in team', emailsWithDuplicates],
  ] as const) {
    sb.add(name, () => (
      <Sb.MockStore store={store}>
        <AddMembersConfirm />
      </Sb.MockStore>
    ))
  }
}

export default load
