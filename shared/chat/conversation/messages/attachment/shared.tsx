import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import * as Styles from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  transferState: Types.MessageAttachmentTransferState
}

export const ShowToastAfterSaving = isMobile
  ? ({transferState}: Props) => {
      const [showingToast, setShowingToast] = React.useState(false)
      const [wasSaving, setWasSaving] = React.useState(false)
      const setShowingToastFalseLater = Kb.useTimeout(() => setShowingToast(false), 1500)
      React.useEffect(() => {
        transferState === 'mobileSaving' && setWasSaving(true)
      }, [transferState])
      React.useEffect(() => {
        if (wasSaving && !transferState) {
          setWasSaving(false)
          setShowingToast(true)
          setShowingToastFalseLater()
        }
      }, [wasSaving, transferState, setShowingToast, setShowingToastFalseLater])
      return showingToast ? (
        <Kb.SimpleToast iconType="iconfont-check" text="Saved" visible={showingToast} />
      ) : null
    }
  : () => null

export const GetEditStyle = (isEditing: boolean, isHighlighted?: boolean) => {
  if (isHighlighted) {
    return Styles.collapseStyles([styles.sent, styles.highlighted])
  }
  return isEditing ? styles.sentEditing : styles.sent
}

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
const styles = Styles.styleSheetCreate(
  () =>
    ({
      editing,
      highlighted: {
        color: Styles.globalColors.blackOrBlack,
      },
      sent,
      sentEditing,
    } as const)
)
