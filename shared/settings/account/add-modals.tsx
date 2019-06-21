import AddEmail from '../../signup/email/container'
import AddPhone from '../../signup/phone-number/container'
import {Props as HeaderHocProps} from '../../common-adapters/header-hoc/types'
import * as Kb from '../../common-adapters'

export const Email = Kb.HeaderOrPopup(AddEmail)
export const Phone = Kb.HeaderOrPopup(AddPhone)
