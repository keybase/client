// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Types from '../../../../../constants/types/chat2'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

const Names = ({names}: {names: I.Set<string>}) => {
  const textType = Styles.isMobile ? 'BodyTinySemibold' : 'BodySmallSemibold'
  let ret
  switch (names.size) {
    case 0:
      ret = ''
      break
    case 1:
      ret = (
        <>
          <Kb.Text key={0} type={textType}>
            {names.first()}
          </Kb.Text>
          {' is typing'}
        </>
      )
      break
    case 2:
      ret = (
        <>
          <Kb.Text key={0} type={textType}>
            {names.first()}
          </Kb.Text>
          {' and '}
          <Kb.Text key={1} type={textType}>
            {names.skip(1).first()}
          </Kb.Text>
          {' are typing'}
        </>
      )
      break
    case 3:
      ret = (
        <>
          <Kb.Text key={0} type={textType}>
            {names.first()}
          </Kb.Text>
          {', '}
          <Kb.Text key={1} type={textType}>
            {names.skip(1).first()}
          </Kb.Text>
          {', and '}
          <Kb.Text key={1} type={textType}>
            {names.skip(2).first()}
          </Kb.Text>
          {' are typing'}
        </>
      )
      break
    default:
      ret = 'multiple people are typing'
  }
  return ret
}

type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  names: I.Set<string>,
|}

export const Typing = (props: Props) => (
  <Kb.Box
    style={Styles.collapseStyles([
      styles.isTypingContainer,
      props.names.size > 0 && styles.isTypingContainerVisible,
    ])}
  >
    <Kb.Box style={styles.typingIconContainer}>
      <Kb.Animation animationType="typing" containerStyle={styles.isTypingAnimation} />
    </Kb.Box>
    <Kb.Text type={Styles.isMobile ? 'BodyTiny' : 'BodySmall'} style={styles.isTypingText}>
      <Names names={props.names} />
    </Kb.Text>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
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
      opacity: 0,
    },
    isMobile: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'flex-end',
      bottom: 2,
      height: 16,
      left: 3,
      position: 'relative',
    },
  }),
  isTypingContainerVisible: {
    opacity: 1,
  },
  isTypingText: Styles.platformStyles({
    isElectron: {
      flexGrow: 1,
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: 56,
      textAlign: 'left',
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
      width: 45,
    },
  }),
})
