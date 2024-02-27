import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {HighlightedContext, OrdinalContext} from '../ids-context'

export const useEdited = () => {
  const ordinal = React.useContext(OrdinalContext)
  const hasBeenEdited = C.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    const hasBeenEdited = message?.hasBeenEdited ?? false
    return hasBeenEdited
  })

  const showCenteredHighlight = React.useContext(HighlightedContext)
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
