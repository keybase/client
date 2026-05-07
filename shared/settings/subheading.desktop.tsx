import * as Kb from '@/common-adapters'

import type {Props} from './subheading'

function SubHeading({children}: Props) {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={{marginBottom: 2}}>
      <Kb.Text
        style={{color: Kb.Styles.globalColors.black_50, marginBottom: Kb.Styles.globalMargins.xtiny}}
        type="BodySmallSemibold"
      >
        {children}
      </Kb.Text>
    </Kb.Box2>
  )
}

export default SubHeading
