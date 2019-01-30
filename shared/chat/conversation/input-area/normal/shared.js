// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => {
  if (explodingModeSeconds === 0) {
    // nothing to show
    return null
  }
  return (
    <Kb.Meta
      backgroundColor={Styles.globalColors.black_75_on_white}
      noUppercase={true}
      style={styles.timeBadge}
      size="Small"
      title={formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

const TypingNames = ({typing}: {typing: I.Set<string>}) => {
  const textType = Styles.isMobile ? 'BodyTinySemibold' : 'BodySmallSemibold'
  let names
  switch (typing.size) {
    case 0:
      names = ''
      break
    case 1:
      names = (
        <>
          <Kb.Text key={0} type={textType}>
            {typing.first()}
          </Kb.Text>
          {' is typing'}
        </>
      )
      break
    case 2:
      names = (
        <>
          <Kb.Text key={0} type={textType}>
            {typing.first()}
          </Kb.Text>
          {' and '}
          <Kb.Text key={1} type={textType}>
            {typing.skip(1).first()}
          </Kb.Text>
          {' are typing'}
        </>
      )
      break
    default:
      names = (
        <>
          <Kb.Text key={0} type={textType}>
            {typing.join(', ')}
          </Kb.Text>
          {' are typing'}
        </>
      )
  }
  return names
}

export const IsTyping = ({style, typing}: {style?: Styles.StylesCrossPlatform, typing: I.Set<string>}) => (
  <Kb.Box style={Styles.collapseStyles([styles.isTypingContainer, style])}>
    {typing.size > 0 && (
      <Kb.Box style={styles.typingIconContainer}>
        <Kb.Animation animationType="typing" containerStyle={styles.isTypingAnimation} />
      </Kb.Box>
    )}
    <Kb.Text type={Styles.isMobile ? 'BodyTiny' : 'BodySmall'} style={styles.isTypingText}>
      <TypingNames typing={typing} />
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
    isMobile: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'flex-end',
    },
  }),
  isTypingText: Styles.platformStyles({
    isElectron: {
      flexGrow: 1,
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: 56,
      textAlign: 'left',
    },
  }),
  timeBadge: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.white,
      borderRadius: 3,
      borderStyle: 'solid',
      paddingBottom: 1,
      paddingTop: 1,
    },
    isElectron: {
      borderWidth: 1,
      cursor: 'pointer',
      marginLeft: -11,
      marginTop: -6,
    },
    isMobile: {
      borderWidth: 2,
      height: 18,
      marginLeft: -5,
      marginTop: -1,
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
