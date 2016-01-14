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

export function stripPublicTag (folderName: string): string {
  return folderName.replace('#public', '')
}

export function getTLF (isPublic: boolean, basedir: string): string {
  if (isPublic) {
    // Public filenames look like cjb#public/foo.txt
    return `/public/${stripPublicTag(basedir)}`
  } else {
    // Private filenames look like cjb/foo.txt
    return `/private/${basedir}`
  }
}

export function cleanup (folderName: string): string {
  if (!folderName) {
    return ''
  }

  return folderName.replace(/\s/g, '').replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '')
}
