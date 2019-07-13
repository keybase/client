import {UserList} from '../common-adapters/usernames'

// Parses the folder name and returns an array of usernames
export function parseFolderNameToUsers(yourUsername: string | null, folderName: string): UserList {
  const [userList] = splitByFirstOccurrenceOf(folderName, ' ')
  const [writers, readers = ''] = userList.split('#')

  const writersParsed = writers.split(',').map(u => ({
    username: u,
    you: yourUsername === u,
  }))

  const readersParsed = readers.split(',').map(u => ({
    readOnly: true,
    username: u,
    you: yourUsername === u,
  }))

  return writersParsed.concat(readersParsed).filter(u => !!u.username)
}

export function folderNameWithoutUsers(folderName: string, users: {[K in string]: boolean}) {
  const [userList] = splitByFirstOccurrenceOf(folderName, ' ')
  const [writers, readers = undefined] = splitByFirstOccurrenceOf(userList, '#')

  const writerNames = writers.split(',')
  const readerNames = readers ? readers.split(',') : []

  const filteredWriterNames = writerNames.filter(name => !users[name])
  const filteredReaderNames = readerNames.filter(name => !users[name])

  const readerSuffix = filteredReaderNames.length ? `#${filteredReaderNames.join(',')}` : ''
  return `${filteredWriterNames.join(',')}${readerSuffix}`
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

const splitByFirstOccurrenceOf = (str: string, delimiter: string): Array<string> => {
  const firstIndexOf = str.indexOf(delimiter)
  if (firstIndexOf === -1) {
    return [str, '']
  }
  return [str.substring(0, firstIndexOf), str.substring(firstIndexOf + 1)]
}

export const tlfToPreferredOrder = (tlf: string, me: string): string => {
  const [userList, extension = ''] = splitByFirstOccurrenceOf(tlf, ' ')
  const [writers, readers = undefined] = splitByFirstOccurrenceOf(userList, '#')

  let writerNames = writers.split(',')
  let readerNames = readers ? readers.split(',') : []
  let whereAmI = writerNames.indexOf(me)
  if (whereAmI === -1) {
    whereAmI = readerNames.indexOf(me)
    if (whereAmI === -1) return tlf
    readerNames.splice(whereAmI, 1)
    readerNames = [me, ...readerNames]
  } else {
    writerNames.splice(whereAmI, 1)
    writerNames = [me, ...writerNames]
  }
  const extensionSuffix = extension ? ` ${extension}` : ''
  const readerSuffix = readerNames.length ? `#${readerNames.join(',')}${extensionSuffix}` : extensionSuffix
  return `${writerNames.join(',')}${readerSuffix}`
}

// helper for making chat calls
export const tlfToParticipantsOrTeamname = (tlf: string) => {
  const parts = tlf.split('/')
  let participants: Array<string> | undefined
  let teamname: string | undefined
  if (parts.length >= 4) {
    const [, , type, names] = parts
    if (type === 'private' || type === 'public') {
      // allow talking to yourself
      participants = parseFolderNameToUsers('', names).map(u => u.username)
    } else if (type === 'team') {
      teamname = names
    }
  }
  return {participants, teamname}
}
