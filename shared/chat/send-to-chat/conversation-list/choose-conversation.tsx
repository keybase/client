import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as T from '../../../constants/types'
import ConversationList from './conversation-list'

type Props = {
  convName: string
  dropdownButtonStyle?: Styles.StylesCrossPlatform
  onSelect: (conversationIDKey: T.Chat.ConversationIDKey, convName: string) => void
}

const ChooseConversation = (props: Props) => {
  const {onSelect} = props
  const text = !props.convName.length ? 'Choose a conversation' : props.convName

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.Overlay
          attachTo={attachTo}
          onHidden={toggleShowingPopup}
          position="center center"
          style={styles.overlay}
          visible={true}
        >
          <ConversationList onSelect={onSelect} onDone={toggleShowingPopup} />
        </Kb.Overlay>
      )
    },
    [onSelect]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
    }) as const
)
