// @flow
import React from 'react'
import type {Folder} from './list'
import {Box, Text, Icon, Avatar, Meta} from '../common-adapters'
import type {Props as IconProps} from '../common-adapters/icon'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const Avatars = ({styles, users}) => (
  <Box style={styles.avatarContainer}>
    {users.length === 1 || users.length === 2
      ? <Avatar size={32} username={users[users.length - 1].username} />
      : <Icon type={styles.groupIcon} />}
  </Box>
)

const Names = ({styles, users}) => {
  return (
    <Box style={stylesBodyNameContainer}>
      {users.map((u, i) => (
        <Text
          key={u.username}
          type={u.you ? 'BodySemiboldItalic' : 'BodySemibold'}
          style={{color: u.broken ? globalColors.red : styles.nameColor}}>{u.username}
          {
            (i !== users.length - 1) && // Injecting the commas here so we never wrap and have newlines starting with a ,
              <Text type='BodySemibold' style={{color: styles.nameColor, marginRight: 2}}>,</Text>}
        </Text>
      ))}
    </Box>
  )
}

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
    'new': globalColors.blue2,
    'rekey': globalColors.red
  }

  const metaProps = ignored
    ? {title: 'ignored', style: styles.ignored}
    : {title: meta || '', style: {color: metaColors[meta], backgroundColor: metaBGColors[meta]}}

  return <Meta {...metaProps} />
}

const Row = ({users, isPublic, ignored, isFirst, meta, modified, hasData}: Folder) => {
  const styles = isPublic ? stylesPublic : stylesPrivate

  const containerStyle = {
    ...styles.rowContainer,
    ...(isFirst && {borderBottom: undefined})}

  const icon: IconProps.type = styles.hasStuffIcon

  return (
    <Box style={containerStyle} className='folder-row'>
      {!isFirst && <Box style={stylesLine} />}
      <Box style={{...globalStyles.flexBoxRow}}>
        <Avatars users={users} styles={styles} />
        <Box style={stylesBodyContainer}>
          <Names users={users} styles={styles} meta={meta} modified={modified} />
          {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
          {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} />}
        </Box>
        <Box style={stylesActionContainer}>
          <Text type='BodySmall' className='folder-row-hover-action' style={stylesAction}>Open</Text>
          <Icon type={icon} style={{visibility: hasData ? 'visible' : 'hidden', width: 32}} />
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
  minHeight: 48,
  position: 'relative'
}

const stylesAvatarContainer = {
  width: 48,
  minHeight: 48,
  padding: 8
}

const stylesPrivate = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.darkBlue,
    color: globalColors.white
  },
  hasStuffIcon: 'folder-private-has-stuff-32',
  ignored: {
    color: globalColors.white_40,
    backgroundColor: 'rgba(0, 26, 51, 0.4)'
  },
  groupIcon: 'folder-private-group-32',
  avatarContainer: {
    ...stylesAvatarContainer,
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
  hasStuffIcon: 'folder-public-has-stuff-32',
  ignored: {
    color: globalColors.white_75,
    backgroundColor: globalColors.yellowGreen
  },
  groupIcon: 'folder-public-group-32',
  avatarContainer: {
    ...stylesAvatarContainer,
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

const stylesBodyNameContainer = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap'
}

const stylesActionContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  width: 112
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

