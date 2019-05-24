// @flow
import logger from '../../logger'
import {LogLevel} from '../../constants/types/rpc-gen'
import {NotifyPopup} from '../../native/notifications'

import type {Text as KBText} from '../../constants/types/rpc-gen'

export function log({text, level}: $ReadOnly<{text: KBText, level: LogLevel}>): void {
  logger.info('keybase.1.logUi.log:', text.data)
  if (level >= LogLevel.error) {
    NotifyPopup(text.data, {})
  }
}
