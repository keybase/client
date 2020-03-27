import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
export const fakeTeamID = 'fakeTeamID'
const teamID2 = 'faketeamID2'
const teamID3 = 'faketeamID3'
const teamID4 = 'faketeamID4'
export const greenpeace = teamID4
const subteam1 = 'subteam1'
const subteam2 = 'subteam2'
export const fakeTeamIDs = [fakeTeamID, teamID2, teamID3]
const names = [
  'Ted Tonks',
  'Vernon Dursley',
  'Mundungus Fletcher',
  'Vincent Crabbe',
  'Cho Chang',
  'Gregorovitch',
  'Merope Gaunt',
  'Katie Bell',
  'Corban Yaxley',
  'Sirius Black',
  'Bellatrix Lestrange',
  'Cedric Diggory',
  'Salazar Slytherin',
  'Morfin Gaunt',
  'Sturgis Podmore',
  'Aberforth Dumbledore',
  'Mafalda Hopkirk',
  'Augusta Longbottom',
  'Padma Patil',
  'Amycus Carrow',
  'Ludo Bagman',
  'Pius Thicknesse',
  'Quirinus Quirrell',
  'Dean Thomas',
  'Draco Malfoy',
  'Marcus Flint',
  'Lord Voldemort',
  'Minerva McGonagall',
  'Hermione Granger',
  'Marietta Edgecombe',
]
export const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.chat2.inboxLayout = {
    bigTeams: [
      {
        label: {id: fakeTeamID, name: 'keybase_storybook'},
        state: RPCChatTypes.UIInboxBigTeamRowTyp.label,
      },
    ],
    totalSmallTeams: 0,
  }
  draftState.teams = {
    ...Constants.makeState(),
    newTeamWizard: {
      ...draftState.teams.newTeamWizard,
      name: 'greenpeace',
      parentTeamID: teamID4,
    },
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
      [
        teamID4,
        {
          ...Constants.emptyTeamDetails,
          members: new Map(
            names.map(n => [
              n.toLowerCase().split(' ')[0],
              {fullName: n, status: 'active', type: 'writer', username: n.toLowerCase().split(' ')[0]},
            ])
          ),
        },
      ],
    ]),
    teamMeta: new Map([
      [fakeTeamID, Constants.makeTeamMeta({memberCount: 32, teamname: 'keybase_storybook'})],
      [teamID2, Constants.makeTeamMeta({isOpen: true, memberCount: 11947, teamname: 'fan_club'})],
      [teamID3, Constants.makeTeamMeta({isOpen: false, memberCount: 234, teamname: 'club_penguin'})],
      [teamID4, Constants.makeTeamMeta({isOpen: false, memberCount: 30, teamname: 'greenpeace'})],
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
