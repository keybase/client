import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
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
const channels = new Map<string, Types.TeamChannelInfo>([
  ['0', {channelname: 'general', conversationIDKey: '0', description: ''}],
  ['1', {channelname: 'random', conversationIDKey: '1', description: ''}],
  ['2', {channelname: 'hellos', conversationIDKey: '2', description: ''}],
  ['3', {channelname: 'NY_MemorialDay', conversationIDKey: '3', description: 'zapu is in town'}],
  ['4', {channelname: 'sandwiches', conversationIDKey: '4', description: 'the worst foods'}],
  ['5', {channelname: 'soups', conversationIDKey: '5', description: 'the best foods'}],
  ['6', {channelname: 'stir-fry', conversationIDKey: '6', description: ''}],
  ['7', {channelname: 'ice-cream', conversationIDKey: '7', description: ''}],
  ['8', {channelname: 'salad', conversationIDKey: '8', description: ''}],
  ['9', {channelname: 'veg', conversationIDKey: '9', description: ''}],
  ['10', {channelname: 'plate-presentation', conversationIDKey: '10', description: ''}],
  ['11', {channelname: 'team-sqawk', conversationIDKey: '11', description: ''}],
  ['12', {channelname: 'team-birbs', conversationIDKey: '12', description: ''}],
  ['13', {channelname: 'team-beasts', conversationIDKey: '13', description: ''}],
  ['14', {channelname: 'team-dogs-of-the-sea-and-other-creatures', conversationIDKey: '14', description: ''}],
])
export const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  const aliceSparseMemberInfoRoot: Types.TreeloaderSparseMemberInfo = {type: 'admin'}
  const aliceSparseMemberInfoSub: Types.TreeloaderSparseMemberInfo = {type: 'none'}

  const channelInfo = new Map<Types.TeamID, Map<string, Types.TeamChannelInfo>>(
    fakeTeamIDs.map(tid => [tid, channels])
  )

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
    activityLevels: {
      channels: new Map([
        ['0', 'recently'],
        ['3', 'active'],
        ['9', 'recently'],
      ]),
      loaded: true,
      teams: new Map([
        [fakeTeamID, 'none'],
        [teamID2, 'recently'],
        [teamID3, 'active'],
      ]),
    },
    channelInfo,
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
          inviteLinks: [
            {
              creatorUsername: 'max',
              id: 'inviteLinkID',
              isValid: true,
              lastJoinedUsername: 'chris',
              numUses: 12,
              role: 'writer' as const,
              url: 'https://keybase.io/invite/link/2942',
              validityDescription: 'Expires after 100 uses',
            },
          ],
          members: new Map([
            [
              'alice',
              {fullName: 'alice', needsPUK: false, status: 'active', type: 'admin', username: 'alice'},
            ],
            ['jeff', {fullName: 'Jeff', needsPUK: false, status: 'active', type: 'reader', username: 'jeff'}],
            // prettier-ignore
            ['paula', {fullName: 'Paula Superlonglastnamelikereallylongforreal', needsPUK: true, status: 'active', type: 'writer', username: 'paula'}],
            [
              'andonuts',
              {fullName: '', needsPUK: false, status: 'active', type: 'writer', username: 'andonuts'},
            ],
          ]),
          subteams: new Set([subteam1, subteam2]),
        },
      ],
      [
        teamID3,
        {
          ...Constants.emptyTeamDetails,
          members: new Map([
            [
              'andonuts',
              {fullName: '', needsPUK: false, status: 'active', type: 'owner', username: 'andonuts'},
            ],
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
              {
                fullName: n,
                needsPUK: false,
                status: 'active',
                type: 'writer',
                username: n.toLowerCase().split(' ')[0],
              },
            ])
          ),
        },
      ],
    ]),
    teamMemberToTreeMemberships: new Map([
      [
        fakeTeamID,
        new Map([
          [
            'alice',
            {
              expectedCount: 2,
              guid: 0,
              memberships: [
                {
                  guid: 0,
                  result: {
                    ok: {
                      role: 'admin',
                      teamID: fakeTeamID,
                    },
                    s: 0,
                  },
                  targetTeamID: fakeTeamID,
                  targetUsername: 'alice',
                  teamName: 'keybase_storybook',
                },
                {
                  guid: 0,
                  result: {
                    ok: {
                      role: 'none',
                      teamID: subteam1,
                    },
                    s: 0,
                  },
                  targetTeamID: fakeTeamID,
                  targetUsername: 'alice',
                  teamName: 'keybase_storybook.friends',
                },
              ],
              targetTeamID: fakeTeamID,
              targetUsername: 'alice',
            },
          ],
        ]),
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
    treeLoaderTeamIDToSparseMemberInfos: new Map([
      [fakeTeamID, new Map([['alice', aliceSparseMemberInfoRoot]])],
      [subteam1, new Map([['alice', aliceSparseMemberInfoSub]])],
    ]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
})
