import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/chat2'
import ConversationList from './conversation-list'

type Props = {
  convName: string
  dropdownButtonStyle?: Styles.StylesCrossPlatform
  onSelect: (conversationIDKey: Types.ConversationIDKey, convName: string) => void
}

const ChooseConversation = (props: Props) => {
  const text = !props.convName.length ? 'Choose a conversation' : props.convName

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.Overlay
      attachTo={attachTo}
      onHidden={toggleShowingPopup}
      position="center center"
      style={styles.overlay}
      visible={showingPopup}
    >
      <ConversationList onSelect={props.onSelect} onDone={toggleShowingPopup} />
    </Kb.Overlay>
  ))

  return (
    <>
      <Kb.DropdownButton
        selected={
          <Kb.Text type="BodySemibold" style={styles.selectedText}>
            {text}
          </Kb.Text>
        }
        popupAnchor={popupAnchor}
        toggleOpen={toggleShowingPopup}
        style={Styles.collapseStyles([styles.dropdownButton, props.dropdownButtonStyle])}
      />
      {popup}
    </>
  )
}

export default ChooseConversation

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
      selectedText: {
        paddingLeft: Styles.globalMargins.xsmall,
        width: '100%',
      },
    } as const)
)
