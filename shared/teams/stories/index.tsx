import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'

export const fakeTeamID = 'fakeTeamID'
const teamID2 = 'faketeamID2'
const teamID3 = 'faketeamID3'
export const fakeTeamIDs = [fakeTeamID, teamID2, teamID3]

const fakeChannelMap = new Map([
  ['0', {...Constants.initialChannelInfo, channelname: 'general'}],
  ['1', {...Constants.initialChannelInfo, channelname: 'random'}],
  ['2', {...Constants.initialChannelInfo, channelname: 'hellos'}],
  ['3', {...Constants.initialChannelInfo, channelname: 'NY_MemorialDay', description: 'zapu is in town'}],
  ['4', {...Constants.initialChannelInfo, channelname: 'sandwiches', description: 'the best foods'}],
  ['5', {...Constants.initialChannelInfo, channelname: 'soups', description: 'the worst foods'}],
  ['6', {...Constants.initialChannelInfo, channelname: 'stir-fry'}],
  ['7', {...Constants.initialChannelInfo, channelname: 'ice-cream'}],
  ['8', {...Constants.initialChannelInfo, channelname: 'salad'}],
  ['9', {...Constants.initialChannelInfo, channelname: 'veg'}],
  ['10', {...Constants.initialChannelInfo, channelname: 'plate-presentation'}],
  ['11', {...Constants.initialChannelInfo, channelname: 'team-sqawk'}],
  ['12', {...Constants.initialChannelInfo, channelname: 'team-birbs'}],
  ['13', {...Constants.initialChannelInfo, channelname: 'team-beasts'}],
  ['14', {...Constants.initialChannelInfo, channelname: 'team-dogs-of-the-sea-and-other-creatures'}],
])
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
    teamIDToChannelInfos: new Map([
      [fakeTeamID, fakeChannelMap],
      [teamID2, fakeChannelMap],
      [teamID3, fakeChannelMap],
    ]),
    teamMeta: new Map([
      [fakeTeamID, Constants.makeTeamMeta({memberCount: 32, teamname: 'keybase_storybook'})],
      [teamID2, Constants.makeTeamMeta({isOpen: true, memberCount: 11947, teamname: 'fan_club'})],
      [teamID3, Constants.makeTeamMeta({isOpen: false, memberCount: 234, teamname: 'club_penguin'})],
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
