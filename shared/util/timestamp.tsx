import moment from 'moment'

const twenty4hrtime = true

function formatHourMinute(m: moment.Moment) {
  if (twenty4hrtime) {
    return m.format('H:mm')
  }
  return m.format('h:mm A')
}

export function formatTimeForChat(time: number): string | null {
  const m = moment(time)
  const hourminute = formatHourMinute(m)
  const now = moment()
  const today = now.clone().startOf('day')
  if (m.isSame(today, 'd')) {
    return hourminute
  }
  const yesterday = today
    .clone()
    .subtract(1, 'day')
    .startOf('day')
  if (m.isSame(yesterday, 'd')) {
    return `${hourminute} - Yesterday`
  }
  const lastWeek = today.clone().subtract(7, 'day')
  if (m.isAfter(lastWeek)) {
    return `${hourminute} - ${m.format('ddd')}`
  }
  const lastMonth = today.clone().subtract(1, 'month')
  if (m.isAfter(lastMonth)) {
    return `${hourminute} - ${m.format('D MMM')}`
  }
  return `${hourminute} - ${m.format('D MMM YY')}`
}

export function formatTimeForConversationList(time: number, nowOverride?: number | null): string {
  const m = moment(time)
  const now = nowOverride ? moment(nowOverride) : moment()
  const today = now.clone().startOf('day')
  const weekOld = today.clone().subtract(7, 'days')

  if (m.isSame(today, 'd')) {
    return formatHourMinute(m)
  } else if (m.isAfter(weekOld)) {
    return m.format('ddd')
  }

  return m.format('MMM D')
}

export function formatTimeForMessages(time: number, nowOverride?: number): string {
  const m = moment(time)
  const now = nowOverride ? moment(nowOverride) : moment().startOf('day')
  const yesterday = moment()
    .subtract(1, 'days')
    .startOf('day')
  const weekAgo = moment()
    .subtract(7, 'days')
    .startOf('day')

  if (m.isSame(now, 'd')) {
    // Covers interval [startOfToday, endOfToday]
    return 'Today ' + formatHourMinute(m) // Today 4:34 PM / Today 16:34
  } else if (m.isSame(yesterday, 'd')) {
    // Covers interval [startOfYesterday, endOfYesterday]
    return 'Yesterday ' + formatHourMinute(m) // Yesterday 4:34 PM / Yesterday 16:34
  } else if (m.isAfter(weekAgo)) {
    // Covers interval [startOfWeekAgo, startOfYesterday)
    return m.format('ddd ') + formatHourMinute(m) // Wed 4:34 PM / Wed 16:34
  } else if (!m.isSame(now, 'year')) {
    // Covers interval [foreverAgo, startOfThisYear)
    return m.format('MMM DD YYYY ') + formatHourMinute(m) // Jan 5 2016 4:34 PM / Jan 5 2016 16:34
  } else {
    // Covers interval [startOfThisYear, startOfWeekAgo)
    return m.format('MMM DD ') + formatHourMinute(m) // Jan 5 4:34 PM / Jan 5 16:34
  }
}

const calendarFormatsForFS = {
  noUpperCaseFirst: {
    lastDay: '[yesterday at] LT',
    lastWeek: 'ddd [at] LT',
    sameDay: '[today at] LT',
    sameElse: function(this: moment.Moment, now: moment.Moment) {
      return this.year() !== now.year() ? 'ddd MMM D YYYY [at] LT' : 'ddd MMM D [at] LT'
    },
  },
  upperCaseFirst: {
    lastDay: '[Yesterday at] LT',
    lastWeek: 'ddd [at] LT',
    sameDay: '[Today at] LT',
    sameElse: function(this: moment.Moment, now: moment.Moment) {
      return this.year() !== now.year() ? 'ddd MMM D YYYY [at] LT' : 'ddd MMM D [at] LT'
    },
  },
}

export const formatTimeForFS = (time: number, dontUpperCase: boolean): string =>
  moment(time).calendar(
    // TS definition incorrect
    (null as unknown) as undefined,
    // @ts-ignore definition incorrect
    calendarFormatsForFS[dontUpperCase ? 'noUpperCaseFirst' : 'upperCaseFirst']
  )

export const formatDuration = (duration: number): string => {
  if (!duration) {
    return ''
  }
  const d = moment.duration(duration)
  return d.hours() ? `${d.hours()} hr` : d.minutes() ? `${d.minutes()} min` : `${d.seconds()} s`
}

export const formatDurationFromNowTo = (timeInFuture?: number): string =>
  timeInFuture ? formatDuration(timeInFuture - Date.now()) : ''

export function formatTimeForPopup(time: number): string {
  const m = moment(time)
  return m.format('ddd MMM DD ') + formatHourMinute(m) // Wed Jan 5 2016 4:34 PM / Wed Jan 5 2016 16:34
}

export function formatTimeForStellarDetail(timestamp: Date) {
  const m = moment(timestamp)
  return m.format('ddd, MMM DD YYYY - ') + formatHourMinute(m) // Tue, Jan 5 2018 - 4:34 PM / Tue, Jan 5 2018 - 16:34
}

export function formatTimeForStellarTooltip(timestamp: Date) {
  return moment(timestamp).format()
}

export function formatTimeForRevoked(time: number): string {
  const m = moment(time)
  return m.format('ddd MMM DD') // Wed Jan 05
}

export function formatTimeForAssertionPopup(time: number): string {
  const m = moment(time)
  return m.format('ddd MMM D, YYYY') // Wed Jan 5, 2018
}

export function formatTimeForDeviceTimeline(time: number): string {
  return moment(time).format('MMM D, YYYY')
}

export function formatTimeRelativeToNow(time: number): string {
  return moment(time).fromNow()
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

export function formatTimeForPeopleItem(time: number): string {
  return moment(time)
    .locale('people')
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
