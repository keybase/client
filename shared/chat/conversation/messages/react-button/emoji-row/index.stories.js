// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as Styles from '../../../../../styles'
import EmojiRow from '.'

const _FakeMessage = (props: Kb.OverlayParentProps & {keepVisible?: boolean}) => (
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
      <EmojiRow
        attachTo={props.getAttachmentRef}
        onHidden={() => props.setShowingMenu(false)}
        onOpenEmojiPicker={Sb.action('onOpenEmojiPicker')}
        onReact={Sb.action('onReact')}
        style={{marginRight: 100, marginTop: -4}}
        visible={props.keepVisible || props.showingMenu}
      />
    </Kb.Box2>
  </>
)
const FakeMessage = Kb.OverlayParentHOC(_FakeMessage)

const load = () =>
  Sb.storiesOf('Chat/Conversation/Emoji row')
    .add('On hover', () => <FakeMessage />)
    .add('Visible', () => <FakeMessage keepVisible={true} />)

export default load
