import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {AllowedColors} from '../../../../common-adapters/text'

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
    const style = Styles.collapseStyles([
      styles.bottomLine,
      {
        color: this.props.subColor,
        ...(this.props.showBold ? Styles.globalStyles.fontBold : {}),
      },
      this.props.isTypingSnippet ? styles.typingSnippet : null,
    ])
    if (this.props.youNeedToRekey) {
      content = null
    } else if (this.props.youAreReset) {
      content = (
        <Kb.Text
          type="BodySmallSemibold"
          negative={true}
          style={Styles.collapseStyles([
            styles.youAreResetText,
            {
              color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.red,
            },
          ])}
        >
          You are locked out.
        </Kb.Text>
      )
    } else if (this.props.participantNeedToRekey) {
      content = (
        <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
      )
    } else if (this.props.draft) {
      content = (
        <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
          <Kb.Text
            type="BodySmall"
            style={Styles.collapseStyles([
              styles.draftLabel,
              this.props.isSelected ? {color: Styles.globalColors.white} : null,
            ])}
          >
            Draft:
          </Kb.Text>
          <Kb.Markdown preview={true} style={style}>
            {this.props.draft}
          </Kb.Markdown>
        </Kb.Box2>
      )
    } else if (this.props.isDecryptingSnippet) {
      content = (
        <Kb.Meta title="decrypting..." style={styles.alertMeta} backgroundColor={Styles.globalColors.blue} />
      )
    } else if (this.props.snippet) {
      let snippetDecoration
      let exploded = false

      // `snippetDecoration` will either be an explosion emoji, bomb emoji, or empty string.
      // We want to use these emojis to render the correct custom icon.
      switch (this.props.snippetDecoration) {
        case '\u{1F4A5}': // Explosion (Collision) emoji (💥)
          snippetDecoration = (
            <Kb.Text
              type="BodySmall"
              style={{
                color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_50,
              }}
            >
              Message exploded.
            </Kb.Text>
          )
          exploded = true
          break
        case '\u{1F4A3}': // Bomb emoji (💣)
          snippetDecoration = (
            <Kb.Icon
              color={this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_50}
              type="iconfont-timer"
              fontSize={Styles.isMobile ? 16 : 12}
              style={{alignSelf: 'flex-start'}}
            />
          )
          break
        default:
          snippetDecoration =
            !!this.props.snippetDecoration && !this.props.isTypingSnippet ? (
              <Kb.Text type="BodySmall">{this.props.snippetDecoration}</Kb.Text>
            ) : null
      }
      content = (
        <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
          {!!snippetDecoration && (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              {snippetDecoration}
            </Kb.Box2>
          )}
          {!exploded && !!this.props.snippet && (
            <Kb.Markdown preview={true} style={style}>
              {this.props.snippet}
            </Kb.Markdown>
          )}
        </Kb.Box2>
      )
    } else {
      return null
    }
    return (
      <Kb.Box
        style={Styles.collapseStyles([
          styles.outerBox,
          {
            backgroundColor: Styles.isMobile ? this.props.backgroundColor : undefined,
          },
        ])}
      >
        {this.props.hasResetUsers && (
          <Kb.Meta title="reset" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
        )}
        {this.props.youNeedToRekey && (
          <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
        )}
        <Kb.Box style={styles.innerBox}>{content}</Kb.Box>
      </Kb.Box>
    )
  }
}
const styles = Styles.styleSheetCreate(
  () =>
    ({
      alertMeta: Styles.platformStyles({
        common: {
          alignSelf: 'center',
          marginRight: 6,
        },
        isMobile: {
          marginTop: 2,
        },
      }),
      bottomLine: Styles.platformStyles({
        isAndroid: {
          lineHeight: undefined,
        },
        isElectron: {
          color: Styles.globalColors.black_50,
          display: 'block',
          minHeight: 16,
          overflow: 'hidden',
          paddingRight: 10,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        },
        isMobile: {
          backgroundColor: Styles.globalColors.fastBlank,
          color: Styles.globalColors.black_50,
          flex: 1,
          fontSize: 15,
          lineHeight: 19,
          paddingRight: 40,
          paddingTop: 2, // so the tops of emoji aren't chopped off
        },
      }),
      contentBox: {
        ...Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
        width: '100%',
      },
      draftLabel: {
        color: Styles.globalColors.orange,
      },
      innerBox: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          height: 17,
          position: 'relative',
        },
        isMobile: {
          height: 21,
        },
      }),
      outerBox: {
        ...Styles.globalStyles.flexBoxRow,
      },
      typingSnippet: {},
      youAreResetText: Styles.platformStyles({
        isElectron: {
          fontSize: 12,
          lineHeight: 13,
        },
        isMobile: {
          fontSize: 14,
          lineHeight: 19,
        },
      }),
    } as const)
)
export {BottomLine}
