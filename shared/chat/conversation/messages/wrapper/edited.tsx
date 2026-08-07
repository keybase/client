import * as Kb from '@/common-adapters'
import {useIsHighlighted} from '../ids-context'

export const useEdited = (hasBeenEdited: boolean) => {
  const styles = useStyles()
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

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      edited: {color: theme.black_20},
      editedHighlighted: {color: theme.black_20OrBlack},
    }) as const
)
