// @flow
import * as Kb from '../../../common-adapters/'
import * as Styles from '../../../styles'
import type {Props} from '.'

const emphasize = Styles.styledKeyframes({
  from: {transform: 'scale(1)'},
  to: {transform: 'scale(1.05)'},
})

const EmphasisBox = Styles.styled(Kb.Box2)((props: Props) =>
  props.emphasize ? {animation: `${emphasize} 500ms ease-in-out infinite alternate`} : null
)

export default EmphasisBox
