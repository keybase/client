// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Props = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  style?: Styles.StylesCrossPlatform,
  visible: boolean,
}

const EmojiRow = (props: Props) => (
  <>
    <Kb.Overlay
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position="bottom right"
      style={props.style}
      visible={props.visible}
    >
      <Kb.Text type="BodySemibold">Peekaboo!</Kb.Text>
    </Kb.Overlay>
  </>
)

export default EmojiRow
