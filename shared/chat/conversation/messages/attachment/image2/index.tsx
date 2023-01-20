import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Container from '../../../../../util/container'
import {GetIdsContext} from '../../ids-context'
import ImageImpl from './imageimpl'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted?: boolean
}

const useActions = (p: {isCollapsed: boolean; downloadPath: string}) => {
  const {isCollapsed, downloadPath} = p
  const dispatch = Container.useDispatch()
  const getIds = React.useContext(GetIdsContext)

  const onClick = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createAttachmentPreviewSelect({conversationIDKey, ordinal}))
  }, [dispatch, getIds])
  const onDoubleClick = onClick
  const onCollapse = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(
      Chat2Gen.createToggleMessageCollapse({
        collapse: !isCollapsed,
        conversationIDKey,
        messageID: ordinal,
      })
    )
  }, [dispatch, isCollapsed, getIds])
  const onRetry = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createAttachmentDownload({conversationIDKey, ordinal}))
  }, [dispatch, getIds])
  const onShowInFinder = Container.useEvent((e: React.BaseSyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadPath}))
  })

  return {
    onClick,
    onCollapse,
    onDoubleClick,
    onRetry,
    onShowInFinder,
  }
}

const Label = (p: {filename: string; onCollapse: () => void; isCollapsed: boolean}) => {
  const {filename, onCollapse, isCollapsed} = p
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.fileNameContainer}>
      <Kb.Text type="BodyTiny" lineClamp={1} style={styles.filename}>
        {filename}
      </Kb.Text>
      <Kb.Icon
        boxStyle={styles.collapseBox}
        style={styles.collapse}
        onClick={onCollapse}
        sizeType="Tiny"
        type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
      />
    </Kb.Box2>
  )
}

const ShowInFinder = (p: {onShowInFinder: (e: React.BaseSyntheticEvent) => void}) => {
  const {onShowInFinder} = p
  return (
    <Kb.Text
      type="BodySmallPrimaryLink"
      onClick={onShowInFinder}
      style={styles.link}
      className={'hover-underline'}
    >
      Show in {Styles.fileUIName}
    </Kb.Text>
  )
}

const Video = () => {
  return null
}

const Title = (p: {title: string; isHighlighted: boolean; isEditing: boolean}) => {
  const {title, isHighlighted, isEditing} = p
  const containerStyle = isHighlighted ? styles.highlighted : isEditing ? styles.sentEditing : styles.sent

  const styleOverride = React.useMemo(() => {
    return Styles.isMobile
      ? {
          paragraph: {
            ...containerStyle,
            backgroundColor: Styles.globalColors.black_05_on_white,
          },
        }
      : undefined
  }, [containerStyle])

  return (
    <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.title])} alignItems="flex-start">
      <Kb.Markdown
        messageType="attachment"
        selectable={true}
        style={containerStyle}
        styleOverride={styleOverride as any}
        allowFontScaling={true}
      >
        {title}
      </Kb.Markdown>
    </Kb.Box2>
  )
}

const Overlay = (p: {height: number; width: number}) => {
  const {width, height} = p

  // TEMP
  const showButton = true
  const videoDuration = '1:00'
  const arrowColor = 'red'
  const loaded = false
  // TEMP

  return (
    <Kb.Box style={Styles.collapseStyles([styles.absoluteContainer, {height, width}])}>
      {showButton ? (
        <Kb.Icon type={showButton ? 'icon-play-64' : 'icon-film-64'} style={styles.playButton} />
      ) : null}
      {videoDuration.length > 0 && loaded && (
        <Kb.Box style={styles.durationContainer}>
          <Kb.Text type="BodyTinyBold" style={styles.durationText}>
            {videoDuration}
          </Kb.Text>
        </Kb.Box>
      )}
      {arrowColor && (
        <Kb.Box style={styles.downloadedIconWrapper}>
          <Kb.Icon type="iconfont-download" style={styles.downloadIcon} color={arrowColor} />
        </Kb.Box>
      )}
      {!loaded && (
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          style={Styles.collapseStyles([styles.absoluteContainer, {height, width}])}
        >
          <Kb.ProgressIndicator style={styles.progress} />
        </Kb.Box2>
      )}
    </Kb.Box>
  )
}

