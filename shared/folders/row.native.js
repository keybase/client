// @flow
import * as React from 'react'
import type {Folder} from './list'
import {Avatar, Box, Text, Icon, MultiAvatar, Meta, ClickableBox} from '../common-adapters/index.native'
import {getStyle} from '../common-adapters/text'
import {globalStyles, globalColors, globalMargins} from '../styles'

const Avatars = ({styles, users, ignored, isPublic, isTeam}) => {
  const goodUsers = !isPublic && users.length > 1 ? users.filter(({you}) => !you) : users
  const avatarCount = Math.min(2, goodUsers.length)
  const opacity = ignored ? 0.5 : 1
  const avatarProps = goodUsers.slice(0, 2).map(({username}, idx) => ({
    borderColor: avatarCount > 1 && idx === 0 ? globalColors.white : undefined,
    loadingColor: globalColors.lightGrey,
    size: 32,
    username,
  }))

  let teamname = 'unknown'
  if (isTeam && goodUsers.length > 0) {
    teamname = goodUsers[0].username
  }

  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 56,
        justifyContent: 'flex-start',
        padding: globalMargins.xtiny,
        width: 56,
      }}
    >

      {isTeam
        ? <Avatar size={40} teamname={teamname} style={{opacity}} />
        : <MultiAvatar singleSize={40} multiSize={32} avatarProps={avatarProps} style={{opacity}} />}
    </Box>
  )
}

const Names = ({styles, users, nameColor, redColor, ignored, isPublic}) => {
  return (
    <Box style={stylesBodyNameContainer}>
      {users.map((u, i) => (
        <Text
          key={u.username}
          type={u.you ? 'BodySemiboldItalic' : 'BodySemibold'}
          style={{
            ...(u.broken
              ? {color: redColor}
              : {color: isPublic ? globalColors.yellowGreen2 : globalColors.darkBlue}),
            opacity: ignored ? 0.6 : 1,
          }}
        >
          {u.username}
          {/* Injecting the commas here so we never wrap and have newlines starting with a , */}
          {i !== users.length - 1 && <Text type="BodySemibold" style={{marginRight: 2}}>,</Text>}
        </Text>
      ))}
    </Box>
  )
}

const Modified = ({styles, modified}) => {
  const iconColor = {color: getStyle('BodySmall', styles.modifiedMode).color}
  return (
    <Box style={stylesModified}>
      <Icon
        type="iconfont-thunderbolt"
        style={{alignSelf: 'center', marginLeft: -2, marginRight: 2, fontSize: 10, ...iconColor}}
        hint="Modified"
      />
      <Text type="BodySmall">Modified {modified.when} by&nbsp;</Text>
      <Text type="BodySmall">{modified.username}</Text>
    </Box>
  )
}

const RowMeta = ({meta, styles}) => {
  if (meta === 'ignored') {
    return
  }

  const metaColors = {
    new: globalColors.white,
    rekey: globalColors.white,
  }

  const metaBGColors = {
    new: globalColors.orange,
    rekey: globalColors.red,
  }

  const metaProps = {
    title: meta || '',
    style: meta ? {color: metaColors[meta], backgroundColor: metaBGColors[meta], marginTop: 2} : {},
  }

  return <Meta {...metaProps} />
}

const Row = ({
  users,
  isPublic,
  isTeam,
  ignored,
  meta,
  modified,
  path,
  onClick,
}: Folder & {onClick: (path: string) => void}) => {
  const styles = isPublic ? stylesPublic : stylesPrivate

  let redColor = globalColors.red

  if (ignored) {
    redColor = globalColors.red_75
  }

  const containerStyle = {
    ...styles.rowContainer,
    backgroundColor: globalColors.white,
  }

  const clickHandler = onClick ? () => onClick(path) : null

  return (
    <ClickableBox onClick={clickHandler}>
      <Box style={containerStyle}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Avatars users={users} isTeam={isTeam} styles={styles} isPublic={isPublic} ignored={ignored} />
          <Box style={stylesBodyContainer}>
            <Names
              users={users}
              styles={styles}
              meta={meta}
              modified={modified}
              redColor={redColor}
              ignored={ignored}
              isPublic={isPublic}
            />
            {meta && !ignored && <RowMeta meta={meta} styles={styles} />}
            {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} />}
          </Box>
          <Box style={stylesActionContainer} />
        </Box>
      </Box>
    </ClickableBox>
  )
}

const rowContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  overflow: 'hidden',
}

const stylesAvatarContainer = {
  width: 48,
  paddingLeft: 8,
  paddingRight: 8,
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.small,
}

const stylesPrivate = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.darkBlue,
  },
  hasStuffIcon: 'icon-folder-private-has-stuff-32',
  ignored: {
    color: globalColors.white_40,
    backgroundColor: 'rgba(0, 26, 51, 0.4)',
  },
  avatarContainer: {
    ...stylesAvatarContainer,
    backgroundColor: globalColors.darkBlue3,
  },
  nameColor: globalColors.white,
  modifiedMode: 'Terminal',
}

const stylesPublic = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.white,
  },
  hasStuffIcon: 'icon-folder-public-has-stuff-32',
  ignored: {
    color: globalColors.white_75,
    backgroundColor: globalColors.yellowGreen,
  },
  avatarContainer: {
    ...stylesAvatarContainer,
    backgroundColor: globalColors.yellowGreen,
  },
  nameColor: globalColors.yellowGreen,
  modifiedMode: 'Normal',
}

const stylesBodyContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  paddingRight: globalMargins.tiny,
}

const stylesBodyNameContainer = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
}

const stylesActionContainer = {
  ...globalStyles.flexBoxRow,
  height: 64,
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
}

const stylesModified = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

export default Row
