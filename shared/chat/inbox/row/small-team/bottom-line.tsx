import React, {PureComponent} from 'react'
import {Text, Markdown, Box, Box2, Meta, Icon} from '../../../../common-adapters'
import {AllowedColors} from '../../../../common-adapters/text'
import {
  globalStyles,
  globalColors,
  globalMargins,
  styleSheetCreate,
  collapseStyles,
  platformStyles,
} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  backgroundColor?: string
  participantNeedToRekey: boolean
  showBold: boolean
  snippet: string | null
  snippetDecoration: string | null
  subColor: AllowedColors
  youNeedToRekey: boolean
  youAreReset: boolean
  hasResetUsers: boolean
  isSelected: boolean
  isDecryptingSnippet: boolean
  isTypingSnippet: boolean
  draft?: string
}

class BottomLine extends PureComponent<Props> {
  render() {
    let content
    const style = collapseStyles([
      styles.bottomLine,
      {
        color: this.props.subColor,
        ...(this.props.showBold ? globalStyles.fontBold : {}),
      },
      this.props.isTypingSnippet ? styles.typingSnippet : null,
    ])
    if (this.props.youNeedToRekey) {
      content = null
    } else if (this.props.youAreReset) {
      content = (
        <Text
          type="BodySmallSemibold"
          negative={true}
          style={collapseStyles([
            styles.youAreResetText,
            {
              color: this.props.isSelected ? globalColors.white : globalColors.red,
            },
          ])}
        >
          You are locked out.
        </Text>
      )
    } else if (this.props.participantNeedToRekey) {
      content = (
        <Text type="BodySmall" negative={true} style={{color: this.props.subColor}}>
          Waiting for participants to rekey...
        </Text>
      )
    } else if (this.props.draft) {
      content = (
        <Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
          <Text
            type="BodySmall"
            style={collapseStyles([
              styles.draftLabel,
              this.props.isSelected ? {color: globalColors.white} : null,
            ])}
          >
            Draft:
          </Text>
          <Markdown preview={true} style={style}>
            {this.props.draft}
          </Markdown>
        </Box2>
      )
    } else if (this.props.isDecryptingSnippet) {
      content = <Meta title="decrypting..." style={styles.alertMeta} backgroundColor={globalColors.blue} />
    } else if (this.props.snippet) {
      let snippetDecoration
      let exploded = false

      // `snippetDecoration` will either be an explosion emoji, bomb emoji, or empty string.
      // We want to use these emojis to render the correct custom icon.
      switch (this.props.snippetDecoration) {
        case '\u{1F4A5}': // Explosion (Collision) emoji (💥)
          snippetDecoration = (
            <Text
              type="BodySmall"
              style={{color: this.props.isSelected ? globalColors.white : globalColors.black_50}}
            >
              Message exploded.
            </Text>
          )
          exploded = true
          break
        case '\u{1F4A3}': // Bomb emoji (💣)
          snippetDecoration = (
            <Icon
              color={this.props.isSelected ? globalColors.white : globalColors.black_50}
              type="iconfont-timer"
              fontSize={isMobile ? 16 : 12}
              style={{alignSelf: 'flex-start'}}
            />
          )
          break
        default:
          snippetDecoration =
            !!this.props.snippetDecoration && !this.props.isTypingSnippet ? (
              <Text type="BodySmall">{this.props.snippetDecoration}</Text>
            ) : null
      }
      content = (
        <Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
          {!!snippetDecoration && (
            <Box2 direction="vertical" centerChildren={true}>
              {snippetDecoration}
            </Box2>
          )}
          {!exploded && !!this.props.snippet && (
            <Markdown preview={true} style={style}>
              {this.props.snippet}
            </Markdown>
          )}
        </Box2>
      )
    } else {
      return null
    }
    return (
      <Box
        style={collapseStyles([
          styles.outerBox,
          {
            backgroundColor: isMobile ? this.props.backgroundColor : undefined,
          },
        ])}
      >
        {this.props.hasResetUsers && (
          <Meta title="reset" style={styles.alertMeta} backgroundColor={globalColors.red} />
        )}
        {this.props.youNeedToRekey && (
          <Meta title="rekey needed" style={styles.alertMeta} backgroundColor={globalColors.red} />
        )}
        <Box style={styles.innerBox}>{content}</Box>
      </Box>
    )
  }
}
const styles = styleSheetCreate({
  alertMeta: platformStyles({
    common: {
      alignSelf: 'center',
      marginRight: 6,
    },
    isMobile: {
      marginTop: 2,
    },
  }),
  bottomLine: platformStyles({
    isAndroid: {
      lineHeight: undefined,
    },
    isElectron: {
      color: globalColors.black_50,
      display: 'block',
      minHeight: 16,
      overflow: 'hidden',
      paddingRight: 10,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
    },
    isMobile: {
      backgroundColor: globalColors.fastBlank,
      color: globalColors.black_50,
      flex: 1,
      fontSize: 15,
      lineHeight: 19,
      paddingRight: 40,
      paddingTop: 2, // so the tops of emoji aren't chopped off
    },
  }),
  contentBox: {
    ...globalStyles.fillAbsolute,
    alignItems: 'center',
    width: '100%',
  },
  draftLabel: {
    color: globalColors.orange,
  },
  innerBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flexGrow: 1,
    height: isMobile ? 21 : 17,
    position: 'relative',
  },
  outerBox: {
    ...globalStyles.flexBoxRow,
  },
  rekeyNeededContainer: {
    alignSelf: 'center',
    backgroundColor: globalColors.red,
    borderRadius: 2,
    paddingLeft: globalMargins.xtiny,
    paddingRight: globalMargins.xtiny,
  },
  rekeyNeededText: platformStyles({
    common: {
      color: globalColors.white,
    },
    isElectron: {
      fontSize: 11,
      lineHeight: 13,
    },
    isMobile: {
      fontSize: 12,
      lineHeight: 14,
    },
  }),
  typingSnippet: {},
  youAreResetText: platformStyles({
    isElectron: {
      fontSize: 12,
      lineHeight: 13,
    },
    isMobile: {
      fontSize: 14,
      lineHeight: 19,
    },
  }),
})
export {BottomLine}
