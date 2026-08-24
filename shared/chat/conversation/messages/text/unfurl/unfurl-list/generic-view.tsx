import * as Kb from '@/common-adapters/index'
import type * as T from '@/constants/types'
import UnfurlImage from './image'
import {formatTimeForMessages} from '@/util/timestamp'

export type UnfurlGenericViewProps = {
  description?: string
  favicon?: T.RPCChat.UnfurlImageDisplay
  isCollapsed?: boolean
  media?: T.RPCChat.UnfurlImageDisplay
  onClose?: () => void
  onToggleCollapse?: () => void
  publishTime?: number
  siteName: string
  title: string
  url: string
}

export default function UnfurlGenericView(p: UnfurlGenericViewProps) {
  const {description, favicon, isCollapsed, media, onClose, onToggleCollapse, publishTime, siteName, title, url} = p
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const titleUrlProps = Kb.useClickURL(url)
  const {height, width, isVideo, url: mediaUrl} = media || {height: 0, isVideo: false, url: '', width: 0}
  const showImageOnSide =
    !isMobile && height >= width && !isVideo && (title.length > 0 || !!description)
  const imageLocation = isCollapsed ? 'collapsed' : showImageOnSide ? 'side' : width > 0 && height > 0 ? 'bottom' : 'none'

  const publisher = (
    <Kb.Box2 alignSelf="flex-start" gap="tiny" fullWidth={true} direction="horizontal" style={styles.siteNameContainer}>
      {favicon?.url ? <Kb.Image src={favicon.url} style={styles.favicon} /> : null}
      <Kb.BoxGrow>
        <Kb.Text type="BodySmall" lineClamp={1}>
          {siteName}
          {publishTime ? (
            <Kb.Text type="BodySmall"> • Published {formatTimeForMessages(publishTime * 1000)}</Kb.Text>
          ) : null}
        </Kb.Text>
      </Kb.BoxGrow>
      {onClose ? (
        <Kb.Icon
          type="iconfont-close"
          onClick={onClose}
          style={styles.closeBox}
          padding="xtiny"
          className="unfurl-closebox"
          fontSize={12}
          color={theme.black_20}
        />
      ) : null}
    </Kb.Box2>
  )

  const snippet = description ? (
    <Kb.Text type="Body" lineClamp={5} selectable={true}>
      {description}
      {(imageLocation === 'collapsed' || imageLocation === 'bottom') && (
        <>
          {' '}
          <Kb.Icon
            style={styles.collapseBox}
            onClick={onToggleCollapse}
            sizeType="Tiny"
            type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
          />
        </>
      )}
    </Kb.Text>
  ) : null

  const bottomImage =
    imageLocation === 'bottom' ? (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <UnfurlImage
          url={mediaUrl}
          linkURL={url}
          height={height}
          width={width}
          widthPadding={isMobile ? Kb.Styles.globalMargins.tiny : undefined}
          style={styles.bottomImage}
          isVideo={isVideo}
          autoplayVideo={false}
        />
      </Kb.Box2>
    ) : null

  const rightImage =
    imageLocation === 'side' && mediaUrl ? (
      <Kb.Box2 direction="vertical">
        <Kb.Image src={mediaUrl} style={styles.sideImage} />
      </Kb.Box2>
    ) : null

  return (
    <Kb.Box2 alignSelf="flex-start" gap="tiny" direction="horizontal" style={styles.container}>
      {!isMobile && <Kb.Box2 direction="horizontal" alignSelf="stretch" style={styles.quoteContainer} />}
      <Kb.Box2 alignSelf="flex-start" gap="xxtiny" direction="vertical" fullWidth={true} style={styles.innerContainer}>
        {publisher}
        <Kb.Text type="BodyPrimaryLink" style={styles.url} {...titleUrlProps}>
          {title}
        </Kb.Text>
        {snippet}
        {bottomImage}
      </Kb.Box2>
      {rightImage}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      bottomImage: Kb.Styles.platformStyles({
        common: {marginTop: Kb.Styles.globalMargins.xtiny},
        isMobile: {alignSelf: 'center'},
      }),
      closeBox: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-start',
          marginLeft: 'auto',
        },
      }),
      collapseBox: Kb.Styles.platformStyles({
        isElectron: {display: 'inline'},
      }),
      container: Kb.Styles.platformStyles({
        isElectron: {maxWidth: 500},
        isTablet: {maxWidth: 500},
      }),

      favicon: Kb.Styles.platformStyles({
        common: {
          borderRadius: Kb.Styles.borderRadius,
          ...Kb.Styles.size(16),
        },
      }),
      innerContainer: Kb.Styles.platformStyles({
        common: {
          minWidth: 150,
        },
        isMobile: {
          borderColor: theme.grey,
          borderRadius: Kb.Styles.borderRadius,
          borderWidth: 1,
          padding: Kb.Styles.globalMargins.xtiny,
        },
      }),
      quoteContainer: Kb.Styles.platformStyles({
        common: {
          backgroundColor: theme.grey,
          paddingLeft: Kb.Styles.globalMargins.xtiny,
        },
      }),
      sideImage: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.size(80),
        },
      }),
      siteNameContainer: Kb.Styles.platformStyles({
        isElectron: {minHeight: 16},
        isMobile: {minHeight: 21},
      }),
      url: {
        ...Kb.Styles.globalStyles.fontSemibold,
      },
    }) as const
)
