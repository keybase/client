// @flow

import moment from 'moment'

export function formatTimeForConversationList(time: number, nowOverride?: number): string {
  const m = moment(time)
  const now = nowOverride ? moment(nowOverride) : moment()
  const today = now.clone().startOf('day')
  const weekOld = today.clone().subtract(7, 'days')

  if (m.isSame(today, 'd')) {
    return m.format('h:mm A')
  } else if (m.isAfter(weekOld)) {
    return m.format('ddd')
  }

  return m.format('MMM D')
}

export function formatTimeForMessages(time: number, nowOverride?: number): string {
  const m = moment(time)
  const now = nowOverride ? moment(nowOverride) : moment().startOf('day')
  const yesterday = moment().subtract(1, 'days').startOf('day')
  const weekAgo = moment().subtract(7, 'days').startOf('day')

  if (m.isSame(now, 'd')) {
    // Covers interval [startOfToday, endOfToday]
    return m.format('h:mm A') // 4:34 PM
  } else if (m.isSame(yesterday, 'd')) {
    // Covers interval [startOfYesterday, endOfYesterday]
    return 'Yesterday ' + m.format('h:mm A') // Yesterday 4:34 PM
  } else if (m.isAfter(weekAgo)) {
    // Covers interval [startOfWeekAgo, startOfYesterday)
    return m.format('ddd h:mm A') // Wed 4:34 PM
  } else if (!m.isSame(now, 'year')) {
    // Covers interval [foreverAgo, startOfThisYear)
    return m.format('MMM DD YYYY h:mm A') // Jan 5 2016 4:34 PM
  } else {
    // Covers interval [startOfThisYear, startOfWeekAgo)
    return m.format('MMM DD h:mm A') // Jan 5 4:34 PM
  }
}

export function formatTimeForPopup(time: number): string {
  const m = moment(time)
  return m.format('ddd MMM DD h:mm A') // Wed Jan 5 2016 4:34 PM
}

export function formatTimeForRevoked(time: number): string {
  const m = moment(time)
  return m.format('ddd MMM DD') // Wed Jan 5 2016
}
