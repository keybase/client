// In order for the inbox rows to be calculated quickly we use fixed sizes for each type so
// in order for the list and the rows to ensure they're the same size we keep the sizes here
import {isMobile} from '../../../styles'

export const smallRowHeight = isMobile ? 64 : 56
export const bigRowHeight = isMobile ? 40 : 24
export const bigHeaderHeight = 32
export const floatingDivider = isMobile ? 48 : 40
export const inboxWidth = 260

export const dividerHeight = (showingButton: boolean) => {
  if (isMobile) {
    return showingButton ? 68 : 44
  } else {
    return showingButton ? 68 : 41
  }
}

export const getRowHeight = (type: string, showingDividerButton: boolean) => {
  if (type === 'bigTeamsLabel') {
    return bigHeaderHeight
  }
  switch (type) {
    case 'bigHeader':
      return bigHeaderHeight
    case 'big':
      return bigRowHeight
    case 'small':
      return smallRowHeight
    case 'divider':
      return dividerHeight(showingDividerButton)
  }
  return 0
}
