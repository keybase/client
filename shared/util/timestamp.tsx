import * as dateFns from 'date-fns'
import {enUS} from 'date-fns/locale'
import {uses24HourClock} from '../constants/platform'

const hourMinuteString = uses24HourClock ? 'HH:mm' : 'h:mm a'
const hourMinuteSecondString = uses24HourClock ? 'HH:mm:ss' : 'h:mm:ss a'

// getting this time is very slow on android so we cache it, it never grows large
const chatTimeCache = new Map<number, string>()
let cacheData = dateFns.startOfDay(new Date())
export function formatTimeForChat(time: number): string | null {
  // if the date changes, clear our cache as the 'yesterday' stuff is actually sensitive to this
  if (!dateFns.isToday(cacheData)) {
    chatTimeCache.clear()
  }
  let t = chatTimeCache.get(time)
  if (t !== undefined) return t
  const m = time
  const hma = dateFns.format(m, hourMinuteString)
  if (dateFns.isToday(m)) {
    t = hma
  } else if (dateFns.isYesterday(m)) {
    t = `${hma} - Yesterday`
  } else {
    const today = dateFns.startOfToday()
    const lastWeek = dateFns.sub(today, {days: 7})
    if (dateFns.isAfter(m, lastWeek)) {
      t = `${hma} - ${dateFns.format(m, 'EEE')}`
    } else {
      const lastMonth = dateFns.sub(today, {months: 1})
      if (dateFns.isAfter(m, lastMonth)) {
        t = `${hma} - ${dateFns.format(m, 'd MMM')}`
      } else {
        t = `${hma} - ${dateFns.format(m, 'd MMM yy')}`
      }
    }
  }
  chatTimeCache.set(time, t)
  return t
}

export function formatTimeForConversationList(time: number, nowOverride?: number | null): string {
  const m = new Date(time)
  const now = nowOverride ? new Date(nowOverride) : new Date()
  const weekOld = dateFns.sub(dateFns.startOfDay(now), {days: 7})

  if (dateFns.isSameDay(now, m)) {
    return dateFns.format(m, hourMinuteString)
  } else if (dateFns.isAfter(m, weekOld)) {
    return dateFns.format(m, 'EEE')
  } else if (dateFns.isSameYear(now, m)) {
    return dateFns.format(m, 'MMM d')
  }

  return dateFns.format(m, 'd MMM yy')
}

export function formatTimeForMessages(time: number, nowOverride?: number): string {
  const m = new Date(time)
  const now = nowOverride ? new Date(nowOverride) : dateFns.startOfToday()
  const weekAgo = dateFns.sub(now, {days: 7})

  if (dateFns.isSameDay(now, m)) {
    // Covers interval [startOfToday, endOfToday]
    return 'Today ' + dateFns.format(m, hourMinuteString) // Today 4:34 PM
  } else if (dateFns.isSameDay(dateFns.startOfYesterday(), m)) {
    // Covers interval [startOfYesterday, endOfYesterday]
    return 'Yesterday ' + dateFns.format(m, hourMinuteString) // Yesterday 4:34 PM
  } else if (dateFns.isAfter(m, weekAgo)) {
    // Covers interval [startOfWeekAgo, startOfYesterday)
    return dateFns.format(m, 'EEE ' + hourMinuteString) // Wed 4:34 PM
  } else if (!dateFns.isSameYear(now, m)) {
    // Covers interval [foreverAgo, startOfThisYear)
    return dateFns.format(m, 'MMM dd yyyy ' + hourMinuteString) // Jan 5 2016 4:34 PM
  } else {
    // Covers interval [startOfThisYear, startOfWeekAgo)
    return dateFns.format(m, 'MMM dd ' + hourMinuteString) // Jan 5 4:34 PM
  }
}

const noUpperCaseFirst = {
  lastWeek: "EEE 'at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  yesterday: "'yesterday at' p",
}
const upperCaseFirst = {
  lastWeek: "EEE 'at' p",
  today: "'Today at' p",
  yesterday: "'Yesterday at' p",
}

