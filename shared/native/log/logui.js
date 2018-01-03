// @flow
import logger from '../../logger'
import {commonLogLevel} from '../../constants/types/rpc-gen'
import {NotifyPopup} from '../../native/notifications'

import type {Text as KBText, LogLevel} from '../../constants/types/rpc-gen'

export function log({text, level}: $ReadOnly<{text: KBText, level: LogLevel}>): void {
  logger.info('keybase.1.logUi.log:', text.data)
  if (level >= commonLogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
