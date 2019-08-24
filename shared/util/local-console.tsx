import {localLog} from './forward-logs'

const _base = (messageObject, colors) => (
  shortLabel: string,
  longerMessage?: string | null,
  optionalSuffix?: string | null,
  ...rest: Array<any>
) =>
  localLog(
    `%c%s%c${messageObject ? '%O' : '%s'}%c%s%c`,
    `background-color: ${colors[0]}; color: #fff; padding: 2px 4px; font-weight: bold;`,
    shortLabel || '',
    messageObject ? '' : `background-color: ${colors[1]}; color: #000; padding: 2px 4px;`,
    longerMessage || '',
    optionalSuffix ? `background-color: ${colors[0]}; color: #fff; padding: 2px 4px; font-weight: bold;` : '',
    optionalSuffix || '',
    `background-color: white; color: black; padding: 2px 4px; font-weight: normal; font-style: italic;`,
    ...rest
  )

const blue = _base(false, ['#1E88E5', '#90CAF9'])
const blueObject = _base(true, ['#1E88E5', '#90CAF9'])
const brown = _base(false, ['#6D4C41', '#D7CCC8'])
const brownObject = _base(true, ['#6D4C41', '#D7CCC8'])
const gray = _base(false, ['#212121', '#BDBDBD'])
const grayObject = _base(true, ['#212121', '#BDBDBD'])
const green = _base(false, ['#388E3C', '#A5D6A7'])
const greenObject = _base(true, ['#388E3C', '#A5D6A7'])
const orange = _base(false, ['#F4511E', '#FFAB91'])
const orangeObject = _base(true, ['#F4511E', '#FFAB91'])
const purple = _base(false, ['#8E24AA', '#E1BEE7'])
const purpleObject = _base(true, ['#8E24AA', '#E1BEE7'])
const red = _base(false, ['#E53935', '#EF9A9A'])
const redObject = _base(true, ['#E53935', '#EF9A9A'])
const yellow = _base(false, ['#FFD600', '#FFF59D'])
const yellowObject = _base(true, ['#FFD600', '#FFF59D'])

export {blue, brown, gray, green, orange, purple, red, yellow}
export {blueObject, brownObject, grayObject, greenObject, orangeObject, purpleObject, redObject, yellowObject}
