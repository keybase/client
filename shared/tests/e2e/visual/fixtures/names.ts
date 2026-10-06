// The fixtures a tour entry may name. Shared by the tour (node) and the app's dev runtime, so it
// imports nothing from the app.
//
// `files`: the definition files under fixtures/ besides runtime.ts; the base meta stores a hash of
// them per fixture, and `check` refuses a base whose fixture has changed since.
// `ready`: the testIDs an entry under the fixture may wait on. Each marks a row drawn from data the
// fixture supplies (never a container that shows empty): the screen is remounted under the fixture,
// so it has no earlier data to draw them from. The driver also waits until every rule the fixture
// marks required has answered.
import * as T from '../../shared/test-ids.ts'

export const FIXTURES = {
  'chat-thread-content': {
    files: ['chat-thread.ts'],
    ready: [
      T.CHAT_ADDED_TO_TEAM,
      T.CHAT_AUDIO_PLAYER,
      T.CHAT_COINFLIP,
      T.CHAT_COINFLIP_PARTICIPANT_LIST,
      T.CHAT_EXPLODING_HEADER,
      T.CHAT_EXPLODING_META,
      T.CHAT_JOURNEY_CARD,
      T.CHAT_MAP_UNFURL,
      T.CHAT_PAYMENT,
    ],
  },
  'device-last-used': {files: ['devices.ts'], ready: [T.DEVICES_ROW_LAST_USED, T.DEVICE_PAGE_LAST_USED]},
  'featured-bots': {files: ['bots.ts'], ready: [T.CHAT_BOT_ROW]},
  'people-follow-suggestions': {files: ['people.ts'], ready: [T.PEOPLE_FOLLOW_SUGGESTION]},
  'team-builder-recs': {files: ['team-building.ts'], ready: [T.TEAM_BUILDING_RESULT_ROW]},
} as const satisfies Record<string, {files: ReadonlyArray<string>; ready: ReadonlyArray<string>}>

export type FixtureName = keyof typeof FIXTURES

// __kbVisualFixtures.version; a driver refuses an app whose runtime speaks another
export const FIXTURE_RUNTIME_VERSION = 1

export const isFixtureName = (name: string): name is FixtureName => Object.prototype.hasOwnProperty.call(FIXTURES, name)
