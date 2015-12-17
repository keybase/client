/* @flow */

// Parses the folder name and returns an array of usernames (TODO: handle read only-ers)
export function parseFolderNameToUsers (folderName: string): Array<string> {
  return folderName.split(',')
}

// Make sure the given username is at the front of the array.
// To fit our canonical representation of foldernames (yourself being in the front)
export function canonicalizeUsernames (username: string, usernames: Array<string>): Array<string> {
  return [].concat(usernames.filter(u => u === username), usernames.filter(u => u !== username))
}

