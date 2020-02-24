import moment from 'moment'
import {pluralize} from './string'
import {
  startOfDay,
  sub,
  format,
  isSameDay,
  isSameYear,
  isAfter,
  formatDistanceToNow,
  formatISO,
  startOfYesterday,
  startOfToday,
  formatRelative,
} from 'date-fns'

import {enUS} from 'date-fns/esm/locale'

export function formatTimeForChat(time: number): string | null {
  const m = new Date(time)
  const hma = format(m, 'h:mm a')
  const now = new Date()
  const today = startOfToday()
  if (isSameDay(now, m)) {
    return hma
  }
  if (isSameDay(startOfYesterday(), m)) {
    return `${hma} - Yesterday`
  }
  const lastWeek = sub(today, {days: 7})
  if (isAfter(m, lastWeek)) {
    return `${hma} - ${format(m, 'EEE')}`
  }
  const lastMonth = sub(today, {months: 1})
  if (isAfter(m, lastMonth)) {
    return `${hma} - ${format(m, 'd MMM')}`
  }
  return `${hma} - ${format(m, 'd MMM yy')}`
}

export function formatTimeForConversationList(time: number, nowOverride?: number | null): string {
  const m = new Date(time)
  const now = nowOverride ? new Date(nowOverride) : new Date()
  const weekOld = sub(startOfDay(now), {days: 7})

  if (isSameDay(now, m)) {
    return format(m, 'h:mm a')
  } else if (isAfter(m, weekOld)) {
    return format(m, 'EEE')
  } else if (isSameYear(now, m)) {
    return format(m, 'MMM d')
  }

  return format(m, 'd MMM yy')
}

export function formatTimeForMessages(time: number, nowOverride?: number): string {
  const m = new Date(time)
  const now = nowOverride ? new Date(nowOverride) : startOfToday()
  const weekAgo = sub(now, {days: 7})

  if (isSameDay(now, m)) {
    // Covers interval [startOfToday, endOfToday]
    return 'Today ' + format(m, 'h:mm a') // Today 4:34 PM
  } else if (isSameDay(startOfYesterday(), m)) {
    // Covers interval [startOfYesterday, endOfYesterday]
    return 'Yesterday ' + format(m, 'h:mm a') // Yesterday 4:34 PM
  } else if (isAfter(m, weekAgo)) {
    // Covers interval [startOfWeekAgo, startOfYesterday)
    return format(m, 'EEE h:mm a') // Wed 4:34 PM
  } else if (!isSameYear(now, m)) {
    // Covers interval [foreverAgo, startOfThisYear)
    return format(m, 'MMM dd yyyy h:mm a') // Jan 5 2016 4:34 PM
  } else {
    // Covers interval [startOfThisYear, startOfWeekAgo)
    return format(m, 'MMM dd h:mm a') // Jan 5 4:34 PM
  }
}

const noUpperCaseFirst = {
  lastWeek: "ddd 'at' LT",
  today: "'today at' LT",
  tomorrow: "'tomorrow at' LT",
  yesterday: "'yesterday at' LT",
}
const upperCaseFirst = {
  lastWeek: "ddd 'at' LT",
  today: "'Today at' LT",
  yesterday: "'Yesterday at' LT",
}

const formatRelativeCalendarForFS = (dontUpperCase: boolean, token: string, date: Date, baseDate: Date) => {
  if (token === 'other') {
    return isSameYear(date, baseDate) ? "ddd MMM D YYYY 'at' LT" : "ddd MMM D 'at' LT"
  }

  return dontUpperCase ? noUpperCaseFirst[token] : upperCaseFirst[token]
}

export const formatTimeForFS = (time: number, dontUpperCase: boolean): string =>
  formatRelative(time, Date.now(), {
    locale: {
      ...enUS,
      formatRelative: (token, date, baseDate) =>
        formatRelativeCalendarForFS(dontUpperCase, token, date, baseDate),
    },
  })

export const formatDuration = (duration: number): string => {
  // TODO: figure out how to do this with date-fns
  if (!duration) {
    return ''
  }
  const d = moment.duration(duration)
  return d.hours() ? `${d.hours()} hr` : d.minutes() ? `${d.minutes()} min` : `${d.seconds()} s`
}

export const formatAudioRecordDuration = (duration: number): string => {
  return format(duration * 1000, 'mm:ss')
}