const Image2 = React.memo(function Image2(p: Props) {
  const {isHighlighted, toggleMessageMenu} = p

  const [showOverlay, setShowOverlay] = React.useState(true)
  // TEMP
  const isEditing = false // TEMP
  const isCollapsed = false
  const downloadPath = ''
  const filename = 'filename'
  const title = 'title'
  const height = 100
  const width = 100
  // end temp

  const {onClick, onCollapse, onDoubleClick, onRetry, onShowInFinder} = useActions({
    downloadPath,
    isCollapsed,
  })

  const containerStyle = isHighlighted ? styles.highlighted : isEditing ? styles.sentEditing : styles.sent
  // mobileImageFilename ? 'Image from mobile' : this.props.fileName
  // <ShowToastAfterSaving transferState={this.props.transferState} />
  //

  const content = isCollapsed ? null : (
    <Kb.Box2 direction="vertical" alignItems="center">
      <Kb.ClickableBox onClick={onClick} onDoubleClick={onDoubleClick} onLongPress={toggleMessageMenu}>
        <Kb.Box2
          direction="vertical"
          alignItems="center"
          style={{
            height,
            margin: 3,
            overflow: 'hidden',
            width,
          }}
        >
          <ImageImpl />
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle}>
      {filename ? <Label onCollapse={onCollapse} isCollapsed={isCollapsed} filename={filename} /> : null}
      {content}
      {showOverlay ? <Overlay height={height} width={width} /> : null}
      {title ? <Title title={title} isEditing={isEditing} isHighlighted={isHighlighted} /> : null}
      {downloadPath ? <ShowInFinder onShowInFinder={onShowInFinder} /> : null}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(() => {
  const editing = {
    backgroundColor: Styles.globalColors.yellowLight,
    borderRadius: 2,
    color: Styles.globalColors.blackOrBlack,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  }
  const sent = Styles.platformStyles({
    isElectron: {
      // Make text selectable. On mobile we implement that differently.
      cursor: 'text',
      userSelect: 'text',
      whiteSpace: 'pre-wrap',
      width: '100%',
      wordBreak: 'break-word',
    } as const,
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
    },
  })
  const sentEditing = {
    ...sent,
    ...editing,
  }
  const pendingFail = {
    ...sent,
  }
  const pendingFailEditing = {
    ...pendingFail,
    ...editing,
  }
  return {
    collapse: Styles.platformStyles({isMobile: {alignSelf: 'center'}}),
    collapseBox: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
    },
    editing,
    absoluteContainer: {position: 'absolute'},
    fileNameContainer: {paddingRight: Styles.globalMargins.small},
    filename: {backgroundColor: Styles.globalColors.fastBlank},
    link: {color: Styles.globalColors.black_50},
    highlighted: {
      ...sent,
      color: Styles.globalColors.blackOrBlack,
    },
    pendingFail,
    playButton: {
      bottom: '50%',
      left: '50%',
      marginBottom: -32,
      marginLeft: -32,
      marginRight: -32,
      marginTop: -32,
      position: 'absolute',
      right: '50%',
      top: '50%',
    },
    durationContainer: {
      alignSelf: 'flex-start',
      backgroundColor: Styles.globalColors.black_50,
      borderRadius: 2,
      bottom: Styles.globalMargins.tiny,
      padding: 1,
      position: 'absolute',
      right: Styles.globalMargins.tiny,
    },
    durationText: {
      color: Styles.globalColors.white,
      paddingLeft: 3,
      paddingRight: 3,
    },
    pendingFailEditing,
    sent,
    sentEditing,
    downloadedIconWrapper: {
      ...Styles.globalStyles.flexBoxCenter,
      backgroundColor: Styles.globalColors.fastBlank,
      borderRadius: 20,
      bottom: 0,
      padding: 3,
      position: 'absolute',
      right: 0,
    },
    progress: {width: 48},
    downloadIcon: {
      maxHeight: 14,
      position: 'relative',
      top: 1,
    },
    title: Styles.platformStyles({
      common: {
        alignSelf: 'flex-start',
        padding: 5,
      },
      isElectron: {
        display: 'block',
        wordBreak: 'break-word',
      },
    }),
  } as const
})

export default Image2
