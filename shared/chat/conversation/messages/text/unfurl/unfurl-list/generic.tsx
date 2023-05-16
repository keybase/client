import * as Container from '../../../../../../util/container'
import * as Kb from '../../../../../../common-adapters/index'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../../../styles'
import UnfurlImage from './image'
import shallowEqual from 'shallowequal'
import {ConvoIDContext, OrdinalContext} from '../../../ids-context'
import {formatTimeForMessages} from '../../../../../../util/timestamp'
import {getUnfurlInfo, useActions} from './use-redux'

const UnfurlGeneric = React.memo(function UnfurlGeneric(p: {idx: number}) {
  const {idx} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const data = Container.useSelector(state => {
    const {unfurl, isCollapsed, unfurlMessageID, youAreAuthor} = getUnfurlInfo(
      state,
      conversationIDKey,
      ordinal,
      idx
    )
    if (unfurl?.unfurlType !== RPCChatTypes.UnfurlType.generic) {
      return null
    }
    const {generic} = unfurl
    const {description, publishTime, favicon, media, siteName, title, url} = generic
    const {height, width, isVideo, url: mediaUrl} = media || {height: 0, isVideo: false, url: '', width: 0}
    const showImageOnSide =
      !Styles.isMobile && height >= width && !isVideo && (title.length > 0 || !!description)
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
  }, shallowEqual)

  const {onClose, onToggleCollapse} = useActions(
    conversationIDKey,
    data?.youAreAuthor ?? false,
    data?.unfurlMessageID ?? 0,
    ordinal
  )

  if (!data) return null

  const {description, favicon, height, isCollapsed, isVideo, publishTime} = data
  const {siteName, title, url, width, imageLocation, mediaUrl} = data

  const publisher = (
    <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
      {favicon ? <Kb.Image src={favicon} style={styles.favicon} /> : null}
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
            noContainer={Styles.isMobile}
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
          widthPadding={Styles.isMobile ? Styles.globalMargins.tiny : undefined}
          style={styles.bottomImage}
          isVideo={isVideo || false}
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
    <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
      {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bottomImage: Styles.platformStyles({
        common: {marginTop: Styles.globalMargins.xtiny},
        isMobile: {alignSelf: 'center'},
      }),
      closeBox: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.fastBlank,
        },
        isElectron: {
          alignSelf: 'flex-start',
          marginLeft: 'auto',
        },
      }),
      collapseBox: Styles.platformStyles({
        isElectron: {display: 'inline'},
      }),
      container: Styles.platformStyles({
        common: {alignSelf: 'flex-start', backgroundColor: Styles.globalColors.fastBlank},
        isElectron: {maxWidth: 500},
      }),
      fastStyle: {backgroundColor: Styles.globalColors.fastBlank},
      favicon: Styles.platformStyles({
        common: {
          borderRadius: Styles.borderRadius,
          height: 16,
          width: 16,
        },
      }),
      innerContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          backgroundColor: Styles.globalColors.fastBlank,
          minWidth: 150,
        },
        isMobile: {
          borderColor: Styles.globalColors.grey,
          borderRadius: Styles.borderRadius,
          borderWidth: 1,
          padding: Styles.globalMargins.xtiny,
        },
      }),
      quoteContainer: Styles.platformStyles({
        common: {
          alignSelf: 'stretch',
          backgroundColor: Styles.globalColors.grey,
          paddingLeft: Styles.globalMargins.xtiny,
        },
      }),
      sideImage: Styles.platformStyles({
        isElectron: {
          height: 80,
          width: 80,
        },
      }),
      siteNameContainer: Styles.platformStyles({
        common: {alignSelf: 'flex-start', backgroundColor: Styles.globalColors.fastBlank},
        isElectron: {minHeight: 16},
        isMobile: {minHeight: 21},
      }),
      url: {
        backgroundColor: Styles.globalColors.fastBlank,
        ...Styles.globalStyles.fontSemibold,
      },
    } as const)
)

export default UnfurlGeneric
