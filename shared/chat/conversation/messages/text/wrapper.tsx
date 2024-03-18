import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useReply} from './reply'
import {useBottom} from './bottom'
import {OrdinalContext} from '../ids-context'
import {SetRecycleTypeContext} from '../../recycle-type-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import {sharedStyles} from '../shared-styles'
import isEqual from 'lodash/isEqual'

// Encoding all 4 states as static objects so we don't re-render

const getStyle = (
  type: 'error' | 'sent' | 'pending',
  isEditing: boolean,
  isHighlighted?: boolean
): Kb.Styles.StylesCrossPlatform => {
  if (isHighlighted) {
    return Kb.Styles.collapseStyles([sharedStyles.sent, sharedStyles.highlighted])
  } else if (type === 'sent') {
    return isEditing
      ? sharedStyles.sentEditing
      : Kb.Styles.collapseStyles([sharedStyles.sent, {backgroundColor: Kb.Styles.globalColors.fastBlank}])
  } else {
    return isEditing
      ? sharedStyles.pendingFailEditing
      : Kb.Styles.collapseStyles([
          sharedStyles.pendingFail,
          {backgroundColor: Kb.Styles.globalColors.fastBlank},
        ])
  }
}

const MessageMarkdown = (p: {style: Kb.Styles.StylesCrossPlatform}) => {
  const {style} = p
  const ordinal = React.useContext(OrdinalContext)
  const text = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    if (m?.type !== 'text') return ''
    const decoratedText = m.decoratedText
    const text = m.text
    return decoratedText ? decoratedText.stringValue() : text.stringValue()
  })

  const styleOverride = React.useMemo(
    () => (Kb.Styles.isMobile ? ({paragraph: style} as any) : undefined),
    [style]
  )

  return (
    <Kb.Markdown
      messageType="text"
      style={style}
      styleOverride={styleOverride}
      allowFontScaling={true}
      context={String(ordinal)}
    >
      {text}
    </Kb.Markdown>
  )
}

const WrapperText = React.memo(function WrapperText(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {type, showCenteredHighlight} = common

  const bottomChildren = useBottom(ordinal)
  const reply = useReply(ordinal)

  const {isEditing, textType, hasReactions} = C.useChatContext(
    C.useShallow(s => {
      const isEditing = s.editing === ordinal
      const m = s.messageMap.get(ordinal)
      const errorReason = m?.errorReason
      const textType = errorReason
        ? ('error' as const)
        : !m?.submitState
          ? ('sent' as const)
          : ('pending' as const)
      const hasReactions = (m?.reactions?.size ?? 0) > 0
      return {hasReactions, isEditing, textType}
    })
  )

  const setRecycleType = React.useContext(SetRecycleTypeContext)
  let subType = ''
  if (reply) {
    subType += ':reply'
  }
  if (hasReactions) {
    subType += ':reactions'
  }
  if (subType.length) {
    setRecycleType(ordinal, 'text' + subType)
  }

  // Uncomment to test effective recycling
  // const DEBUGOldOrdinalRef = React.useRef(0)
  // const DEBUGOldTypeRef = React.useRef('')
  // React.useEffect(() => {
  //   const oldtype = DEBUGOldTypeRef.current
  //   if (DEBUGOldOrdinalRef.current) {
  //     console.log(
  //       'debug textwrapperRecycle',
  //       DEBUGOldOrdinalRef.current,
  //       ordinal,
  //       subType === oldtype ? `SAME ${subType}` : `${subType} != ${oldtype} <<<<<<<<<<<<<<<<<`
  //     )
  //   }
  //   DEBUGOldOrdinalRef.current = ordinal
  //   DEBUGOldTypeRef.current = subType
  // }, [ordinal, subType])

  const lastStyle = React.useRef<Kb.Styles.StylesCrossPlatform>({})
  const style = React.useMemo(() => {
    const s = getStyle(textType, isEditing, showCenteredHighlight)
    if (!isEqual(s, lastStyle.current)) {
      lastStyle.current = s
    }
    return lastStyle.current
  }, [textType, isEditing, showCenteredHighlight])

  const children = React.useMemo(() => {
    return (
      <>
        {reply}
        <MessageMarkdown style={style} />
      </>
    )
  }, [reply, style])

  // due to recycling, we can have items that aren't connected to the list that might have live connectors
  // so when we load more etc the entire messagMap could no longer have your item
  if (type !== 'text') {
    return null
  }

  return (
    <WrapperMessage {...p} {...common} bottomChildren={bottomChildren}>
      {children}
    </WrapperMessage>
  )
})

export default WrapperText
