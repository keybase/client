// @flow
import React from 'react'
import type {Folder} from './list'
import type {IconType} from '../common-adapters/icon'
import {Box, Text, Icon, Avatar, Meta, NativeImage, ClickableBox} from '../common-adapters/index.native'
import {getStyle} from '../common-adapters/text'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from '../common-adapters/icon.constants'

const Avatars = ({styles, users, isPublic, ignored}) => {
  // TODO (MM) fix type
  const groupIcon: any = styles.groupIcon
  const contents = users.length === 1 || users.length === 2
    ? <Avatar size={32} username={users[users.length - 1].username} opacity={ignored ? 0.5 : 1.0}
      backgroundColor={styles.rowContainer.backgroundColor} />
      : <Icon type={groupIcon} />

  if (isPublic) {
    return <Box style={styles.avatarContainer}>{contents}</Box>
  }

  const source = iconMeta[ignored ? 'icon-damier-pattern-ignored-locked-48-1000' : 'icon-damier-pattern-good-open-48-1000'].require

  return (
    <Box style={{width: 48, height: 1}}>
      <NativeImage
        style={stylesAvatarContainerPrivate}
        source={source}
        resizeMode='contain'>{contents}
      </NativeImage>
    </Box>
  )
}

const Names = ({styles, users, nameColor, redColor}) => {
  return (
    <Box style={stylesBodyNameContainer}>
      {users.map((u, i) => (
        <Text
          key={u.username}
          type={u.you ? 'BodySemiboldItalic' : 'BodySemibold'}
          style={{color: u.broken ? redColor : nameColor}}>{u.username}
          {
            (i !== users.length - 1) && // Injecting the commas here so we never wrap and have newlines starting with a ,
              <Text type='BodySemibold' style={{color: styles.nameColor, marginRight: 2}}>,</Text>}
        </Text>
      ))}
    </Box>
  )
}

const Modified = ({styles, modified}) => {
  const iconColor = {color: getStyle('BodySmall', styles.modifiedMode).color}
  return (
    <Box style={stylesModified}>
      <Icon type='iconfont-thunderbolt' style={{alignSelf: 'center', marginLeft: -2, marginRight: 2, fontSize: 10, ...iconColor}} hint='Modified' />
      <Text type='BodySmall' backgroundMode={styles.modifiedMode}>Modified {modified.when} by&nbsp;</Text>
      <Text type='BodySmall' backgroundMode={styles.modifiedMode}>{modified.username}</Text>
    </Box>
  )
}

const RowMeta = ({ignored, meta, styles}) => {
  const metaColors = {
    'new': globalColors.white,
    'rekey': globalColors.white,
  }

  const metaBGColors = {
    'new': globalColors.blue2,
    'rekey': globalColors.red,
  }

  const metaProps = meta === 'ignored'
    ? {title: 'ignored', style: {...styles.ignored, marginTop: 3}}
    : {title: meta || '', style: meta ? {color: metaColors[meta], backgroundColor: metaBGColors[meta], marginTop: 2} : {}}

  return <Meta {...metaProps} />
}

const Row = ({users, isPublic, ignored, meta, modified, hasData, path, onClick}: Folder & {onClick: (path: string) => void}) => {
  const styles = isPublic ? stylesPublic : stylesPrivate

  let backgroundColor = styles.rowContainer.backgroundColor
  let nameColor = styles.nameColor
  let redColor = globalColors.red

  if (ignored) {
    backgroundColor = isPublic ? globalColors.white_40 : globalColors.darkBlue4
    nameColor = isPublic ? globalColors.yellowGreen2_75 : globalColors.white_40
    redColor = globalColors.red_75
  }

  const containerStyle = {
    ...styles.rowContainer,
    backgroundColor,
  }

  const icon: IconType = styles.hasStuffIcon
  const clickHandler = onClick ? () => onClick(path) : null

  return (
    <ClickableBox onClick={clickHandler}>
      <Box style={containerStyle}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Avatars users={users} styles={styles} isPublic={isPublic} ignored={ignored} />
          <Box style={stylesBodyContainer}>
            <Names users={users} styles={styles} meta={meta} modified={modified} nameColor={nameColor} redColor={redColor} />
            {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
            {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} />}
          </Box>
          <Box style={stylesActionContainer}>
            {hasData && <Icon type={icon} style={{width: 32}} />}
          </Box>
        </Box>
        <Box style={stylesLine} />
      </Box>
    </ClickableBox>
  )
}

const stylesLine = {
  backgroundColor: globalColors.black_05,
  height: 1,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
}

const rowContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  overflow: 'hidden',
}

const stylesAvatarContainer = {
  width: 48,
  padding: 8,
  paddingLeft: 8,
  paddingRight: 8,
  paddingTop: 16,
  paddingBottom: 16,
}

const stylesAvatarContainerPrivate = {
  width: 48,
  overflow: 'hidden',
  paddingLeft: 8,
  paddingRight: 8,
  paddingTop: 16,
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
  groupIcon: 'icon-folder-private-group-32',
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
  groupIcon: 'icon-folder-public-group-32',
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
  padding: 8,
  marginRight: 16,
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
