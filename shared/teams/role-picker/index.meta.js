// @flow

export const roleDescMap = {
  null: '',
  reader: 'Can write in chats but read only in folders.',
  writer: 'Can create channels, and write and read in chats and folders.',
  admin: 'Can manage team members roles, create subteams and channels, and write and read in chats and folders.',
  owner: 'Gets all the admin rights + can delete team.',
}

export const roleIconMap = {
  reader: 'iconfont-search',
  writer: 'iconfont-edit',
  admin: 'iconfont-crown',
  owner: 'iconfont-crown',
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

export const permissionMap = {
  owner: {
    can: [...rwPermissions['owner'], ...permissions],
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
