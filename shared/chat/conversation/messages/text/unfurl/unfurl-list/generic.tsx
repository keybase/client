import * as C from '@/constants'
import * as Kb from '@/common-adapters/index'
import * as T from '@/constants/types'
import * as React from 'react'
import UnfurlImage from './image'
import {OrdinalContext} from '@/chat/conversation/messages/ids-context'
import {formatTimeForMessages} from '@/util/timestamp'
import {getUnfurlInfo, useActions} from './use-state'

const UnfurlGeneric = React.memo(function UnfurlGeneric(p: {idx: number}) {
  const {idx} = p
  const ordinal = React.useContext(OrdinalContext)

  const data = C.useChatContext(
    C.useShallow(s => {
      const {unfurl, isCollapsed, unfurlMessageID, youAreAuthor} = getUnfurlInfo(s, ordinal, idx)
      if (unfurl?.unfurlType !== T.RPCChat.UnfurlType.generic) {
        return null
      }
      const {generic} = unfurl
      const {description, publishTime, favicon, media, siteName, title, url} = generic
      const {height, width, isVideo, url: mediaUrl} = media || {height: 0, isVideo: false, url: '', width: 0}
      const showImageOnSide =
        !Kb.Styles.isMobile && height >= width && !isVideo && (title.length > 0 || !!description)
      const imageLocation = isCollapsed
        ? 'collapsed'
        : showImageOnSide
          ? 'side'
          : width > 0 && height > 0
            ? 'bottom'
            : 'none'

      return {
        description: description || undefined,
        favicon: favicon?.url,
        height,
        imageLocation,
        isCollapsed,
        isVideo,
        mediaUrl,
        publishTime: publishTime ? publishTime * 1000 : 0,
        siteName,
        title,
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

  if (!data) return null

  const {description, favicon, height, isCollapsed, isVideo, publishTime} = data
  const {siteName, title, url, width, imageLocation, mediaUrl} = data

  const publisher = (
    <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
      {favicon ? <Kb.Image2 src={favicon} style={styles.favicon} /> : null}
      <Kb.BoxGrow style={styles.fastStyle}>
        <Kb.Text type="BodySmall" lineClamp={1} style={styles.fastStyle}>
          {siteName}
          {publishTime ? (
            <Kb.Text type="BodySmall"> • Published {formatTimeForMessages(publishTime)}</Kb.Text>
          ) : null}
        </Kb.Text>
      </Kb.BoxGrow>
      {!!onClose && (
        <Kb.Icon
          type="iconfont-close"
          onClick={onClose}
          style={styles.closeBox}
          padding="xtiny"
          className="unfurl-closebox"
          fontSize={12}
        />
      )}
    </Kb.Box2>
  )

  const snippet = description ? (
    <Kb.Text type="Body" lineClamp={5} selectable={true} style={styles.fastStyle}>
      {description}
      {(imageLocation === 'collapsed' || imageLocation === 'bottom') && (
        <>
          {' '}
          <Kb.Icon
            boxStyle={styles.collapseBox}
            noContainer={Kb.Styles.isMobile}
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
          url={mediaUrl || ''}
          linkURL={url}
          height={height || 0}
          width={width || 0}
          widthPadding={Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : undefined}
          style={styles.bottomImage}
          isVideo={isVideo || false}
          autoplayVideo={false}
        />
      </Kb.Box2>
    ) : null

  const rightImage =
    imageLocation === 'side' && mediaUrl ? (
      <Kb.Box2 direction="vertical">
        <Kb.Image2 src={mediaUrl} style={styles.sideImage} />
      </Kb.Box2>
    ) : null

  return (
    <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
      {!Kb.Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
      <Kb.Box2 style={styles.innerContainer} gap="xxtiny" direction="vertical" fullWidth={true}>
        {publisher}
        <Kb.Text type="BodyPrimaryLink" style={styles.url} onClickURL={url}>
          {title}
        </Kb.Text>
        {snippet}
        {bottomImage}
      </Kb.Box2>
      {rightImage}
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bottomImage: Kb.Styles.platformStyles({
        common: {marginTop: Kb.Styles.globalMargins.xtiny},
        isMobile: {alignSelf: 'center'},
      }),
      closeBox: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.fastBlank,
        },
        isElectron: {
          alignSelf: 'flex-start',
          marginLeft: 'auto',
        },
      }),
      collapseBox: Kb.Styles.platformStyles({
        isElectron: {display: 'inline'},
      }),
      container: Kb.Styles.platformStyles({
        common: {alignSelf: 'flex-start', backgroundColor: Kb.Styles.globalColors.fastBlank},
        isElectron: {maxWidth: 500},
        isTablet: {maxWidth: 500},
      }),
      fastStyle: {backgroundColor: Kb.Styles.globalColors.fastBlank},
      favicon: Kb.Styles.platformStyles({
        common: {
          borderRadius: Kb.Styles.borderRadius,
          height: 16,
          width: 16,
        },
      }),
      innerContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          backgroundColor: Kb.Styles.globalColors.fastBlank,
          minWidth: 150,
        },
        isMobile: {
          borderColor: Kb.Styles.globalColors.grey,
          borderRadius: Kb.Styles.borderRadius,
          borderWidth: 1,
          padding: Kb.Styles.globalMargins.xtiny,
        },
      }),
      quoteContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'stretch',
          backgroundColor: Kb.Styles.globalColors.grey,
          paddingLeft: Kb.Styles.globalMargins.xtiny,
        },
      }),
      sideImage: Kb.Styles.platformStyles({
        isElectron: {
          height: 80,
          width: 80,
        },
      }),
      siteNameContainer: Kb.Styles.platformStyles({
        common: {alignSelf: 'flex-start', backgroundColor: Kb.Styles.globalColors.fastBlank},
        isElectron: {minHeight: 16},
        isMobile: {minHeight: 21},
      }),
      url: {
        backgroundColor: Kb.Styles.globalColors.fastBlank,
        ...Kb.Styles.globalStyles.fontSemibold,
      },
    }) as const
)

export default UnfurlGeneric
