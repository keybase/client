import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

const Names = ({names}: {names: I.Set<string>}) => {
  const textType = 'BodyTinySemibold'
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

type Props = {
  names: I.Set<string>
}

export const Typing = (props: Props) => (
  <Kb.Box style={styles.isTypingContainer}>
    {props.names.size > 0 && (
      <Kb.Box style={styles.typingIconContainer}>
        <Kb.Animation animationType="typing" containerStyle={styles.isTypingAnimation} />
      </Kb.Box>
    )}
    {props.names.size > 0 && (
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.isTypingText}>
        <Names names={props.names} />
      </Kb.Text>
    )}
  </Kb.Box>
)

export const mobileTypingContainerHeight = 18
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
})
