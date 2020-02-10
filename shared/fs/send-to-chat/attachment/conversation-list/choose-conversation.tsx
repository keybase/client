import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import ConversationList from './conversation-list'

type Props = {
  dropdownButtonStyle?: Styles.StylesCrossPlatform
  onSelect: (conversationIDKey: Types.ConversationIDKey, convName: string) => void
} & Kb.OverlayParentProps

const ChooseConversation = (props: Props) => {
  const sendAttachmentToChat = Container.useSelector(state => state.fs.sendAttachmentToChat)
  const [expanded, setExpanded] = React.useState(false)
  const toggleOpen = () => {
    setExpanded(!expanded)
  }
  const onDone = () => {
    setExpanded(false)
  }
  const text = !sendAttachmentToChat.convName.length ? 'Choose a conversation' : sendAttachmentToChat.convName
  return (
    <>
      <Kb.DropdownButton
        selected={<Kb.Text type="BodySemibold">{text}</Kb.Text>}
        setAttachmentRef={props.setAttachmentRef}
        toggleOpen={toggleOpen}
        style={Styles.collapseStyles([styles.dropdownButton, props.dropdownButtonStyle])}
      />
      <Kb.Overlay
        attachTo={props.getAttachmentRef}
        onHidden={toggleOpen}
        position="center center"
        style={styles.overlay}
        visible={expanded}
      >
        <ConversationList onSelect={props.onSelect} onDone={onDone} />
      </Kb.Overlay>
    </>
  )
}

export default Kb.OverlayParentHOC(ChooseConversation)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      dropdownButton: {
        width: 300,
      },
      overlay: {
        backgroundColor: Styles.globalColors.white,
        height: 360,
        width: 300,
      },
    } as const)
)
