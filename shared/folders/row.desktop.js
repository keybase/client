// @flow
import React from 'react'
import type {Folder} from './list'
import {Box, Button, Text, Icon, Avatar, Meta, Usernames} from '../common-adapters'
import type {IconType} from '../common-adapters/icon'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const Avatars = ({styles, users, smallMode, groupAvatar, userAvatar}) => {
  const paddingLR = smallMode ? 4 : 8
  const paddingTB = smallMode ? 8 : 12

  const groupIcon: IconType = smallMode ? styles.groupIcon.small : styles.groupIcon.normal
  return (
    <Box style={{
      ...styles.avatarContainer,
      width: smallMode ? 32 : 48,
      minHeight: smallMode ? 40 : 48,
      paddingTop: paddingTB, paddingBottom: paddingTB,
      paddingLeft: paddingLR, paddingRight: paddingLR}}>
      {groupAvatar
        ? <Icon type={groupIcon} />
        : <Avatar size={smallMode ? 24 : 32} username={userAvatar} />}
    </Box>
  )
}

const Modified = ({smallMode, styles, modified}) => {
  const iconColor = Text._colorStyleBackgroundMode(styles.modifiedMode, 'BodyXSmall')
  const boltStyle = {fontSize: smallMode ? 12 : 14, alignSelf: 'center',
    ...(smallMode ? {marginTop: 2} : {marginLeft: -2, marginRight: 1, marginTop: 2}), ...iconColor}
  return (
    <Box style={stylesModified}>
      <Icon type='iconfont-thunderbolt' style={boltStyle} hint='Modified' />
      <Text type={smallMode ? 'BodyXSmall' : 'BodySmall'} backgroundMode={styles.modifiedMode}>Modified {modified.when} by&nbsp;</Text>
      <Text type={smallMode ? 'BodyXSmallLink' : 'BodySmallLink'} backgroundMode={styles.modifiedMode}>{modified.username}</Text>
    </Box>
  )
}

const RowMeta = ({ignored, meta, styles}) => {
  const metaColors = {
    'new': globalColors.white,
    'rekey': globalColors.white,
  }

  const metaBGColors = {
    'new': globalColors.orange,
    'rekey': globalColors.red,
  }

  const metaProps = meta === 'ignored'
    ? {title: 'ignored', style: styles.ignored}
    : {title: meta || '', style: meta ? {color: metaColors[meta], backgroundColor: metaBGColors[meta]} : {}}

  return <Meta {...metaProps} />
}

const Row = ({users, isPublic, ignored, meta, modified, hasData, smallMode, onOpen, onClick, groupAvatar, userAvatar, onRekey, path}:
  {smallMode: boolean, onOpen: (path: string) => void, onClick: (path: string) => void, onRekey: (path: string) => void} & Folder) => {
  const onOpenClick = event => {
    event.preventDefault()
    event.stopPropagation()
    if (onOpen) {
      onOpen(path)
    }
  }

  const styles = isPublic ? stylesPublic : stylesPrivate

  let backgroundColor = styles.rowContainer.backgroundColor
  if (isPublic && ignored) {
    backgroundColor = globalColors.white_40
  }

  const containerStyle = {
    ...styles.rowContainer,
    minHeight: smallMode ? 40 : 48,
    backgroundColor,
  }

  const icon: IconType = smallMode ? styles.hasStuffIcon.small : styles.hasStuffIcon.normal

  return (
    <Box style={containerStyle} className='folder-row' onClick={() => onClick && onClick(path)}>
      <Box style={stylesLine} />
      <Box style={{...globalStyles.flexBoxRow}}>
        <Avatars users={users} styles={styles} smallMode={smallMode} groupAvatar={groupAvatar} userAvatar={userAvatar} />
        <Box style={stylesBodyContainer}>
          <Usernames users={users} type={smallMode ? 'BodySmallSemibold' : 'BodySemibold'} style={{color: styles.nameColor}} />
          {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
          {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} smallMode={smallMode} />}
        </Box>
        <Box style={{...stylesActionContainer, width: smallMode ? undefined : 112}}>
          {!smallMode && meta !== 'rekey' && <Text
            type='BodySmall' className='folder-row-hover-action' onClick={onOpenClick} style={stylesAction}>Open</Text>}
          {meta === 'rekey' && <Button
            backgroundMode={styles.modifiedMode} small={smallMode} type='Secondary'
            onClick={e => {
              if (onRekey) {
                e.stopPropagation()
                onRekey(path)
              } }} label='Rekey' style={stylesAction} />}
          <Icon type={icon} style={{visibility: hasData ? 'visible' : 'hidden', ...(smallMode && !hasData ? {display: 'none'} : {})}} />
        </Box>
      </Box>
    </Box>
  )
}

const stylesLine = {
  backgroundColor: globalColors.black_10,
  height: 1,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
}

const rowContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  minHeight: 48,
  position: 'relative',
}

const stylesPrivate = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.darkBlue,
    color: globalColors.white,
  },
  hasStuffIcon: {
    small: 'icon-folder-private-has-stuff-24',
    normal: 'icon-folder-private-has-stuff-32',
  },
  ignored: {
    color: globalColors.white_40,
    backgroundColor: 'rgba(0, 26, 51, 0.4)',
  },
  groupIcon: {
    small: 'icon-folder-private-group-24',
    normal: 'icon-folder-private-group-32',
  },
  avatarContainer: {
    backgroundColor: globalColors.darkBlue3,
    backgroundImage: `url(${resolveImageAsURL('icons', 'icon-damier-pattern-good-open.png')})`,
    backgroundRepeat: 'repeat',
  },
  nameColor: globalColors.white,
  modifiedMode: 'Terminal',
}

const stylesPublic = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.white,
    color: globalColors.yellowGreen2,
  },
  hasStuffIcon: {
    small: 'icon-folder-public-has-stuff-24',
    normal: 'icon-folder-public-has-stuff-32',
  },
  ignored: {
    color: globalColors.white_75,
    backgroundColor: globalColors.yellowGreen,
  },
  groupIcon: {
    small: 'icon-folder-public-group-24',
    normal: 'icon-folder-public-group-32',
  },
  avatarContainer: {
    backgroundColor: globalColors.yellowGreen,
  },
  nameColor: globalColors.yellowGreen2,
  modifiedMode: 'Normal',
}

const stylesBodyContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  padding: 8,
  marginRight: 16,
}

const stylesActionContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
}

const stylesAction = {
  ...globalStyles.clickable,
  color: globalColors.white,
  alignSelf: 'center',
}

const stylesModified = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

export default Row
