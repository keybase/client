/// <reference types="jest" />
import * as dateFns from 'date-fns'
import {
  clearChatTimeCache,
  formatAudioRecordDuration,
  formatDuration,
  formatDurationForAutoreset,
  formatDurationForLocation,
  formatDurationFromNowTo,
  formatDurationShort,
  formatTimeForChat,
  formatTimeForConversationList,
  formatTimeForFS,
  formatTimeForMessages,
  formatTimeForPeopleItem,
  msToDHMS,
} from './timestamp'

// date-fns is an es module namespace so its exports can't be spied on in place;
// wrap format up front instead, still delegating to the real implementation
jest.mock('date-fns', () => {
  const actual = jest.requireActual<typeof dateFns>('date-fns')
  return {...actual, format: jest.fn(actual.format)}
})
const formatCalls = dateFns.format as jest.Mock

const second = 1000
const minute = 60 * second
const hour = 60 * minute
const day = 24 * hour

// the 12h/24h format is machine locale dependent, so assert on shape not exact digits
const timeOnly = /^(\d{1,2}:\d{2}( [AP]M)?)$/

describe('msToDHMS', () => {
  test('breaks a duration into days, hours, minutes and seconds', () => {
    expect(msToDHMS(0)).toBe('0d 0h 0m 0s')
    expect(msToDHMS(second)).toBe('0d 0h 0m 1s')
    expect(msToDHMS(90 * second)).toBe('0d 0h 1m 30s')
    expect(msToDHMS(2 * day + 3 * hour + 4 * minute + 5 * second)).toBe('2d 3h 4m 5s')
  })

  test('clamps negatives to zero', () => {
    expect(msToDHMS(-1)).toBe('0d 0h 0m 0s')
    expect(msToDHMS(-day)).toBe('0d 0h 0m 0s')
  })

  test('truncates sub-second remainders', () => {
    expect(msToDHMS(1999)).toBe('0d 0h 0m 1s')
  })

  test('days are not capped at a week', () => {
    expect(msToDHMS(400 * day)).toBe('400d 0h 0m 0s')
  })
})

describe('formatDurationShort', () => {
  test('picks the largest unit that fits', () => {
    expect(formatDurationShort(0)).toBe('0s')
    expect(formatDurationShort(30 * second)).toBe('30s')
    expect(formatDurationShort(90 * second)).toBe('2m')
    expect(formatDurationShort(90 * minute)).toBe('2h')
    expect(formatDurationShort(36 * hour)).toBe('2d')
  })

  test('clamps negatives', () => {
    expect(formatDurationShort(-5000)).toBe('0s')
  })

  test('the boundaries themselves fall to the smaller unit', () => {
    expect(formatDurationShort(minute)).toBe('60s')
    expect(formatDurationShort(hour)).toBe('60m')
    expect(formatDurationShort(day)).toBe('24h')
  })
})

describe('formatDuration', () => {
  test('is blank for a falsey duration', () => {
    expect(formatDuration(0)).toBe('')
  })

  test('picks the largest unit', () => {
    expect(formatDuration(5 * second)).toBe('5 s')
    expect(formatDuration(5 * minute)).toBe('5 min')
    expect(formatDuration(5 * hour)).toBe('5 hr')
    expect(formatDuration(90 * minute)).toBe('1 hr')
  })

  test('reports whole days past 24h instead of wrapping', () => {
    expect(formatDuration(day)).toBe('1 day')
    expect(formatDuration(25 * hour)).toBe('1 day')
    expect(formatDuration(5 * day)).toBe('5 days')
  })

  test('an elapsed or negative duration is empty', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(-1000)).toBe('')
  })
})

describe('formatDurationFromNowTo', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2020, 0, 15, 16, 34, 0))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('is blank without a target', () => {
    expect(formatDurationFromNowTo()).toBe('')
    expect(formatDurationFromNowTo(0)).toBe('')
  })

  test('formats the remaining time', () => {
    expect(formatDurationFromNowTo(Date.now() + 5 * minute)).toBe('5 min')
  })
})

