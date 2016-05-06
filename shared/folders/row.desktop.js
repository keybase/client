import React from 'react'
import type {Folder} from './render'
import {Box, Text, Icon, Avatar, Meta} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const Avatars = ({isPublic, users}) => (
  <Box style={{...stylesAvatarContainer, ...(isPublic ? stylesAvatarContainerPublic : stylesAvatarContainerPrivate)}}>
    {users.length === 1
      ? <Avatar size={32} username={users[0]} />
      : <Icon type={isPublic ? 'folder-public-group-32' : 'folder-private-group-32'} />}
  </Box>
)

const Divider = ({normalColor}) => (
  <Text type='BodySemibold' style={{color: normalColor, marginRight: 2}}>,</Text>
)

const Names = ({isPublic, users}) => {
  const normalColor = isPublic ? globalColors.yellowGreen : globalColors.white
  return (
    <Box style={stylesBodyContainer}>
      <Box style={stylesBodyNameContainer}>
        {
          users.map((u, i) => (
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
          ))
        }
      </Box>
      <Meta title='NEW' style={{backgroundColor: globalColors.blue2}} />
    </Box>
  )
}

const Row = ({users, icon, isPublic, ignored, isFirst, meta, modified}: Folder) => {
  const containerStyle = {
    ...rowContainer,
    ...(isPublic ? rowContainerPublic : rowContainerPrivate),
    ...(isFirst ? {borderBottom: undefined} : {})}

  return (
    <Box style={containerStyle}>
      <Avatars users={users} isPublic={isPublic} />
      <Names users={users} isPublic={isPublic} meta={meta} modified={modified} />
      <Box style={stylesActionContainer} />
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
  justifyContents: 'center',
  padding: 8
}

const stylesBodyNameContainer = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap'
}

const stylesActionContainer = {
  width: 96,
  height: 48,
  marginLeft: 16,
  marginRight: 16
}

export default Row

