import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters/index'
import UnfurlImage from './image'
import * as T from '@/constants/types'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {getUnfurlInfo, useActions} from './use-state'

function UnfurlGiphy(p: {idx: number}) {
  const {idx} = p
  const ordinal = useOrdinal()

  const data = Chat.useChatContext(
    C.useShallow(s => {
      const {unfurl, isCollapsed, unfurlMessageID, youAreAuthor} = getUnfurlInfo(s, ordinal, idx)
      if (unfurl?.unfurlType !== T.RPCChat.UnfurlType.giphy) {
        return null
      }
      const {giphy} = unfurl
      const {favicon, image, video} = giphy
      const {height, isVideo, url, width} = video || image || {height: 0, isVideo: false, url: '', width: 0}

      return {
        favicon: favicon?.url,
        height,
        isCollapsed,
        isVideo,
        unfurlMessageID,
        url,
        width,
        youAreAuthor,
      }
    })
  )

  const {onClose, onToggleCollapse} = useActions(
    data?.youAreAuthor ?? false,
    T.Chat.numberToMessageID(data?.unfurlMessageID ?? 0),
    ordinal
  )

  if (data === null) return null

  const {favicon, isCollapsed, isVideo, url, width, height} = data

  return (
    <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
      {!Kb.Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
      <Kb.Box2 style={styles.innerContainer} gap="xtiny" direction="vertical">
        <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal" justifyContent="space-between">
          <Kb.Box2 direction="horizontal" gap="tiny">
            {favicon ? <Kb.Image src={favicon} style={styles.favicon} /> : null}
            <Kb.Text type="BodySmall">
              Giphy
            </Kb.Text>
            <Kb.Icon2
              style={Kb.Styles.collapseStyles([styles.collapseBox, styles.collapse])}
              onClick={onToggleCollapse}
              sizeType="Tiny"
              type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
            />
          </Kb.Box2>
          {onClose ? (
            <Kb.Icon2
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
        common: {alignSelf: 'flex-start'},
        isElectron: {maxWidth: 500},
        isTablet: {maxWidth: 500},
      }),

      favicon: {
        borderRadius: Kb.Styles.borderRadius,
        height: 16,
        width: 16,
      },
      innerContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
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
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.grey,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
      },
      siteNameContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.xxtiny,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)

export default UnfurlGiphy
