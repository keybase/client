import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'

export const fakeTeamID = 'fakeTeamID'
const teamID2 = 'faketeamID2'
const teamID3 = 'faketeamID3'
const subteam1 = 'subteam1'
const subteam2 = 'subteam2'
export const fakeTeamIDs = [fakeTeamID, teamID2, teamID3]

export const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...Constants.makeState(),
    teamDetails: new Map([
      [
        fakeTeamID,
        {
          ...Constants.emptyTeamDetails,
          description: 'A team for people who live in story books, or for people who like story books',
          members: new Map([
            ['jeff', {fullName: 'Jeff', status: 'active', type: 'reader', username: 'jeff'}],
            // prettier-ignore
            ['paula', {fullName: 'Paula Superlonglastnamelikereallylongforreal', status: 'active', type: 'writer', username: 'paula'}],
            ['andonuts', {fullName: '', status: 'active', type: 'writer', username: 'andonuts'}],
          ]),
          subteams: new Set([subteam1, subteam2]),
        },
      ],
      [
        teamID3,
        {
          ...Constants.emptyTeamDetails,
          members: new Map([
            ['andonuts', {fullName: '', status: 'active', type: 'owner', username: 'andonuts'}],
          ]),
        },
      ],
    ]),
    teamMeta: new Map([
      [fakeTeamID, Constants.makeTeamMeta({memberCount: 32, teamname: 'keybase_storybook'})],
      [teamID2, Constants.makeTeamMeta({isOpen: true, memberCount: 11947, teamname: 'fan_club'})],
      [teamID3, Constants.makeTeamMeta({isOpen: false, memberCount: 234, teamname: 'club_penguin'})],
      [
        subteam1,
        Constants.makeTeamMeta({isOpen: true, memberCount: 980, teamname: 'keybase_storybook.friends'}),
      ],
      [subteam2, Constants.makeTeamMeta({isOpen: false, memberCount: 7, teamname: 'keybase_storybook.exec'})],
    ]),
    teamRoleMap: {
      ...draftState.teams.teamRoleMap,
      roles: new Map([[teamID3, {implicitAdmin: false, role: 'admin'}]]),
    },
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
})
