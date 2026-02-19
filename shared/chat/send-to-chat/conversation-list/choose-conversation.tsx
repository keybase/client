import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import ConversationList from './conversation-list'

type Props = {
  convName: string
  dropdownButtonStyle?: Kb.Styles.StylesCrossPlatform
  onSelect: (conversationIDKey: T.Chat.ConversationIDKey, convName: string) => void
}

const ChooseConversation = (props: Props) => {
  const {onSelect} = props
  const text = !props.convName.length ? 'Choose a conversation' : props.convName

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.Overlay
          attachTo={attachTo}
          onHidden={hidePopup}
          position="center center"
          style={styles.overlay}
          visible={true}
        >
          <ConversationList onSelect={onSelect} onDone={hidePopup} />
        </Kb.Overlay>
      )
    },
    [onSelect]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <>
      <Kb.DropdownButton
        selected={
          <Kb.Text type="BodySemibold" style={styles.selectedText}>
            {text}
          </Kb.Text>
        }
        popupAnchor={popupAnchor}
        toggleOpen={showPopup}
        style={Kb.Styles.collapseStyles([styles.dropdownButton, props.dropdownButtonStyle])}
      />
      {popup}
    </>
  )
}

export default ChooseConversation

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      dropdownButton: {width: 300},
      overlay: {
        backgroundColor: Kb.Styles.globalColors.white,
        height: 360,
        width: 300,
      },
      selectedText: {
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        width: '100%',
      },
    }) as const
)
