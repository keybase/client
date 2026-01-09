import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'

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

const Typing = React.memo(function Typing() {
  const names = Chat.useChatContext(
    C.useShallow(s => {
      const names = s.typing
      if (!C.isMobile) return names
      const showCommandMarkdown = !!s.commandMarkdown
      const showGiphySearch = s.giphyWindow
      const showTypingStatus = !showGiphySearch && !showCommandMarkdown
      return showTypingStatus ? names : emptySet
    })
  )
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
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      isTypingAnimation: Kb.Styles.platformStyles({
        isElectron: {
          left: 24,
          position: 'absolute',
        },
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
        isMobile: {
          ...Kb.Styles.globalStyles.flexBoxRow,
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
          left: 56,
          marginTop: 2,
          position: 'absolute',
          textAlign: 'left',
        },
        isMobile: {
          marginRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      typingIcon: Kb.Styles.platformStyles({
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
