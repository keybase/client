// @flow
import React from 'react'
import type {Folder} from './list'
import {Box, Button, Text, Icon, Avatar, Meta, Usernames} from '../common-adapters'
import type {IconType} from '../common-adapters/icon'
import {globalStyles, globalColors, backgroundURL} from '../styles/style-guide'

const Avatars = ({styles, users, smallMode, groupAvatar, userAvatar, ignored}) => {
  const boxStyle = {
    width: smallMode ? 32 : 48,
    minHeight: smallMode ? 40 : 48,
    paddingTop: smallMode ? 8 : 12,
    paddingBottom: smallMode ? 8 : 12,
    paddingLeft: smallMode ? 4 : 8,
    paddingRight: smallMode ? 4 : 8,
  }

  const groupIcon: IconType = smallMode ? styles.groupIcon.small : styles.groupIcon.normal
  return (
    <Box style={{...styles.avatarContainer, ...boxStyle}}>
      {groupAvatar
        ? <Icon type={groupIcon} style={ignored ? {opacity: 0.5} : {}} />
        : <Avatar size={smallMode ? 24 : 32} username={userAvatar} opacity={ignored ? 0.5 : 1.0}
          hasBackgroundColor={styles.rowContainer.backgroundColor} />}
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

type RowType = {smallMode: boolean, onOpen: (path: string) => void, onClick: (path: string) => void, onRekey: (path: string) => void}
const Row = ({users, isPublic, ignored, meta, modified, hasData, smallMode,
  onOpen, onClick, groupAvatar, userAvatar, onRekey, path}: RowType & Folder) => {
  const onOpenClick = event => {
    event.preventDefault()
    event.stopPropagation()
    if (onOpen) {
      onOpen(path)
    }
  }

  const styles = isPublic ? stylesPublic : stylesPrivate

  let backgroundColor = styles.rowContainer.backgroundColor
  if (ignored) {
    backgroundColor = isPublic ? globalColors.white_40 : globalColors.darkBlue4
  }

  const containerStyle = {
    ...styles.rowContainer,
    minHeight: smallMode ? 40 : 48,
    backgroundColor,
  }

  const icon: IconType = smallMode ? styles.hasStuffIcon.small : styles.hasStuffIcon.normal

  return (
    <Box style={containerStyle} className='folder-row' onClick={() => onClick && onClick(path)}>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Avatars users={users} styles={styles} smallMode={smallMode} groupAvatar={groupAvatar} userAvatar={userAvatar} ignored={ignored} />
        <Box style={stylesBodyContainer}>
          <Usernames users={users} type={smallMode ? 'BodySmallSemibold' : 'BodySemibold'} style={{color: styles.nameColor}} />
          {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
          {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} smallMode={smallMode} />}
        </Box>
        <Box style={{...stylesActionContainer, width: smallMode ? undefined : 112}}>
          {!smallMode && meta !== 'rekey' && <Text
            type='BodySmall' className='folder-row-hover-action' onClick={onOpenClick} style={styles.action}>Open</Text>}
          {meta === 'rekey' && <Button
            backgroundMode={styles.modifiedMode} small={smallMode} type='Secondary'
            onClick={e => {
              if (onRekey) {
                e.stopPropagation()
                onRekey(path)
              } }} label='Rekey' style={styles.action} />}
          <Icon type={icon} style={{visibility: hasData ? 'visible' : 'hidden', ...(smallMode && !hasData ? {display: 'none'} : {})}} />
        </Box>
      </Box>
      <Box style={{height: 1, backgroundColor: globalColors.black_05, position: 'absolute', bottom: 0, left: 0, right: 0}} />
    </Box>
  )
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
    background: `${backgroundURL('icons', 'icon-damier-pattern-good-open.png')} ${globalColors.darkBlue3} repeat`,
  },
  nameColor: globalColors.white,
  modifiedMode: 'Terminal',
  action: {
    ...globalStyles.clickable,
    alignSelf: 'center',
    color: globalColors.white,
  },
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
  action: {
    ...globalStyles.clickable,
    alignSelf: 'center',
    color: globalColors.black_60,
  },
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

const stylesModified = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

export default Row
