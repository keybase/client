import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import UnfurlGenericView from '@/chat/conversation/messages/text/unfurl/unfurl-list/generic-view'
import {useUnfurlPreviews} from '@/chat/conversation/unfurl-preview-state'
import {ThreadRefsContext} from '@/chat/conversation/normal/context'

type Props = {
  // false while editing a message: the edit rpc cannot carry suppression, so offering a
  // dismiss there would be a control that does nothing
  canDismiss: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  text: string
}

const UnfurlPreview = (p: Props) => {
  const {canDismiss, conversationIDKey, text} = p
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {dismiss, previews} = useUnfurlPreviews(conversationIDKey, text)
  const {focusInput} = React.useContext(ThreadRefsContext)
  const [index, setIndex] = React.useState(0)
  const genericPreviews = previews.flatMap(preview => {
    const {unfurl} = preview
    if (unfurl.unfurlType !== T.RPCChat.UnfurlType.generic || unfurl.generic.mapInfo) {
      // a map unfurl is a generic unfurl with mapInfo set, and the message card refuses
      // to render those, so the preview must not show one either
      return []
    }
    return [{generic: unfurl.generic, preview}]
  })
  // dismissing the last card, or the text losing a link, shrinks the list under us
  const clamped = Math.min(index, Math.max(genericPreviews.length - 1, 0))
  const shown = genericPreviews[clamped]
  if (!shown) {
    return null
  }
  const {generic, preview} = shown
  const onPrevious = () => {
    setIndex(clamped - 1)
  }
  const onNext = () => {
    setIndex(clamped + 1)
  }
  const atStart = clamped === 0
  const atEnd = clamped === genericPreviews.length - 1
  const pager =
    genericPreviews.length > 1 ? (
      <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" style={styles.pager}>
        <Kb.Icon
          type="iconfont-arrow-left"
          sizeType="Tiny"
          onClick={atStart ? undefined : onPrevious}
          color={atStart ? theme.black_20 : undefined}
          padding="xtiny"
        />
        <Kb.Text type="BodyTinySemibold">{`${clamped + 1}/${genericPreviews.length}`}</Kb.Text>
        <Kb.Icon
          type="iconfont-arrow-right"
          sizeType="Tiny"
          onClick={atEnd ? undefined : onNext}
          color={atEnd ? theme.black_20 : undefined}
          padding="xtiny"
        />
      </Kb.Box2>
    ) : null
  const card = (
    <UnfurlGenericView
      description={generic.description ?? undefined}
      favicon={generic.favicon ?? undefined}
      media={generic.media ?? undefined}
      onClose={
        canDismiss
          ? () => {
              dismiss(preview.url)
              // the X takes focus on the way out, and the composer is where the user was
              focusInput()
            }
          : undefined
      }
      publishTime={generic.publishTime ?? undefined}
      siteName={generic.siteName}
      title={generic.title}
      url={generic.url}
    />
  )
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="flex-start" style={styles.container}>
      {pager}
      {/* the card area is a fixed size, so paging between cards never resizes the panel.
          only this part scrolls; the pager above it stays put */}
      {isMobile ? (
        // native clips at a fixed height rather than scrolling, so it needs a real scroller
        <Kb.ScrollView style={styles.cardArea}>{card}</Kb.ScrollView>
      ) : (
        <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.cardArea}>
          {card}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      cardArea: Kb.Styles.platformStyles({
        common: {height: 200},
        // per axis rather than the shorthand: `overflow: hidden` would also set the y axis
        // and beat the scroll depending on emission order
        isElectron: {overflowX: 'hidden', overflowY: 'auto', width: 420},
        isMobile: {flexGrow: 0, flexShrink: 0},
      }),
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: theme.white,
          borderColor: theme.black_10,
          borderRadius: Kb.Styles.borderRadius,
          borderWidth: 1,
          padding: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          // floats over the thread instead of taking flow space, so showing a preview
          // never shifts the message list
          borderStyle: 'solid',
          bottom: '100%',
          left: Kb.Styles.globalMargins.small,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          position: 'absolute',
        },
        isMobile: {
          // in flow above the composer, the way the reply preview already sits
          alignSelf: 'stretch',
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      pager: Kb.Styles.platformStyles({
        common: {alignItems: 'center'},
      }),
    }) as const
)

export default UnfurlPreview
