const prefix = 'keybase://'
export const linkFromConvAndMessage = (conv: string, messageID: number) =>
  `${prefix}chat/${conv}/${messageID}`
