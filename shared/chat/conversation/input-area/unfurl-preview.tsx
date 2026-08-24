import * as Kb from '@/common-adapters'
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
  const {dismiss, previews} = useUnfurlPreviews(conversationIDKey, text)
  const genericPreviews = previews.flatMap(preview => {
    const {unfurl} = preview
    if (unfurl.unfurlType !== T.RPCChat.UnfurlType.generic || unfurl.generic.mapInfo) {
      // a map unfurl is a generic unfurl with mapInfo set, and the message card refuses
      // to render those, so the preview must not show one either
      return []
    }
    return [{generic: unfurl.generic, preview}]
  })
  if (isMobile || !genericPreviews.length) {
    return null
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.container}>
      {genericPreviews.map(({preview, generic}) => (
        <UnfurlGenericView
          key={preview.url}
          description={generic.description ?? undefined}
          favicon={generic.favicon ?? undefined}
          media={generic.media ?? undefined}
          onClose={() => dismiss(preview.url)}
          publishTime={generic.publishTime ?? undefined}
          siteName={generic.siteName}
          title={generic.title}
          url={generic.url}
        />
      ))}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: theme.blueGrey,
          maxHeight: 200,
          overflowY: 'auto',
          padding: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)

export default UnfurlPreview