describe('formatAudioRecordDuration', () => {
  test('formats a span of minutes and seconds', () => {
    expect(formatAudioRecordDuration(30 * second)).toBe('00:30')
    expect(formatAudioRecordDuration(65 * second)).toBe('01:05')
  })

  // a duration is not a wall-clock time; formatting it as a date made it depend on the
  // machine timezone, so 30s read as "30:30" in every half-hour-offset zone (India,
  // Nepal, Adelaide, Newfoundland). jest can't move TZ once the process is up, so the
  // guard is that no date formatting happens at all rather than a second timezone.
  test('never routes a duration through the date formatter', () => {
    formatCalls.mockClear()
    formatAudioRecordDuration(30 * second)
    expect(formatCalls).not.toHaveBeenCalled()
  })

  test('counts past an hour instead of wrapping', () => {
    expect(formatAudioRecordDuration(0)).toBe('00:00')
    expect(formatAudioRecordDuration(90 * minute)).toBe('90:00')
  })

  test('truncates partial seconds and clamps negatives', () => {
    expect(formatAudioRecordDuration(1999)).toBe('00:01')
    expect(formatAudioRecordDuration(-5000)).toBe('00:00')
  })
})

describe('formatDurationForLocation', () => {
  // callers embed this in "updated ${x} ago", so a blank is never a valid answer
  test('says 0s for zero and negative spans', () => {
    expect(formatDurationForLocation(0)).toBe('0s')
    expect(formatDurationForLocation(-second)).toBe('0s')
  })

  test('abbreviates real spans', () => {
    expect(formatDurationForLocation(5 * minute)).toBe('5m')
    expect(formatDurationForLocation(2 * hour)).toBe('2h')
  })
})

describe('formatDurationForAutoreset', () => {
  // "will reset in ${x}." has no sensible empty rendering, so zero reads like a
  // negative rather than blanking the sentence out
  test('is explicit for zero and negatives', () => {
    expect(formatDurationForAutoreset(0)).toBe('no time')
    expect(formatDurationForAutoreset(-1)).toBe('no time')
  })

  test('rounds up so a full week still reads as 7 days', () => {
    expect(formatDurationForAutoreset(7 * day)).toBe('7 days')
    expect(formatDurationForAutoreset(6 * day + 1)).toBe('6 days')
  })

  test('one second is one second, not zero', () => {
    expect(formatDurationForAutoreset(second)).toBe('1 second')
  })
})

describe('formatTimeForConversationList', () => {
  const now = new Date(2020, 5, 15, 16, 34, 0).getTime()

  test('shows just the time for today', () => {
    const time = new Date(2020, 5, 15, 9, 5, 0).getTime()
    expect(formatTimeForConversationList(time, now)).toMatch(timeOnly)
  })

  test('shows the weekday inside the last week', () => {
    expect(formatTimeForConversationList(new Date(2020, 5, 12, 9, 5).getTime(), now)).toBe('Fri')
  })

  test('shows month and day for older times in the same year', () => {
    expect(formatTimeForConversationList(new Date(2020, 1, 3, 9, 5).getTime(), now)).toBe('Feb 3')
  })

  test('shows a two digit year for a different year', () => {
    expect(formatTimeForConversationList(new Date(2019, 11, 25, 9, 5).getTime(), now)).toBe('25 Dec 19')
  })

  test('the week boundary is the start of the day seven days back', () => {
    expect(formatTimeForConversationList(new Date(2020, 5, 8, 0, 0).getTime(), now)).toBe('Jun 8')
    expect(formatTimeForConversationList(new Date(2020, 5, 8, 0, 1).getTime(), now)).toBe('Mon')
  })
})

describe('formatTimeForMessages', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2020, 5, 15, 16, 34, 0))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('labels today and yesterday', () => {
    const today = formatTimeForMessages(new Date(2020, 5, 15, 9, 5).getTime())
    expect(today.startsWith('Today ')).toBe(true)
    expect(today.slice('Today '.length)).toMatch(timeOnly)

    const yesterday = formatTimeForMessages(new Date(2020, 5, 14, 9, 5).getTime())
    expect(yesterday.startsWith('Yesterday ')).toBe(true)
  })

  test('uses the weekday inside the last week', () => {
    expect(formatTimeForMessages(new Date(2020, 5, 11, 9, 5).getTime()).startsWith('Thu ')).toBe(true)
  })

  test('uses month and day within the year and adds the year outside it', () => {
    expect(formatTimeForMessages(new Date(2020, 0, 5, 9, 5).getTime()).startsWith('Jan 05 ')).toBe(true)
    expect(formatTimeForMessages(new Date(2016, 0, 5, 9, 5).getTime()).startsWith('Jan 05 2016 ')).toBe(true)
  })
})

