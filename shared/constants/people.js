// @flow
import * as I from 'immutable'
import * as Types from './types/people'
import * as RPCTypes from './types/flow-types'
import {invert} from 'lodash'

export const todoTypeEnumToType: {[key: Types.TodoTypeEnum]: Types.TodoType} = invert(
  RPCTypes.homeHomeScreenTodoType
)

export const todoTypeToInstructions: {[key: Types.TodoType]: string} = {
  bio: 'Add your name, bio, and location to complete your profile.',
  proof: 'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  device: 'Install Keybase on your phone. Until you have at least 2 devices, you risk losing data.',
  follow: 'Follow at least one person on Keybase. A "follow" is a signed snaphot of someone. It strengthens Keybase and your own security.',
  chat: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
  paperkey: 'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  team: 'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  folder: 'Open an encrypted private folder with someone! They’ll only get notified once you drop files in it.',
  gitRepo: 'Create an encrypted Git repository! Only you will be able to decrypt any of it. And it’s so easy!',
  teamShowcase: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out “Publicity settings" on any team you manage.`,
}
export const todoTypeToConfirmLabel: {[key: Types.TodoType]: string} = {
  bio: 'Edit Profile',
  proof: 'Prove your identities',
  device: 'Get the download link',
  follow: 'Browse people',
  chat: 'Start a chat',
  paperkey: 'Create a paper key',
  team: 'Create a team!',
  folder: 'Open a private folder',
  gitRepo: 'Create a personal git repo',
  teamShowcase: 'Set publicity settings',
}
export const todoTypeToDismissable: {[key: Types.TodoType]: boolean} = {
  bio: false,
  proof: true,
  device: true,
  follow: true,
  chat: true,
  paperkey: false,
  team: true,
  folder: true,
  gitRepo: true,
  teamShowcase: true,
}

// TODO clean this up
export const makeState: I.RecordFactory<Types._State> = I.Record({
  lastViewed: new Date(),
  version: -1,
  oldItems: I.List(),
  newItems: I.List(),
  followSuggestions: I.List(),
})
