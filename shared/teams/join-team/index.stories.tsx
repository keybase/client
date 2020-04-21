import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import JoinTeamFromInvite from './join-from-invite'
import {fakeTeamID} from '../stories'

const detailsStore = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams.teamInviteDetails = {
    ...draftState.teams.teamInviteDetails,
    inviteDetails: {
      inviteID: 'inviteID',
      inviterResetOrDel: true,
      inviterUID: 'afb5eda3154bc13c1df0189ce93ba119',
      inviterUsername: 't_bob',
      isMember: false,
      teamAvatars: {
        square_192:
          'https://s3.amazonaws.com/keybase_processed_uploads/ee4d65c78c37388efad4f8f98daec905_192_192.jpg',
        square_360:
          'https://s3.amazonaws.com/keybase_processed_uploads/ee4d65c78c37388efad4f8f98daec905_360_360.jpg',
      },
      teamDesc:
        'Where we discuss regarding linux, FOSS, Windows Subsystem Linux, and overall anything related to upkeeping your system. There will be different channels for discussing. General will be mostly for simply free software related sharing. I copied this description from @freesoftware.',
      teamID: fakeTeamID,
      teamIsOpen: false,
      teamName: {parts: ['bobland']},
      teamNumMembers: 1,
    },
    inviteID: 'inviteID',
    inviteKey: 'inviteKey',
  }
})
// const acceptedStore = Container.produce(Sb.createStoreWithCommon(), draftState => {})
const errorStore = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams.teamInviteDetails = {
    ...draftState.teams.teamInviteDetails,
    inviteID: 'inviteID',
    inviteKey: 'inviteKey',
  }
  draftState.teams.errorInTeamJoin = `You're already a member of bobland!`
})

const load = () =>
  Sb.storiesOf('Teams/Invite Links', module)
    .add('Join team from invite - loading', () => <JoinTeamFromInvite />)
    .add('Join team from invite - details', () => (
      <Sb.MockStore store={detailsStore}>
        <JoinTeamFromInvite />
      </Sb.MockStore>
    ))
    /*
      .add('Join team from invite - accepted', () => (
        <Sb.MockStore store={acceptedStore}>
          <JoinTeamFromInvite />
        </Sb.MockStore>
      ))
    */
    .add('Join team from invite - error', () => (
      <Sb.MockStore store={errorStore}>
        <JoinTeamFromInvite />
      </Sb.MockStore>
    ))

export default load
