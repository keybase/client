import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import UnfurlGenericView from '@/chat/conversation/messages/text/unfurl/unfurl-list/generic-view'
import {useUnfurlPreviews} from '@/chat/conversation/unfurl-preview-state'

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  text: string
}

const UnfurlPreview = (p: Props) => {
  const {conversationIDKey, text} = p
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {dismiss, previews} = useUnfurlPreviews(conversationIDKey, text)
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
  if (isMobile || !shown) {
    return null
  }
  const onPrevious = () => {
    setIndex(clamped - 1)
  }
  const onNext = () => {
    setIndex(clamped + 1)
  }
  const pager =
    genericPreviews.length > 1 ? (
      <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" style={styles.pager}>
        <Kb.Icon
          type="iconfont-arrow-left"
          sizeType="Tiny"
          onClick={clamped > 0 ? onPrevious : undefined}
          color={clamped > 0 ? undefined : theme.black_20}
          padding="xtiny"
        />
        <Kb.Text type="BodyTinySemibold">{`${clamped + 1}/${genericPreviews.length}`}</Kb.Text>
        <Kb.Icon
          type="iconfont-arrow-right"
          sizeType="Tiny"
          onClick={clamped < genericPreviews.length - 1 ? onNext : undefined}
          color={clamped < genericPreviews.length - 1 ? undefined : theme.black_20}
          padding="xtiny"
        />
      </Kb.Box2>
    ) : null
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="flex-start" style={styles.container}>
      {pager}
      <Kb.Box2 direction="vertical" style={styles.stack}>
        {genericPreviews.map(({generic, preview}, i) => (
          // every card occupies the same grid cell, so the stack is always as big as the
          // largest one and paging never resizes the panel. the inactive ones are only
          // hidden, which also keeps them out of the tab order and unclickable.
          <Kb.Box2
            key={preview.url}
            direction="vertical"
            style={Kb.Styles.collapseStyles([styles.cell, i === clamped ? null : styles.cellHidden])}
          >
            <UnfurlGenericView
              description={generic.description ?? undefined}
              favicon={generic.favicon ?? undefined}
              media={generic.media ?? undefined}
              onClose={() => dismiss(preview.url)}
              publishTime={generic.publishTime ?? undefined}
              siteName={generic.siteName}
              title={generic.title}
              url={generic.url}
            />
          </Kb.Box2>
        ))}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          // floats over the thread instead of taking flow space, so showing a preview
          // never shifts the message list
          backgroundColor: theme.white,
          borderColor: theme.black_10,
          borderRadius: Kb.Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          bottom: '100%',
          left: Kb.Styles.globalMargins.small,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          maxHeight: 200,
          maxWidth: 500,
          overflowY: 'auto',
          padding: Kb.Styles.globalMargins.tiny,
          position: 'absolute',
        },
      }),
      cell: Kb.Styles.platformStyles({
        // grid items stretch by default, which would drop a short card into the middle of
        // the tallest one's space. the track still sizes to the tallest either way.
        isElectron: {alignSelf: 'start', gridArea: '1 / 1'},
      }),
      cellHidden: Kb.Styles.platformStyles({
        isElectron: {visibility: 'hidden'},
      }),
      pager: Kb.Styles.platformStyles({
        isElectron: {alignItems: 'center'},
      }),
      stack: Kb.Styles.platformStyles({
        isElectron: {display: 'grid'},
      }),
    }) as const
)

export default UnfurlPreview
