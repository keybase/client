import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
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
