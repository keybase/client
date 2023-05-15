import * as Container from '../../../../../../util/container'
import * as Kb from '../../../../../../common-adapters/index'
import * as React from 'react'
import * as Styles from '../../../../../../styles'
import UnfurlImage from './image'
import shallowEqual from 'shallowequal'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import {ConvoIDContext, OrdinalContext} from '../../../ids-context'
import {getUnfurlInfo, useActions} from './use-redux'

const UnfurlGiphy = React.memo(function UnfurlGiphy(p: {idx: number}) {
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
    if (unfurl?.unfurlType !== RPCChatTypes.UnfurlType.giphy) {
      return null
    }
    const {giphy} = unfurl
    const {favicon, video} = giphy
    const {height, url, width} = video || {height: 0, url: '', width: 0}

    return {
      favicon: favicon?.url,
      height,
      isCollapsed,
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

  if (data === null) return null

  const {favicon, isCollapsed, url, width, height} = data

  return (
    <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
      {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
      <Kb.Box2 style={styles.innerContainer} gap="xtiny" direction="vertical">
        <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
          <Kb.Box2 direction="horizontal" gap="tiny">
            {favicon ? <Kb.Image src={favicon} style={styles.favicon} /> : null}
            <Kb.Text type="BodySmall" style={styles.fastStyle}>
              Giphy
            </Kb.Text>
            <Kb.Icon
              boxStyle={styles.collapseBox}
              style={styles.collapse}
              onClick={onToggleCollapse}
              sizeType="Tiny"
              type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
            />
          </Kb.Box2>
          {onClose ? (
            <Kb.Icon
              type="iconfont-close"
              boxStyle={styles.fastStyle}
              onClick={onClose}
              className="unfurl-closebox"
              padding="xtiny"
              fontSize={12}
            />
          ) : null}
        </Kb.Box2>
        {isCollapsed ? null : (
          <UnfurlImage url={url} height={height} width={width} isVideo={true} autoplayVideo={true} />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      collapse: Styles.platformStyles({
        isElectron: {
          position: 'relative',
          top: Styles.globalMargins.xxtiny,
        },
        isMobile: {
          alignSelf: 'center',
        },
      }),
      collapseBox: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.fastBlank,
      },
      container: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
        },
        isElectron: {
          maxWidth: 500,
        },
      }),
      fastStyle: {backgroundColor: Styles.globalColors.fastBlank},
      favicon: {
        borderRadius: Styles.borderRadius,
        height: 16,
        width: 16,
      },
      imageContainer: Styles.platformStyles({
        isMobile: {
          alignSelf: 'flex-start',
          padding: Styles.globalMargins.xxtiny,
        },
      }),
      innerContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          minWidth: 150,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.fastBlank,
          borderColor: Styles.globalColors.grey,
          borderRadius: Styles.borderRadius,
          borderWidth: 1,
          padding: Styles.globalMargins.xtiny,
        },
      }),
      quoteContainer: {
        alignSelf: 'stretch',
        backgroundColor: Styles.globalColors.grey,
        paddingLeft: Styles.globalMargins.xtiny,
      },
      siteNameContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          justifyContent: 'space-between',
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.xxtiny,
          paddingLeft: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default UnfurlGiphy
