/* @flow */

import type {Text as KBText, LogLevel} from '../../constants/types/flow-types'
import {Common} from '../../constants/types/keybase-v1'
import {NotifyPopup} from '../../native/notifications'

export function log ({text, level}: {text: KBText, level: LogLevel}): void {
  console.log('keybase.1.logUi.log:', text.data)
  if (level >= Common.LogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
