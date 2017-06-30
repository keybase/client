// @flow
import React from 'react'
import type {Folder} from './list'
import type {IconType} from '../common-adapters/icon'
import {Box, Text, Icon, MultiAvatar, Meta, ClickableBox} from '../common-adapters/index.native'
import {getStyle} from '../common-adapters/text'
import {globalStyles, globalColors, globalMargins} from '../styles'

const Avatars = ({styles, users, ignored, isPublic}) => {
  if (!isPublic && users.length > 1) {
    users = users.filter(({you}) => !you)
  }
  const avatarCount = Math.min(2, users.length)
  const opacity = ignored ? 0.5 : 1
  const avatarProps = users.slice(0, 2).map(({username}, idx) => ({
    borderColor: avatarCount > 1 && idx === 0 ? globalColors.white : undefined,
    loadingColor: globalColors.lightGrey,
    size: 32,
    username,
  }))

  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        maxWidth: 56,
        minWidth: 56,
        paddingLeft: globalMargins.xtiny,
      }}
    >
      <Box style={{position: 'relative'}}>
        <MultiAvatar
          singleSize={40}
          multiSize={32}
          avatarProps={avatarProps}
          style={{alignSelf: 'center', opacity}}
        />
      </Box>
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
  ignored,
  meta,
  modified,
  hasData,
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

  const icon: IconType = styles.hasStuffIcon
  const clickHandler = onClick ? () => onClick(path) : null

  return (
    <ClickableBox onClick={clickHandler}>
      <Box style={containerStyle}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Avatars users={users} styles={styles} ignored={ignored} isPublic={isPublic} />
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
          <Box style={stylesActionContainer}>
            {hasData && <Icon type={icon} style={{width: 32}} />}
          </Box>
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
  paddingTop: 16 + 8,
  paddingBottom: 16,
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