describe('formatTimeForChat', () => {
  // the cache is keyed off "is the cached day still today", so the clock has to be pinned
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2020, 5, 15, 16, 34, 0))
    clearChatTimeCache()
  })
  afterEach(() => {
    clearChatTimeCache()
    jest.useRealTimers()
  })

  test('never emits a breakable space', () => {
    const out = formatTimeForChat(Date.now() - 3 * day)
    expect(out).not.toContain(' ')
    expect(out).toContain('\u00A0')
  })

  test('labels today, yesterday, the last week, the last month and older', () => {
    expect(formatTimeForChat(new Date(2020, 5, 15, 9, 5).getTime())).toMatch(/^\d{1,2}:\d{2}(\u00A0[AP]M)?$/)
    expect(formatTimeForChat(new Date(2020, 5, 14, 9, 5).getTime())).toContain('-\u00A0Yesterday')
    expect(formatTimeForChat(new Date(2020, 5, 11, 9, 5).getTime())).toContain('-\u00A0Thu')
    expect(formatTimeForChat(new Date(2020, 4, 30, 9, 5).getTime())).toContain('-\u00A030\u00A0May')
    expect(formatTimeForChat(new Date(2019, 4, 30, 9, 5).getTime())).toContain('-\u00A030\u00A0May\u00A019')
  })

  test('formats a repeated timestamp only once', () => {
    const t = new Date(2020, 5, 12, 9, 5).getTime()
    const first = formatTimeForChat(t)
    formatCalls.mockClear()

    expect(formatTimeForChat(t)).toBe(first)
    expect(formatCalls).not.toHaveBeenCalled()
  })

  test('still caches after the day rolls over', () => {
    const t = new Date(2020, 5, 12, 9, 5).getTime()
    formatTimeForChat(t)

    // past midnight the cached day is stale, so the next call has to re-arm it
    jest.setSystemTime(new Date(2020, 5, 16, 0, 30, 0))
    const rolled = formatTimeForChat(t)
    formatCalls.mockClear()

    expect(formatTimeForChat(t)).toBe(rolled)
    expect(formatCalls).not.toHaveBeenCalled()
  })

  test('drops stale entries when the day rolls over', () => {
    const yesterdayOnThe15th = new Date(2020, 5, 14, 9, 5).getTime()
    expect(formatTimeForChat(yesterdayOnThe15th)).toContain('-\u00A0Yesterday')

    jest.setSystemTime(new Date(2020, 5, 16, 0, 30, 0))
    expect(formatTimeForChat(yesterdayOnThe15th)).not.toContain('Yesterday')
  })
})

describe('formatTimeForFS', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2020, 5, 15, 16, 34, 0))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('uppercases the first word unless asked not to', () => {
    const t = new Date(2020, 5, 15, 9, 5).getTime()
    expect(formatTimeForFS(t, false).startsWith('Today at ')).toBe(true)
    expect(formatTimeForFS(t, true).startsWith('today at ')).toBe(true)
  })

  test('labels yesterday', () => {
    const t = new Date(2020, 5, 14, 9, 5).getTime()
    expect(formatTimeForFS(t, false).startsWith('Yesterday at ')).toBe(true)
    expect(formatTimeForFS(t, true).startsWith('yesterday at ')).toBe(true)
  })

  test('handles a timestamp in the future rather than throwing', () => {
    const tomorrow = new Date(2020, 5, 16, 9, 5).getTime()
    expect(formatTimeForFS(tomorrow, false).startsWith('Tomorrow at ')).toBe(true)
    expect(formatTimeForFS(tomorrow, true).startsWith('tomorrow at ')).toBe(true)

    const nextWeek = new Date(2020, 5, 19, 9, 5).getTime()
    expect(formatTimeForFS(nextWeek, false).startsWith('Fri at ')).toBe(true)
    expect(formatTimeForFS(nextWeek, true).startsWith('Fri at ')).toBe(true)
  })

  test('falls back to a full date, with the year only outside this year', () => {
    expect(formatTimeForFS(new Date(2020, 0, 5, 9, 5).getTime(), false).startsWith('Sun Jan 5 at ')).toBe(true)
    expect(formatTimeForFS(new Date(2016, 0, 5, 9, 5).getTime(), false).startsWith('Tue Jan 5 2016 at ')).toBe(
      true
    )
  })
})

describe('formatTimeForPeopleItem', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2020, 5, 15, 16, 34, 0))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('a single second ago reads as now', () => {
    expect(formatTimeForPeopleItem(Date.now() - second)).toBe('now')
  })

  test('anything else uses the abbreviated distance', () => {
    expect(formatTimeForPeopleItem(Date.now() - 2 * second)).toBe('2s')
    expect(formatTimeForPeopleItem(Date.now() - 5 * minute)).toBe('5m')
    expect(formatTimeForPeopleItem(Date.now() - 3 * hour)).toBe('3h')
    expect(formatTimeForPeopleItem(Date.now() - 2 * day)).toBe('2d')
    expect(formatTimeForPeopleItem(Date.now() - 400 * day)).toBe('1y')
  })
})
