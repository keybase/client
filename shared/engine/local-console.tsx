const localLog = console.log.bind(console)

export const green = (
  shortLabel: string,
  longerMessage?: string,
  optionalSuffix?: string,
  ...rest: Array<unknown>
) =>
  localLog(
    `%c%s%c%s%c%s%c`,
    'background-color: #388E3C; color: #fff; padding: 2px 4px; font-weight: bold;',
    shortLabel || '',
    'background-color: #A5D6A7; color: #000; padding: 2px 4px;',
    longerMessage || '',
    optionalSuffix ? 'background-color: #388E3C; color: #fff; padding: 2px 4px; font-weight: bold;' : '',
    optionalSuffix || '',
    'background-color: white; color: black; padding: 2px 4px; font-weight: normal; font-style: italic;',
    ...rest
  )
