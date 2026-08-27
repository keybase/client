/// <reference types="jest" />
import {
  clearChatTimeCache,
  formatDuration,
  formatDurationForAutoreset,
  formatDurationFromNowTo,
  formatDurationShort,
  formatTimeForChat,
  formatTimeForConversationList,
  formatTimeForMessages,
  msToDHMS,
} from './timestamp'

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

describe('formatDurationForAutoreset', () => {
  test('is blank for zero and explicit for negatives', () => {
    expect(formatDurationForAutoreset(0)).toBe('')
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
  beforeEach(() => {
    clearChatTimeCache()
  })
  afterEach(() => {
    clearChatTimeCache()
  })

  test('never emits a breakable space', () => {
    const out = formatTimeForChat(Date.now() - 3 * day)
    expect(out).not.toContain(' ')
    expect(out).toContain(' ')
  })

  test('labels yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(9, 5, 0, 0)
    expect(formatTimeForChat(yesterday.getTime())).toContain('- Yesterday')
  })

  test('returns the cached string for a repeated timestamp', () => {
    const t = Date.now() - 3 * day
    const first = formatTimeForChat(t)
    expect(formatTimeForChat(t)).toBe(first)
  })
})
