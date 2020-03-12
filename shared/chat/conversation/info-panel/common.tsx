import {imgMaxWidthRaw} from '../messages/attachment/image/image-render'
import * as Styles from '../../../styles'

export const infoPanelWidthElectron = 320
export const infoPanelWidthPhone = imgMaxWidthRaw()
export const infoPanelWidthTablet = 350

export function infoPanelWidth() {
  if (Styles.isTablet) {
    return infoPanelWidthTablet
  } else if (Styles.isMobile) {
    return infoPanelWidthPhone
  } else {
    return infoPanelWidthElectron
  }
}
