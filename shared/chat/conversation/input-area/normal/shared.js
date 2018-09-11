// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

const TypingNames = ({typing}: {typing: I.Set<string>}) => {
  const textType = Styles.isMobile ? 'BodyTinySemibold' : 'BodySmallSemibold'
  let names
  switch (typing.size) {
    case 0:
      names = ''
      break
    case 1:
      names = (
        <React.Fragment>
          <Kb.Text key={0} type={textType}>
            {typing.first()}
          </Kb.Text>
          {' is typing'}
        </React.Fragment>
      )
      break
    case 2:
      names = (
        <React.Fragment>
          <Kb.Text key={0} type={textType}>
            {typing.first()}
          </Kb.Text>
          {' and '}
          <Kb.Text key={1} type={textType}>
            {typing.skip(1).first()}
          </Kb.Text>
          {' are typing'}
        </React.Fragment>
      )
      break
    default:
      names = (
        <React.Fragment>
          <Kb.Text key={0} type={textType}>
            {typing.join(', ')}
          </Kb.Text>
          {' are typing'}
        </React.Fragment>
      )
  }
  return names
}

export const IsTyping = ({style, typing}: {style: Styles.StylesCrossPlatform, typing: I.Set<string>}) => (
  <Kb.Box style={Styles.collapseStyles([styles.isTypingContainer, style])}>
    {typing.size > 0 && (
      <Kb.Box style={styles.typingIconContainer}>
        <Kb.Icon type="icon-typing-24" style={Kb.iconCastPlatformStyles(styles.typingIcon)} />
      </Kb.Box>
    )}
    <Kb.Text type={Styles.isMobile ? 'BodyTiny' : 'BodySmall'} style={styles.isTypingText}>
      <TypingNames typing={typing} />
    </Kb.Text>
  </Kb.Box>
)

export const ExplodingMeta = ({
  explodingModeSeconds,
  isNew,
}: {
  explodingModeSeconds: number,
  isNew: boolean,
}) => {
  if (explodingModeSeconds === 0 && !isNew) {
    // nothing to show
    return null
  }
  return (
    <Kb.Meta
      backgroundColor={
        explodingModeSeconds === 0 ? Styles.globalColors.blue : Styles.globalColors.black_75_on_white
      }
      noUppercase={explodingModeSeconds !== 0}
      style={styles.newBadge}
      size="Small"
      title={explodingModeSeconds === 0 ? 'New' : formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

const styles = Styles.styleSheetCreate({
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
  newBadge: Styles.platformStyles({
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
