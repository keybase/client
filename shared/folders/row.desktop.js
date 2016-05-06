import React from 'react'
import type {Folder} from './render'
import {Box, Text, Icon, Avatar, Meta} from '../common-adapters'
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
    <Text type='BodySmall' backgroundMode='terminal'>Modified {modified.when} by&nbsp;</Text>
    <Text type='BodySmall' backgroundMode='terminal' style={{color: globalColors.white}}>{modified.username}</Text>
  </Box>
)

const Row = ({users, icon, isPublic, ignored, isFirst, meta, modified}: Folder) => {
  const containerStyle = {
    ...rowContainer,
    ...(isPublic ? rowContainerPublic : rowContainerPrivate),
    ...(isFirst ? {borderBottom: undefined} : {})}

  const metaProps = {
    title: ignored ? 'ignored' : meta,
    style: {
      color: ignored ? globalColors.white_40 : globalColors.white,
      backgroundColor: ignored ? 'rgba(0, 26, 51, 0.4)' : globalColors.blue2
    }
  }

  return (
    <Box style={containerStyle} className='folder-row'>
      <Avatars users={users} isPublic={isPublic} />
      <Box style={stylesBodyContainer}>
        <Names users={users} isPublic={isPublic} meta={meta} modified={modified} />
        {metaProps.title && <Meta {...metaProps} />}
        {!metaProps.title && modified && <Modified modified={modified} />}
      </Box>
      <Box style={stylesActionContainer} className='folder-row-hover-action'>
        <Text type='BodySmall' style={{...globalStyles.clickable, color: globalColors.white}}>Open</Text>
      </Box>
    </Box>
  )
}

const rowContainer = {
  ...globalStyles.flexBoxRow,
  minHeight: 48,
  borderTop: `solid 1px ${globalColors.black_10}`
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

const stylesAvatarContainerPublic = {}

const stylesAvatarContainerPrivate = {
  backgroundColor: globalColors.darkBlue3,
  backgroundImage: `url(${resolveImageAsURL('icons', 'damier-pattern-good-open.png')})`,
  backgroundRepeat: 'repeat'
}

const stylesBodyContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  padding: 8
}

const stylesBodyNameContainer = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap'
}

const stylesActionContainer = {
  ...globalStyles.flexBoxRow,
  padding: 8,
  alignItems: 'flex-start',
  justifyContent: 'center',
  width: 96,
  marginLeft: 16,
  marginRight: 16
}

const stylesModified = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center'
}

export default Row

