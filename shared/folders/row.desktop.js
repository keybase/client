// @flow
import React from 'react'
import type {Folder} from './list'
import {Box, Text, Icon, Avatar, Meta, Usernames} from '../common-adapters'
import type {Props as IconProps} from '../common-adapters/icon'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const Avatars = ({styles, users, smallMode, groupAvatar, userAvatar}) => (
  <Box style={{
    ...styles.avatarContainer,
    width: smallMode ? 32 : 48,
    minHeight: 48, paddingTop: 12, paddingBottom: 12,
    paddingLeft: smallMode ? 4 : 8, paddingRight: smallMode ? 4 : 8}}>
    {groupAvatar
      ? <Icon type={smallMode ? styles.groupIcon.small : styles.groupIcon.normal} />
      : <Avatar size={smallMode ? 24 : 32} username={userAvatar} />}
  </Box>
)

const Modified = ({styles, modified}) => (
  <Box style={stylesModified}>
    <Icon type='thunderbolt' style={{marginRight: 5}} />
    <Text type='BodySmall' backgroundMode={styles.modifiedMode}>Modified {modified.when} by&nbsp;</Text>
    <Text type='BodySmallLink' backgroundMode={styles.modifiedMode}>{modified.username}</Text>
  </Box>
)

const RowMeta = ({ignored, meta, styles}) => {
  const metaColors = {
    'new': globalColors.white,
    'rekey': globalColors.white
  }

  const metaBGColors = {
    'new': globalColors.orange,
    'rekey': globalColors.red
  }

  const metaProps = ignored
    ? {title: 'ignored', style: styles.ignored}
    : {title: meta || '', style: {color: metaColors[meta], backgroundColor: metaBGColors[meta]}}

  return <Meta {...metaProps} />
}

const Row = ({users, isPublic, ignored, meta, modified, hasData, smallMode, onClick, groupAvatar, userAvatar}:
             {smallMode?: boolean, onClick: (path: string) => void} & Folder) => {
  const styles = isPublic ? stylesPublic : stylesPrivate

  const containerStyle = {
    ...styles.rowContainer
  }

  const icon: IconProps.type = smallMode ? styles.hasStuffIcon.small : styles.hasStuffIcon.normal

  return (
    <Box style={containerStyle} className='folder-row' onClick={() => {
      if (onClick) {
        const path = `/keybase/${isPublic ? 'public' : 'private'}/${users.map(u => u.username).join(',')}`
        onClick(path)
      } }}>
      <Box style={stylesLine} />
      <Box style={{...globalStyles.flexBoxRow}}>
        <Avatars users={users} styles={styles} smallMode={smallMode} groupAvatar={groupAvatar} userAvatar={userAvatar} />
        <Box style={stylesBodyContainer}>
          <Usernames users={users} type='BodySemibold' style={{color: styles.nameColor}} />
          {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
          {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} />}
        </Box>
        <Box style={{...stylesActionContainer, width: smallMode ? undefined : 112}}>
          {!smallMode && <Text type='BodySmall' className='folder-row-hover-action' style={stylesAction}>Open</Text>}
          <Icon type={icon} style={{visibility: hasData ? 'visible' : 'hidden'}} />
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
  right: 0
}

const rowContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  minHeight: 48,
  position: 'relative'
}

const stylesPrivate = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.darkBlue,
    color: globalColors.white
  },
  hasStuffIcon: {
    small: 'folder-private-has-stuff-24',
    normal: 'folder-private-has-stuff-32'
  },
  ignored: {
    color: globalColors.white_40,
    backgroundColor: 'rgba(0, 26, 51, 0.4)'
  },
  groupIcon: {
    small: 'folder-private-group-24',
    normal: 'folder-private-group-32'
  },
  avatarContainer: {
    backgroundColor: globalColors.darkBlue3,
    backgroundImage: `url(${resolveImageAsURL('icons', 'damier-pattern-good-open.png')})`,
    backgroundRepeat: 'repeat'
  },
  nameColor: globalColors.white,
  modifiedMode: 'Terminal'
}

const stylesPublic = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.white,
    color: globalColors.yellowGreen2
  },
  hasStuffIcon: {
    small: 'folder-public-has-stuff-24',
    normal: 'folder-public-has-stuff-32'
  },
  ignored: {
    color: globalColors.white_75,
    backgroundColor: globalColors.yellowGreen
  },
  groupIcon: {
    small: 'folder-public-group-24',
    normal: 'folder-public-group-32'
  },
  avatarContainer: {
    backgroundColor: globalColors.yellowGreen
  },
  nameColor: globalColors.yellowGreen,
  modifiedMode: 'Normal'
}

const stylesBodyContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  padding: 8,
  marginRight: 16
}

const stylesActionContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-end'
}

const stylesAction = {
  ...globalStyles.clickable,
  color: globalColors.white,
  alignSelf: 'center'
}

const stylesModified = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center'
}

export default Row

