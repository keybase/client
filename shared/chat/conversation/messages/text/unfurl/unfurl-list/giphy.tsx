import * as Kb from '@/common-adapters/index'
import UnfurlImage from './image'
import * as T from '@/constants/types'
import {useActions} from './use-state'

function UnfurlGiphy(p: {
  author: string
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
  unfurlInfo: T.RPCChat.UIMessageUnfurlInfo
  youAreAuthor: boolean
}) {
  const {ordinal, unfurlInfo, youAreAuthor} = p
  const {isCollapsed, unfurl, unfurlMessageID} = unfurlInfo
  const {onClose, onToggleCollapse} = useActions(
    youAreAuthor,
    T.Chat.numberToMessageID(unfurlMessageID),
    ordinal
  )
  if (unfurl.unfurlType !== T.RPCChat.UnfurlType.giphy) {
    return null
  }
  const {giphy} = unfurl
  const {favicon, image, video} = giphy
  const {height, isVideo, url, width} = video || image || {height: 0, isVideo: false, url: '', width: 0}

  return (
    <Kb.Box2 alignSelf="flex-start" gap="tiny" direction="horizontal" style={styles.container}>
      {!isMobile && <Kb.Box2 direction="horizontal" alignSelf="stretch" style={styles.quoteContainer} />}
      <Kb.Box2 alignSelf="flex-start" gap="xtiny" direction="vertical" style={styles.innerContainer}>
        <Kb.Box2 alignSelf="flex-start" gap="tiny" fullWidth={true} direction="horizontal" justifyContent="space-between" style={styles.siteNameContainer}>
          <Kb.Box2 direction="horizontal" gap="tiny">
            {favicon?.url ? <Kb.Image src={favicon.url} style={styles.favicon} /> : null}
            <Kb.Text type="BodySmall">
              Giphy
            </Kb.Text>
            <Kb.Icon
              style={Kb.Styles.collapseStyles([styles.collapseBox, styles.collapse])}
              onClick={onToggleCollapse}
              sizeType="Tiny"
              type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
            />
          </Kb.Box2>
          {onClose ? (
            <Kb.Icon
              type="iconfont-close"
              onClick={onClose}
              className="unfurl-closebox"
              padding="xtiny"
              fontSize={12}
              color={Kb.Styles.globalColors.black_20}
            />
          ) : null}
        </Kb.Box2>
        {isCollapsed ? null : (
          <UnfurlImage url={url} height={height} width={width} isVideo={isVideo} autoplayVideo={isVideo} />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      collapse: Kb.Styles.platformStyles({
        isElectron: {
          position: 'relative',
          top: Kb.Styles.globalMargins.xxtiny,
        },
        isMobile: {
          alignSelf: 'center',
        },
      }),
      collapseBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
      },
      container: Kb.Styles.platformStyles({
        isElectron: {maxWidth: 500},
        isTablet: {maxWidth: 500},
      }),

      favicon: {
        borderRadius: Kb.Styles.borderRadius,
        ...Kb.Styles.size(16),
      },
      innerContainer: Kb.Styles.platformStyles({
        common: {
          minWidth: 150,
        },
        isMobile: {
          borderColor: Kb.Styles.globalColors.grey,
          borderRadius: Kb.Styles.borderRadius,
          borderWidth: 1,
          padding: Kb.Styles.globalMargins.xtiny,
        },
      }),
      quoteContainer: {
        backgroundColor: Kb.Styles.globalColors.grey,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
      },
      siteNameContainer: Kb.Styles.platformStyles({
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.xxtiny,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)

export default UnfurlGiphy
