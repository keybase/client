import * as Kb from '@/common-adapters'
import {useIsHighlighted} from '../ids-context'

export const useEdited = (hasBeenEdited: boolean) => {
  const showCenteredHighlight = useIsHighlighted()
  return hasBeenEdited ? (
    <Kb.Text
      key="isEdited"
      type="BodyTiny"
      style={showCenteredHighlight ? styles.editedHighlighted : styles.edited}
      virtualText={true}
    >
      EDITED
    </Kb.Text>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      edited: {color: Kb.Styles.globalColors.black_20},
      editedHighlighted: {color: Kb.Styles.globalColors.black_20OrBlack},
    }) as const
)
