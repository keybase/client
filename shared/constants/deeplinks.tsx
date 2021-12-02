const prefix = 'keybase://'

export const linkIsKeybaseLink = (link: string) => link.startsWith(prefix)

export const linkFromConvAndMessage = (conv: string, messageID: number) =>
  `${prefix}chat/${conv}/${messageID}`

export const isValidLink = (link: string) => {
  if (!link.startsWith(prefix)) {
    return false
  }
  const path = link.substring(prefix.length)
  const parts = path.split('/')

  switch (parts[0]) {
    case 'profile':
      switch (parts[1]) {
        case 'new-proof':
          return (
            (parts.length === 3 && parts[2].length) ||
            (parts.length === 4 && parts[3].length && parts[2].length)
          )
        case 'show':
          if (parts.length === 3 && parts[2]?.length) {
            return true
          }
      }
      return false
    case 'private':
      return true
    case 'public':
      return true
    case 'team':
      return true
    case 'chat':
      return (
        (parts.length === 2 && parts[1].length) || (parts.length === 3 && parts[2].length && parts[1].length)
      )
    case 'team-page':
      return parts.length === 3 && parts[2].length && parts[1].length
    case 'incoming-share':
      return parts.length === 1
    case 'team-invite-link':
      return parts.length === 1
  }

  return false
}
