// In order for the inbox rows to be calculated quickly we use fixed sizes for each type so
// in order for the list and the rows to ensure they're the same size we keep the sizes here
import {isMobile} from '../../../styles'
import * as Types from '../../../constants/types/chat2'

export const smallRowHeight = isMobile ? 64 : 56
export const bigRowHeight = isMobile ? 40 : 24
export const bigHeaderHeight = 32
export const floatingDivider = isMobile ? 48 : 40
export const inboxWidth = 260

export const dividerHeight = (showingButton: boolean) => {
  if (isMobile) {
    return showingButton ? 68 : 44
  } else {
    return showingButton ? 84 : 41
  }
}

export const getRowHeight = (type: Types.ChatInboxRowType, showingDividerButton: boolean) => {
  const exhaustive = (type: Types.ChatInboxRowType, showingDividerButton: boolean) => {
    switch (type) {
      case 'bigTeamsLabel':
        return bigHeaderHeight
      case 'bigHeader':
        return bigHeaderHeight
      case 'big':
        return bigRowHeight
      case 'small':
        return smallRowHeight
      case 'divider':
        return dividerHeight(showingDividerButton)
      case 'teamBuilder':
        return 0
    }
  }
  return exhaustive(type, showingDividerButton) ?? 0
}
