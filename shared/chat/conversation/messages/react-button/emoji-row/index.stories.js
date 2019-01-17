// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as Styles from '../../../../../styles'
import EmojiRow from '.'

const _FakeMessage = (props: Kb.OverlayParentProps) => (
  <>
    <Kb.Box2
      direction="horizontal"
      style={{backgroundColor: 'pink', padding: 4, width: 500}}
      onMouseOver={() => props.setShowingMenu(true)}
      onMouseLeave={() => props.setShowingMenu(false)}
      ref={props.setAttachmentRef}
    >
      <Kb.Text type="HeaderExtrabold" style={{...Styles.globalStyles.italic}}>
        1-800-FAKEMESSAGE
      </Kb.Text>
    </Kb.Box2>
    <EmojiRow
      attachTo={props.getAttachmentRef}
      onHidden={() => props.setShowingMenu(false)}
      style={{backgroundColor: Styles.globalColors.white, position: 'relative', right: 100, top: -4}}
      visible={props.showingMenu}
    />
  </>
)
const FakeMessage = Kb.OverlayParentHOC(_FakeMessage)

const load = () => Sb.storiesOf('Chat/Conversation/Emoji row').add('Basic', () => <FakeMessage />)

export default load
