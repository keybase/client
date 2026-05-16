import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as InputState from '@/chat/conversation/input-area/input-state'
import {useConversationThreadSelector} from '@/chat/conversation/thread-context'

const Names = (props: {names?: ReadonlySet<string>}) => {
  const textType = 'BodyTinySemibold'
  const names = [...(props.names ?? [])]

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

const emptySet = new Set<string>()

const Typing = function Typing() {
  const threadTyping = useConversationThreadSelector(s => (s.typing.size === 0 ? emptySet : s.typing))
  const {showCommandMarkdown, showGiphySearch} = InputState.useConversationInput(
    C.useShallow(s => ({
      showCommandMarkdown: !!s.commandMarkdown,
      showGiphySearch: s.giphyWindow,
    }))
  )
  const showTypingStatus = !C.isMobile || (!showGiphySearch && !showCommandMarkdown)
  const names = showTypingStatus ? threadTyping : emptySet
  return (
    <Kb.Box2 direction="horizontal" style={styles.isTypingContainer}>
      {names.size > 0 && (
        <Kb.Box2 direction="vertical" style={styles.typingIconContainer}>
          <Kb.Animation animationType="typing" containerStyle={styles.isTypingAnimation} />
        </Kb.Box2>
      )}
      {names.size > 0 && (
        <Kb.Text lineClamp={1} type="BodyTiny" style={styles.isTypingText}>
          <Names names={names} />
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

export const mobileTypingContainerHeight = 18
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      isTypingAnimation: Kb.Styles.platformStyles({
        isMobile: {
          height: 16,
          width: 16,
        },
      }),
      isTypingContainer: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          opacity: 1,
        },
        isElectron: {
          alignItems: 'center',
          height: 16,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginTop: 2,
          minWidth: 0,
          paddingLeft: 24,
        },
        isMobile: {
          alignItems: 'flex-end',
          backgroundColor: Kb.Styles.globalColors.white,
          height: mobileTypingContainerHeight,
          left: Kb.Styles.globalMargins.xtiny,
          position: 'absolute',
          top: -mobileTypingContainerHeight / 2 - 2,
          zIndex: 999,
        },
      }),
      isTypingText: Kb.Styles.platformStyles({
        isElectron: {
          flexGrow: 1,
          marginLeft: 16,
          minWidth: 0,
          textAlign: 'left',
        },
        isMobile: {
          marginRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      typingIconContainer: Kb.Styles.platformStyles({
        isMobile: {
          alignItems: 'center',
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)
export default Typing
