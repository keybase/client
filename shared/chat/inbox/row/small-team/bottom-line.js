// @flow
import React, {PureComponent} from 'react'
import flags from '../../../../util/feature-flags'
import {Text, Markdown, Box, Box2, Meta, Icon} from '../../../../common-adapters'
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
  backgroundColor: ?string,
  participantNeedToRekey: boolean,
  showBold: boolean,
  snippet: ?string,
  snippetDecoration: ?string,
  subColor: string,
  youNeedToRekey: boolean,
  youAreReset: boolean,
  hasResetUsers: boolean,
  isSelected: boolean,
}

class BottomLine extends PureComponent<Props> {
  render() {
    let content

    if (this.props.youNeedToRekey) {
      content = null
    } else if (this.props.youAreReset) {
      content = (
        <Text
          type="BodySmallSemibold"
          backgroundMode="Terminal"
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
        <Text type="BodySmall" backgroundMode="Terminal" style={{color: this.props.subColor}}>
          Waiting for participants to rekey
        </Text>
      )
    } else if (this.props.snippet) {
      const style = collapseStyles([
        styles.bottomLine,
        {
          color: this.props.subColor,
          ...(this.props.showBold ? globalStyles.fontBold : {}),
        },
      ])

      let snippetDecoration
      let exploded = false

      // `snippetDecoration` will either be an explosion emoji, bomb emoji, or empty string.
      // We want to use these emojis to render the correct custom icon.
      switch (this.props.snippetDecoration) {
        case '\u{1F4A5}': // Explosion (Collision) emoji (💥)
          snippetDecoration = (
            <Icon
              type="iconfont-boom"
              fontSize={isMobile ? 40 : 28}
              style={platformStyles({
                common: {
                  color: this.props.isSelected ? globalColors.white : globalColors.black_20,
                },
                isMobile: {
                  marginTop: -8,
                },
              })}
            />
          )
          exploded = true
          break
        case '\u{1F4A3}': // Bomb emoji (💣)
          snippetDecoration = (
            <Icon
              color={globalColors.black_75}
              type="iconfont-bomb"
              fontSize={isMobile ? 16 : 12}
              style={{alignSelf: 'flex-start'}}
            />
          )
          break
        default:
          snippetDecoration = this.props.snippetDecoration ? (
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
          {!exploded &&
            !!this.props.snippet && (
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
  outerBox: {
    ...globalStyles.flexBoxRow,
  },
  innerBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flexGrow: 1,
    height: isMobile ? 21 : 17,
    position: 'relative',
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
  bottomLine: platformStyles({
    isAndroid: {
      lineHeight: undefined,
    },
    isElectron: {
      paddingRight: flags.useSimpleMarkdown ? 10 : 30,
      color: globalColors.black_40,
      display: 'block',
      fontSize: 12,
      lineHeight: 15,
      minHeight: 16,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
    },
    isMobile: {
      paddingRight: flags.useSimpleMarkdown ? 40 : 30,
      backgroundColor: globalColors.fastBlank,
      color: globalColors.black_40,
      flex: 1,
      fontSize: 14,
    },
  }),
  contentBox: {
    ...globalStyles.fillAbsolute,
    alignItems: 'center',
    width: '100%',
  },
  alertMeta: platformStyles({
    common: {
      alignSelf: 'center',
      marginRight: 6,
    },
    isMobile: {
      marginTop: 2,
    },
  }),
})
export {BottomLine}
