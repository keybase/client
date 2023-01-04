import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import type * as Types from '../../../../../constants/types/chat2'

type Props = {
  conversationIDKey: Types.ConversationIDKey
}

const Names = (props: {names: Set<string>}) => {
  const textType = 'BodyTinySemibold'
  const names = [...props.names]

  switch (names.length) {
    case 0:
      return <></>
    case 1:
      return (
        <>
          <Kb.Text type={textType}>{names[0]}</Kb.Text>
          {' is typing'}
        </>
      )
    case 2:
      return (
        <>
          <Kb.Text type={textType}>{names[0]}</Kb.Text>
          {' and '}
          <Kb.Text type={textType}>{names[1]}</Kb.Text>
          {' are typing'}
        </>
      )
    case 3:
      return (
        <>
          <Kb.Text type={textType}>{names[0]}</Kb.Text>
          {', '}
          <Kb.Text type={textType}>{names[1]}</Kb.Text>
          {', and '}
          <Kb.Text type={textType}>{names[2]}</Kb.Text>
          {' are typing'}
        </>
      )
    default:
      return <>multiple people are typing</>
  }
}

const Typing = React.memo(function Typing(props: Props) {
  const {conversationIDKey} = props
  const names = Container.useSelector(state => Constants.getTyping(state, conversationIDKey))
  return (
    <Kb.Box style={styles.isTypingContainer}>
      {names.size > 0 && (
        <Kb.Box style={styles.typingIconContainer}>
          <Kb.Animation animationType="typing" containerStyle={styles.isTypingAnimation} />
        </Kb.Box>
      )}
      {names.size > 0 && (
        <Kb.Text lineClamp={1} type="BodyTiny" style={styles.isTypingText}>
          <Names names={names} />
        </Kb.Text>
      )}
    </Kb.Box>
  )
})

export const mobileTypingContainerHeight = 18
const styles = Styles.styleSheetCreate(
  () =>
    ({
      isTypingAnimation: Styles.platformStyles({
        isElectron: {
          left: 24,
          position: 'absolute',
        },
        isMobile: {
          height: 16,
          width: 16,
        },
      }),
      isTypingContainer: Styles.platformStyles({
        common: {
          flexGrow: 1,
          opacity: 1,
        },
        isMobile: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'flex-end',
          backgroundColor: Styles.globalColors.white,
          height: mobileTypingContainerHeight,
          left: Styles.globalMargins.xtiny,
          position: 'absolute',
          top: -mobileTypingContainerHeight / 2 - 2,
          zIndex: 999,
        },
      }),
      isTypingText: Styles.platformStyles({
        isElectron: {
          flexGrow: 1,
          left: 56,
          marginTop: 2,
          position: 'absolute',
          textAlign: 'left',
        },
        isMobile: {
          marginRight: Styles.globalMargins.tiny,
        },
      }),
      typingIcon: Styles.platformStyles({
        common: {
          position: 'absolute',
          width: 24,
        },
        isElectron: {
          bottom: 7,
          left: 21,
        },
        isMobile: {
          bottom: 0,
        },
      }),
      typingIconContainer: Styles.platformStyles({
        isMobile: {
          alignItems: 'center',
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)
export default Typing
