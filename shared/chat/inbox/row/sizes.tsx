// In order for the inbox rows to be calculated quickly we use fixed sizes for each type so
// in order for the list and the rows to ensure they're the same size we keep the sizes here
import * as Kb from '@/common-adapters'
import type {ChatInboxRowType} from '../rowitem'

export const smallRowHeight = Kb.Styles.isMobile ? 64 : 56
export const bigRowHeight = Kb.Styles.isMobile ? 40 : 24
export const bigHeaderHeight = 32
export const floatingDivider = Kb.Styles.isMobile ? 48 : 40
export const inboxWidth = Kb.Styles.globalStyles.mediumSubNavWidth

export const dividerHeight = (showingButton: boolean) => {
  if (Kb.Styles.isMobile) {
    return showingButton ? 68 : 44
  } else {
    return showingButton ? 84 : 41
  }
}

export const getRowHeight = (type: ChatInboxRowType, showingDividerButton: boolean) => {
  const exhaustive = (type: ChatInboxRowType, showingDividerButton: boolean) => {
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
      default:
        return 92
    }
  }
  return exhaustive(type, showingDividerButton)
}
