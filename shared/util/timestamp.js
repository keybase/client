// @flow

import moment from 'moment'

export function formatTimeForConversationList(
  time: number,
  nowOverride?: number
): string {
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

export function formatTimeForMessages(
  time: number,
  nowOverride?: number
): string {
  const m = moment(time)
  const now = nowOverride ? moment(nowOverride) : moment()

  if (now.diff(m, 'months') > 6) {
    return m.format('MMM DD YYYY h:mm A') // Jan 5 2016 4:34 PM
  } else if (now.diff(m, 'days') > 6) {
    return m.format('MMM DD h:mm A') // Jan 5 4:34 PM
  } else if (now.diff(m, 'hours') > 22) {
    return m.format('ddd h:mm A') // Wed 4:34 PM
  } else {
    return m.format('h:mm A') // 4:34 PM
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
