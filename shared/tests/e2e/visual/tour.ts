import * as T from '../shared/test-ids.ts'
import type {TourEntry} from './tour-types.ts'

// Tab names are the values in constants/tabs.tsx. Desktop shows eight tabs; phone shows people,
// chat, files, teams and settings.
export const tour: ReadonlyArray<TourEntry> = [
  {
    id: 'tab/people',
    nav: {tab: 'tabs.peopleTab'},
    ready: T.PEOPLE_FEED,
    platforms: ['desktop', 'phone'],
    seal: ['follows'],
  },
  {
    id: 'tab/chat',
    nav: {tab: 'tabs.chatTab'},
    ready: T.CHAT_INBOX_LIST,
    platforms: ['desktop', 'phone'],
    seal: ['inbox'],
  },
  {
    id: 'tab/fs',
    nav: {tab: 'tabs.fsTab'},
    ready: T.FILES_BROWSER,
    platforms: ['desktop', 'phone'],
    seal: ['kbfs'],
  },
  {
    id: 'tab/crypto',
    nav: {tab: 'tabs.cryptoTab'},
    ready: T.CRYPTO_INPUT,
    platforms: ['desktop'],
    seal: [],
  },
  {
    id: 'tab/teams',
    nav: {tab: 'tabs.teamsTab'},
    ready: T.TEAMS_LIST,
    platforms: ['desktop', 'phone'],
    seal: ['teams'],
  },
  {
    id: 'tab/git',
    nav: {tab: 'tabs.gitTab'},
    ready: T.GIT_REPO_LIST,
    platforms: ['desktop'],
    seal: [],
  },
  {
    id: 'tab/devices',
    nav: {tab: 'tabs.devicesTab'},
    ready: T.DEVICES_LIST,
    platforms: ['desktop'],
    seal: ['devices'],
  },
  {
    id: 'tab/settings',
    nav: {tab: 'tabs.settingsTab'},
    ready: T.SETTINGS_ACCOUNT,
    platforms: ['desktop', 'phone'],
    seal: [],
  },
]
