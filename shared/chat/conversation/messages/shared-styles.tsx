import * as Styles from '../../../styles'

const editing = {
  backgroundColor: Styles.globalColors.yellowLight,
  borderRadius: 2,
  color: Styles.globalColors.blackOrBlack,
  paddingLeft: Styles.globalMargins.tiny,
  paddingRight: Styles.globalMargins.tiny,
}
const sent = Styles.platformStyles({
  isElectron: {
    // Make text selectable. On mobile we implement that differently.
    cursor: 'text',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    width: '100%',
    wordBreak: 'break-word',
  } as const,
  isMobile: {
    ...Styles.globalStyles.flexBoxColumn,
  },
})
const sentEditing = {
  ...sent,
  ...editing,
}
const pendingFail = {
  ...sent,
}
const pendingFailEditing = {
  ...pendingFail,
  ...editing,
}
export const sharedStyles = Styles.styleSheetCreate(
  () =>
    ({
      editing,
      highlighted: {
        color: Styles.globalColors.blackOrBlack,
      },
      pendingFail,
      pendingFailEditing,
      sent,
      sentEditing,
    } as const)
)
