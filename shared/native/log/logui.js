/* @flow */

import type {Text as KBText, LogLevel} from '../../constants/types/flow-types'
import {CommonLogLevel} from '../../constants/types/flow-types'
import {NotifyPopup} from '../../native/notifications'

export function log ({text, level}: {text: KBText, level: LogLevel}): void {
  console.log('keybase.1.logUi.log:', text.data)
  if (level >= CommonLogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
