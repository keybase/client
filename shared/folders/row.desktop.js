// @flow
import React from 'react'
import type {Folder} from './render'
import {Box, Text, Icon, Avatar, Meta} from '../common-adapters'
import type {Props as IconProps} from '../common-adapters/icon'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const Avatars = ({isPublic, users}) => (
  <Box style={{...stylesAvatarContainer, ...(isPublic ? stylesAvatarContainerPublic : stylesAvatarContainerPrivate)}}>
    {
      users.length === 1 || users.length === 2
      ? <Avatar size={32} username={users[users.length - 1].username} />
      : <Icon type={isPublic ? 'folder-public-group-32' : 'folder-private-group-32'} />}
  </Box>
)

const Divider = ({normalColor}) => (
  <Text type='BodySemibold' style={{color: normalColor, marginRight: 2}}>,</Text>
)

const Names = ({isPublic, users}) => {
  const normalColor = isPublic ? globalColors.yellowGreen : globalColors.white
  return (
    <Box style={stylesBodyNameContainer}>
      {users.map((u, i) => (
        <Text
          key={u.username}
          type='BodySemibold'
          style={{color: u.broken ? globalColors.red : normalColor}}>{u.username}
          {
            (i === users.length - 1)  // Injecting the commas here so we never wrap and have newlines starting with a ,
            ? null
            : <Divider normalColor={normalColor} />
          }
        </Text>
      ))}
    </Box>
  )
}

const Modified = ({modified}) => (
  <Box style={stylesModified}>
    <Icon type='thunderbolt' style={{marginRight: 5}} />
    <Text type='BodySmall' backgroundMode='Terminal'>Modified {modified.when} by&nbsp;</Text>
    <Text type='BodySmall' backgroundMode='Terminal' style={{color: globalColors.white}}>{modified.username}</Text>
  </Box>
)

const RowMeta = ({ignored, meta, isPublic}) => {
  const metaColors = {
    'new': globalColors.white,
    'rekey': globalColors.white
  }

  const metaBGColors = {
    'new': globalColors.blue2,
    'rekey': globalColors.red
  }

  const metaProps = {
    title: ignored ? 'ignored' : meta || '',
    style: {
      color: meta ? metaColors[meta] : isPublic ? globalColors.white_75 : globalColors.white_40,
      backgroundColor: meta ? metaBGColors[meta] : isPublic ? globalColors.yellowGreen : 'rgba(0, 26, 51, 0.4)'
    }
  }
  return (
    <Meta {...metaProps} />
  )
}

const Row = ({users, isPublic, ignored, isFirst, meta, modified, hasData}: Folder) => {
  const containerStyle = {
    ...rowContainer,
    ...(isPublic ? rowContainerPublic : rowContainerPrivate),
    ...(isFirst ? {borderBottom: undefined} : {})}

  const icon: IconProps.type = `folder-${isPublic ? 'public' : 'private'}-has-stuff-32`

  return (
    <Box style={containerStyle} className='folder-row'>
      {!isFirst && <Box style={{backgroundColor: globalColors.black_10, height: 1, position: 'absolute', top: 0, left: 0, right: 0}} />}
      <Box style={{...globalStyles.flexBoxRow}}>
        <Avatars users={users} isPublic={isPublic} />
        <Box style={stylesBodyContainer}>
          <Names users={users} isPublic={isPublic} meta={meta} modified={modified} />
          {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} isPublic={isPublic} />}
          {!(meta || ignored) && modified && <Modified modified={modified} />}
        </Box>
        <Box style={stylesActionContainer}>
          <Text type='BodySmall' className='folder-row-hover-action' style={stylesAction}>Open</Text>
          <Icon type={icon} style={{visibility: hasData ? 'visible' : 'hidden', width: 32}} />
        </Box>
      </Box>
    </Box>
  )
}

const rowContainer = {
  ...globalStyles.flexBoxColumn,
  minHeight: 48,
  position: 'relative'
}

const rowContainerPublic = {
  backgroundColor: globalColors.white,
  color: globalColors.yellowGreen2
}

const rowContainerPrivate = {
  backgroundColor: globalColors.darkBlue,
  color: globalColors.white
}

const stylesAvatarContainer = {
  width: 48,
  minHeight: 48,
  padding: 8
}

const stylesAvatarContainerPublic = {
  backgroundColor: globalColors.yellowGreen
}

const stylesAvatarContainerPrivate = {
  backgroundColor: globalColors.darkBlue3,
  backgroundImage: `url(${resolveImageAsURL('icons', 'damier-pattern-good-open.png')})`,
  backgroundRepeat: 'repeat'
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

