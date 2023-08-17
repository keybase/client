import * as C from '../../../../constants'
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
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
      >
        EDITED
      </Kb.Text>
    ) : null
  }, [showCenteredHighlight, hasBeenEdited])

  return edited
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      edited: {color: Styles.globalColors.black_20},
      editedHighlighted: {color: Styles.globalColors.black_20OrBlack},
    }) as const
)
