const localLog = console.log.bind(console)

const _base =
  (messageObject: boolean, colors: Array<string>) =>
  (shortLabel: string, longerMessage?: string, optionalSuffix?: string, ...rest: Array<unknown>) =>
    localLog(
      `%c%s%c${messageObject ? '%O' : '%s'}%c%s%c`,
      `background-color: ${colors[0]}; color: #fff; padding: 2px 4px; font-weight: bold;`,
      shortLabel || '',
      messageObject ? '' : `background-color: ${colors[1]}; color: #000; padding: 2px 4px;`,
      longerMessage || '',
      optionalSuffix
        ? `background-color: ${colors[0]}; color: #fff; padding: 2px 4px; font-weight: bold;`
        : '',
      optionalSuffix || '',
      `background-color: white; color: black; padding: 2px 4px; font-weight: normal; font-style: italic;`,
      ...rest
    )

export const green = _base(false, ['#388E3C', '#A5D6A7'])
