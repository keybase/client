import React from 'react'
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

const BottomLine = React.memo((props: Props) => {
  let content: React.ReactNode
  const style = Styles.collapseStyles([
    styles.bottomLine,
    {
      color: props.subColor,
      ...(props.showBold ? Styles.globalStyles.fontBold : {}),
    },
    props.isTypingSnippet ? styles.typingSnippet : null,
  ])
  if (props.youNeedToRekey) {
    content = null
  } else if (props.youAreReset) {
    content = (
      <Kb.Text
        type="BodySmallSemibold"
        negative={true}
        style={Styles.collapseStyles([
          styles.youAreResetText,
          {
            color: props.isSelected ? Styles.globalColors.white : Styles.globalColors.red,
          },
        ])}
      >
        You are locked out.
      </Kb.Text>
    )
  } else if (props.participantNeedToRekey) {
    content = (
      <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
    )
  } else if (props.draft) {
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        <Kb.Text
          type="BodySmall"
          style={Styles.collapseStyles([
            styles.draftLabel,
            props.isSelected ? {color: Styles.globalColors.white} : null,
          ])}
        >
          Draft:
        </Kb.Text>
        <Kb.Markdown preview={true} style={style}>
          {props.draft}
        </Kb.Markdown>
      </Kb.Box2>
    )
  } else if (props.isDecryptingSnippet) {
    content = (
      <Kb.Meta title="decrypting..." style={styles.alertMeta} backgroundColor={Styles.globalColors.blue} />
    )
  } else if (props.snippet) {
    let snippetDecoration: React.ReactNode
    let exploded = false

    // `snippetDecoration` will either be an explosion emoji, bomb emoji, or empty string.
    // We want to use these emojis to render the correct custom icon.
    switch (props.snippetDecoration) {
      case '\u{1F4A5}': // Explosion (Collision) emoji (💥)
        snippetDecoration = (
          <Kb.Text
            type="BodySmall"
            style={{
              color: props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_50,
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
            color={props.isSelected ? 'white' : 'black_50'}
            type="iconfont-timer"
            fontSize={Styles.isMobile ? 16 : 12}
            style={{alignSelf: 'flex-start'}}
          />
        )
        break
      default:
        snippetDecoration =
          !!props.snippetDecoration && !props.isTypingSnippet ? (
            <Kb.Text type="BodySmall">{props.snippetDecoration}</Kb.Text>
          ) : null
    }
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        {!!snippetDecoration && (
          <Kb.Box2 direction="vertical" centerChildren={true}>
            {snippetDecoration}
          </Kb.Box2>
        )}
        {!exploded && !!props.snippet && (
          <Kb.Markdown preview={true} style={style}>
            {props.snippet}
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
          backgroundColor: Styles.isMobile ? props.backgroundColor : undefined,
        },
      ])}
    >
      {props.hasResetUsers && (
        <Kb.Meta title="reset" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
      )}
      {props.youNeedToRekey && (
        <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
      )}
      <Kb.Box style={styles.innerBox}>{content}</Kb.Box>
    </Kb.Box>
  )
})

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
