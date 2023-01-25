import * as React from 'react'
import * as Styles from '../../styles'
import Text from '../text'
import {marked} from 'marked'
type Props = {
  children: React.ReactNode
}

type Token = {type: string; raw: string; tokens?: Array<Token>; text: string}

const parse = (tokens?: Array<Token>) => {
  return (
    tokens?.map(t => {
      console.log('aaa', t)
      switch (t.type) {
        case 'paragraph':
          return (
            <Text type="Body" style={markdownStyles.textBlockStyle}>
              {parse(t.tokens)}
            </Text>
          )
        case 'text':
          return t.raw
        case 'em':
          const bold = t.raw[0] === '*'
          return (
            <Text
              type={bold ? 'BodySemibold' : 'Body'}
              style={bold ? markdownStyles.boldStyle : markdownStyles.italicStyle}
            >
              {parse(t.tokens)}
            </Text>
          )
        default:
          return t.raw
      }
    }) ?? null
  )
}

const Markdown2 = React.memo(function Markdown2(p: Props) {
  const {children} = p
  const tokens = marked.lexer(children, {gfm: true, mangle: false})
  const debug = parse(tokens)
  return (
    <div
      style={
        {
          /*position: 'absolute', left: 0, top: 0, right: 0, bottom: 0*/
        }
      }
    >
      {/* {JSON.stringify(tokens)} */}
      {debug}
    </div>
  )
})

const markdownStyles = Styles.styleSheetCreate(() => {
  const electronWrapStyle = {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  } as const
  return {
    bigTextBlockStyle: Styles.platformStyles({
      isElectron: {
        ...electronWrapStyle,
        color: 'inherit',
        display: 'block',
        fontWeight: 'inherit',
      },
      isMobile: {
        fontSize: 32,
        lineHeight: 39.5, // matches 40 px height
      },
    } as const),
    boldStyle: Styles.platformStyles({
      common: {...Styles.globalStyles.fontBold},
      isElectron: {color: 'inherit', ...electronWrapStyle},
      isMobile: {color: undefined},
    }),
    get codeSnippetBlockStyle() {
      return Styles.platformStyles({
        common: {
          ...this.codeSnippetStyle,
          backgroundColor: Styles.globalColors.redLighter,
          marginBottom: Styles.globalMargins.xtiny,
          marginTop: Styles.globalMargins.xtiny,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.xtiny,
        },
        isElectron: {
          ...electronWrapStyle,
          color: Styles.globalColors.black,
          display: 'block',
        },
      })
    },
    codeSnippetBlockTextStyle: Styles.platformStyles({
      isMobile: {
        ...Styles.globalStyles.fontTerminal,
        backgroundColor: Styles.globalColors.redLighter,
        color: Styles.globalColors.black,
        fontSize: 15,
      },
    }),
    codeSnippetStyle: Styles.platformStyles({
      common: {
        ...Styles.globalStyles.fontTerminal,
        ...Styles.globalStyles.rounded,
        backgroundColor: Styles.globalColors.redLighter,
        color: Styles.globalColors.blueDarkOrBlueLight,
        paddingLeft: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      isElectron: {
        ...electronWrapStyle,
        fontSize: 12,
      },
      isMobile: {fontSize: 15},
    }),
    italicStyle: Styles.platformStyles({
      common: {fontStyle: 'italic'},
      isElectron: {color: 'inherit', fontWeight: 'inherit', ...electronWrapStyle},
      isMobile: {color: undefined, fontWeight: undefined},
    }),
    linkStyle: Styles.platformStyles({
      isElectron: {
        ...electronWrapStyle,
        fontWeight: 'inherit',
      },
      isMobile: {fontWeight: undefined},
    }),
    neutralPreviewStyle: Styles.platformStyles({
      isElectron: {color: 'inherit', fontWeight: 'inherit'},
      isMobile: {color: Styles.globalColors.black_50, fontWeight: undefined},
    }),
    quoteStyle: Styles.platformStyles({
      common: {
        borderLeftColor: Styles.globalColors.grey,
        borderLeftWidth: 3,
        borderStyle: 'solid',
      },
      isElectron: {
        display: 'block',
        paddingLeft: Styles.globalMargins.small,
      },
      isMobile: {
        paddingLeft: Styles.globalMargins.tiny,
      },
    }),
    strikeStyle: Styles.platformStyles({
      isElectron: {
        ...electronWrapStyle,
        color: 'inherit',
        fontWeight: 'inherit',
        textDecoration: 'line-through',
      } as const,
      isMobile: {
        fontWeight: undefined,
        textDecorationLine: 'line-through',
      },
    }),
    textBlockStyle: Styles.platformStyles({
      isAndroid: {lineHeight: undefined},
      isElectron: {color: 'inherit', display: 'block', fontWeight: 'inherit', ...electronWrapStyle},
    } as const),
    wrapStyle: Styles.platformStyles({isElectron: electronWrapStyle}),
  } as const
})

export default Markdown2
