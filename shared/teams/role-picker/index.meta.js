// @flow

import {globalColors} from '../../styles'
import {type TeamRoleType} from '../../constants/types/teams'

export const roleDescMap = {
  reader: 'Can write in chats but read only in folders.',
  writer: 'Can create channels, and write and read in chats and folders.',
  admin:
    'Can manage team member roles, create subteams and channels, and write and read in chats and folders.',
  owner: 'Gets all the admin rights + can delete team. (A team can have multiple owners.)',
}

export const roleIconMap = {
  admin: 'iconfont-crown-admin',
  owner: 'iconfont-crown-owner',
  reader: '',
  writer: '',
}

export const roleIconColorMap = {
  admin: globalColors.black_40,
  owner: globalColors.yellow2,
  reader: '',
  writer: '',
}

const permissions = [
  'Create channels',
  'Create subteams',
  'Add and remove members',
  "Manage team members' roles",
  'Delete the team',
]

const rwPermissions = {
  owner: ['Write and read in chats and folders'],
  admin: ['Write and read in chats and folders'],
  writer: ['Write and read in chats and folders'],
  reader: ['Write and read in chats', 'Read in folders'],
}

export const permissionMap: {[TeamRoleType]: {can: string[], cannot: string[]}} = {
  owner: {
    can: [...rwPermissions['owner'], ...permissions],
    cannot: [],
  },
  admin: {
    can: [...rwPermissions['admin'], ...permissions.slice(0, 4)],
    cannot: [permissions[4]],
  },
  writer: {
    can: [...rwPermissions['writer'], permissions[0]],
    cannot: permissions.slice(1, 5),
  },
  reader: {
    can: rwPermissions['reader'],
    cannot: permissions,
  },
}