const formatRelativeCalendarForFS = (dontUpperCase: boolean, token: string, date: Date, baseDate: Date) => {
  if (token === 'other') {
    return dateFns.isSameYear(date, baseDate) ? "EEE MMM d 'at' p" : "EEE MMM d yyyy 'at' p"
  }

  return dontUpperCase ? noUpperCaseFirst[token] : upperCaseFirst[token]
}

export const formatTimeForFS = (time: number, dontUpperCase: boolean): string =>
  dateFns.formatRelative(time, Date.now(), {
    locale: {
      ...enUS,
      formatRelative: (token, date, baseDate) =>
        formatRelativeCalendarForFS(dontUpperCase, token, date, baseDate),
    },
  })

export const formatDuration = (duration: number): string => {
  if (!duration) {
    return ''
  }

  const d = new Date(duration)
  return d.getUTCHours()
    ? `${d.getUTCHours()} hr`
    : d.getUTCMinutes()
    ? `${d.getUTCMinutes()} min`
    : `${d.getUTCSeconds()} s`
}

export const formatAudioRecordDuration = (duration: number): string => {
  return dateFns.format(duration, 'mm:ss')
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
  const d = new Date(duration - 1)
  return dateFns.formatDistanceStrict(0, d, {roundingMethod: 'ceil'})
}

export const formatDurationForLocation = (duration: number): string => {
  if (!duration) {
    return ''
  }
  return dateFns.formatDistanceStrict(0, duration, {
    locale: {
      ...enUS,
      formatDistance: (token, count, _) => formatDistanceAbbr(token, count),
    },
  })
}

export const formatDurationFromNowTo = (timeInFuture?: number): string =>
  timeInFuture ? formatDuration(timeInFuture - Date.now()) : ''

export function formatTimeForPopup(time: number): string {
  return dateFns.format(time, 'EEE MMM dd ' + hourMinuteSecondString) // Wed Jan 5 2016 4:34:15 PM
}

export function formatTimeForStellarDetail(timestamp: Date) {
  return dateFns.format(timestamp, 'EEE, MMM dd yyyy - ' + hourMinuteString) // Tue, Jan 5 2018 - 4:34 PM
}

export function formatTimeForStellarTooltip(timestamp: Date) {
  return dateFns.formatISO(timestamp)
}

export function formatTimeForRevoked(time: number): string {
  const m = new Date(time)
  return dateFns.format(m, 'EEE MMM dd') // Wed Jan 05
}

export function formatTimeForAssertionPopup(time: number): string {
  const m = new Date(time)
  return dateFns.format(m, 'EEE MMM d, yyyy') // Wed Jan 5, 2018
}

export function formatTimeForDeviceTimeline(time: number): string {
  return dateFns.format(new Date(time), 'MMM d, yyyy')
}

export function formatTimeRelativeToNow(time: number): string {
  return dateFns.formatDistanceToNow(new Date(time), {addSuffix: true})
}

export function formatTimeForTeamMember(time: number): string {
  return dateFns.format(new Date(time), 'MMM yyyy')
}

export function daysToLabel(days: number): string {
  let label = `${days} day`
  if (days !== 1) {
    label += 's'
  }
  return label
}

const formatDistanceLocale = {
  xDays: '{{count}}d',
  xHours: '{{count}}h',
  xMinutes: '{{count}}m',
  xMonths: '{{count}}mo',
  xSeconds: '{{count}}s',
  xYears: '{{count}}y',
}

const formatDistanceAbbr = (token: keyof typeof formatDistanceLocale, count: number): string =>
  formatDistanceLocale[token].replace('{{count}}', String(count))

export function formatTimeForPeopleItem(time: number): string {
  return dateFns.formatDistanceStrict(time, Date.now(), {
    locale: {
      ...enUS,
      formatDistance: (token, count, _) =>
        token == 'xSeconds' && count == 1 ? 'now' : formatDistanceAbbr(token, count),
    },
  })
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
  const days = Math.floor(ms / oneDayInMs)
  const secs = Math.floor((ms % (60 * 1000)) / 1000)
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

// 10 {seconds, minutes, hours, days, months, years}
export function formatDurationLong(date: Date, baseDate: Date): string {
  return dateFns.formatDistanceStrict(date, baseDate)
}
