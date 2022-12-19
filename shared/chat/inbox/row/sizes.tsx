// In order for the inbox rows to be calculated quickly we use fixed sizes for each type so
// in order for the list and the rows to ensure they're the same size we keep the sizes here
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/chat2'

export const smallRowHeight = Styles.isMobile ? 64 : 56
export const bigRowHeight = Styles.isMobile ? 40 : 24
export const bigHeaderHeight = 32
export const floatingDivider = Styles.isMobile ? 48 : 40
export const inboxWidth = Styles.globalStyles.mediumSubNavWidth

export const dividerHeight = (showingButton: boolean) => {
  if (Styles.isMobile) {
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
