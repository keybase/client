// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as Styles from '../../../../../styles'
import EmojiRow from '.'

const actions = {
  onReact: Sb.action('onReact'),
  onShowPicker: Sb.action('onShowPicker'),
}

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
      <EmojiRow
        {...actions}
        attachTo={props.getAttachmentRef}
        style={{marginRight: 100, marginTop: -4}}
        visible={props.showingMenu}
      />
    </Kb.Box2>
  </>
)
const FakeMessage = Kb.OverlayParentHOC(_FakeMessage)

const load = () =>
  Sb.storiesOf('Chat/Conversation/Emoji row')
    .add('On hover', () => <FakeMessage />)
    .add('Visible', () => <EmojiRow {...actions} attachTo={() => null} onHidden={() => {}} visible={true} />)

export default load
