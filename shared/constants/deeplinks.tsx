export const linkIsKeybaseLink = (link: string) => link.startsWith('keybase://')

export const linkFromConvAndMessage = (conv: string, messageID: number) =>
  `keybase://chat/${conv}/${messageID}`
