// @flow
import logger from '../../logger'
import {commonLogLevel} from '../../constants/types/flow-types'
import {NotifyPopup} from '../../native/notifications'

import type {Text as KBText, LogLevel} from '../../constants/types/flow-types'

export function log({text, level}: {text: KBText, level: LogLevel}): void {
  logger.info('keybase.1.logUi.log:', text.data)
  if (level >= commonLogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
