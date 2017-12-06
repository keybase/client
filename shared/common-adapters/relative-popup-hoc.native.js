// @flow

import type {RelativePopupHocType} from './relative-popup-hoc'

// Does nothing
const RelativePopupHoc: RelativePopupHocType<*> = PopupComponent => {
  return PopupComponent
}

export default RelativePopupHoc
