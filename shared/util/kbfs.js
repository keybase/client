// @flow
import type {UserList} from '../common-adapters/usernames'

// Parses the folder name and returns an array of usernames
export function parseFolderNameToUsers(yourUsername: ?string, folderName: string): UserList {
  const [rwers, readers = ''] = folderName.split('#')

  const rwersParsed = rwers.split(',').map(u => ({
    username: u,
    you: yourUsername === u,
  }))

  const readersParsed = readers.split(',').map(u => ({
    username: u,
    you: yourUsername === u,
    readOnly: true,
  }))

  return rwersParsed.concat(readersParsed).filter(u => !!u.username)
}

export function sortUserList(users: UserList): UserList {
  const youAsRwer = users.filter(u => u.you && !u.readOnly)
  const rwers = users.filter(u => !u.you && !u.readOnly)
  const youAsReader = users.filter(u => u.you && !!u.readOnly)
  const readers = users.filter(u => !u.you && !!u.readOnly)

  // Turn boolean into int for flow to be okay with this type
  const sortByUsername = (a, b) => +(a.username > b.username)
  return youAsRwer.concat(rwers.sort(sortByUsername), youAsReader, readers.sort(sortByUsername))
}
