'use strict'

import * as native from './platform.native'
import * as shared from './platform.shared'

export default {
  ...native,
  ...shared
}
