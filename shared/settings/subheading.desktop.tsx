import * as Kb from '@/common-adapters'

import type {Props} from './subheading'

function SubHeading({children}: Props) {
  return (
    <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, marginBottom: 2}}>
      <Kb.Text
        style={{color: Kb.Styles.globalColors.black_50, marginBottom: Kb.Styles.globalMargins.xtiny}}
        type="BodySmallSemibold"
      >
        {children}
      </Kb.Text>
    </Kb.Box>
  )
}

export default SubHeading
