import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useIsHighlighted, useOrdinal} from '../ids-context'

export const useEdited = () => {
  const ordinal = useOrdinal()
  const hasBeenEdited = Chat.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    const hasBeenEdited = message?.hasBeenEdited ?? false
    return hasBeenEdited
  })

  const showCenteredHighlight = useIsHighlighted()
  const edited = React.useMemo(() => {
    return hasBeenEdited ? (
      <Kb.Text
        key="isEdited"
        type="BodyTiny"
        fixOverdraw={!showCenteredHighlight}
        style={showCenteredHighlight ? styles.editedHighlighted : styles.edited}
        virtualText={true}
      >
        EDITED
      </Kb.Text>
    ) : null
  }, [showCenteredHighlight, hasBeenEdited])

  return edited
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      edited: {color: Kb.Styles.globalColors.black_20},
      editedHighlighted: {color: Kb.Styles.globalColors.black_20OrBlack},
    }) as const
)