export const formatDurationForAutoreset = (duration: number): string => {
  if (!duration) {
    return ''
  }
  if (duration < 0) {
    // This shouldn't happen but can help us find bugs more easily.
    return 'no time'
  }
  // This +1 / -1 is so that the timer says "7 days" when there are between 6 and 7 days left, "1 second" between 0 and 1 seconds, and so on.
  const d = moment.duration(duration - 1)
  let label: string
  let amt: number
  if (d.days()) {
    amt = d.days()
    label = 'day'
  } else if (d.hours()) {
    amt = d.hours()
    label = 'hour'
  } else if (d.minutes()) {
    amt = d.minutes()
    label = 'minute'
  } else {
    amt = d.seconds()
    label = 'second'
  }
  amt += 1
  return `${amt} ${pluralize(label, amt)}`
}

export const formatDurationForLocation = (duration: number): string => {
  if (!duration) {
    return ''
  }
  const d = moment.duration(duration)
  return d.hours() ? `${d.hours()}h` : d.minutes() ? `${d.minutes()}m` : `${d.seconds()}s`
}

export const formatDurationFromNowTo = (timeInFuture?: number): string =>
  timeInFuture ? formatDuration(timeInFuture - Date.now()) : ''

export function formatTimeForPopup(time: number): string {
  return format(time, 'EEE MMM dd h:mm:ss a') // Wed Jan 5 2016 4:34:15 PM
}

export function formatTimeForStellarDetail(timestamp: Date) {
  return format(timestamp, 'EEE, MMM dd yyyy - h:mm a') // Tue, Jan 5 2018 - 4:34 PM
}

export function formatTimeForStellarTooltip(timestamp: Date) {
  return formatISO(timestamp)
}

export function formatTimeForRevoked(time: number): string {
  const m = new Date(time)
  return format(m, 'EEE MMM dd') // Wed Jan 05
}

export function formatTimeForAssertionPopup(time: number): string {
  const m = new Date(time)
  return format(m, 'EEE MMM d, yyyy') // Wed Jan 5, 2018
}

export function formatTimeForDeviceTimeline(time: number): string {
  return format(new Date(time), 'MMM d, yyyy')
}

export function formatTimeRelativeToNow(time: number): string {
  return formatDistanceToNow(new Date(time))
}

export function daysToLabel(days: number): string {
  let label = `${days} day`
  if (days !== 1) {
    label += 's'
  }
  return label
}

const defaultLocale = moment.locale()
moment.defineLocale('people', {
  parentLocale: 'en',
  relativeTime: {
    M: '1mo',
    MM: '%dmo',
    d: '1d',
    dd: '%dd',
    future: 'in %s',
    h: '1h',
    hh: '%dh',
    m: '1m',
    mm: '%dm',
    past: '%s ago',
    s: 'now',
    ss: '%ds',
    y: '1y',
    yy: '%dy',
  },
})
// When we define a locale, moment uses it. So reset it to use the default
moment.locale(defaultLocale)

const formatRelativeLocale = {
  M: '1mo',
  MM: '%dmo',
  d: '1d',
  dd: '%dd',
  future: 'in %s',
  h: '1h',
  hh: '%dh',
  m: '1m',
  mm: '%dm',
  past: '%s ago',
  s: 'now',
  ss: '%ds',
  y: '1y',
  yy: '%dy',
}

export function formatTimeForPeopleItem(time: number): string {
  return moment(time)
    .locale('people') // todo: figure out how to deal with this mess
    .fromNow(true)
}

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24
export function msToDHMS(ms: number): string {
  if (ms < 0) {
    return `0d 0h 0m 0s`
  }
  let mins = Math.floor(ms / oneMinuteInMs)
  let hours = Math.floor(ms / oneHourInMs)
  let days = Math.floor(ms / oneDayInMs)
  let secs = Math.floor((ms % (60 * 1000)) / 1000)
  hours = hours % 24
  mins = mins % 60

  return `${days}d ${hours}h ${mins}m ${secs}s`
}

export function formatDurationShort(ms: number): string {
  if (ms < 0) {
    return '0s'
  }
  if (ms > oneDayInMs) {
    return `${Math.round(ms / oneDayInMs)}d`
  }
  if (ms > oneHourInMs) {
    return `${Math.round(ms / oneHourInMs)}h`
  }
  if (ms > oneMinuteInMs) {
    return `${Math.round(ms / oneMinuteInMs)}m`
  }
  return `${Math.floor(ms / 1000)}s`
}
