// @flow
import React from 'react'
import {Image} from 'react-native'
import type {Folder} from './list'
import {Box, Text, Icon, Avatar, Meta} from '../common-adapters'
import type {Props as IconProps} from '../common-adapters/icon'
import {globalStyles, globalColors} from '../styles/style-guide'

const Avatars = ({styles, users, isPublic}) => {
  // TODO (MM) fix type
  const groupIcon: any = styles.groupIcon
  const contents = users.length === 1 || users.length === 2
      ? <Avatar size={32} username={users[users.length - 1].username} />
      : <Icon type={groupIcon} />

  if (isPublic) {
    return <Box style={styles.avatarContainer}>{contents}</Box>
  }

  // $FlowIssue doesn't like images
  const source = require('../images/icons/damier-pattern-48.png')
  return (
    <Box style={{width: 48, height: 1}}>
      <Image
        style={stylesAvatarContainerPrivate}
        source={source}
        resizeMode='contain'>{contents}
      </Image>
    </Box>
  )
}

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

const Modified = ({styles, modified}) => {
  const iconColor = Text._colorStyleBackgroundMode(styles.modifiedMode, 'BodySmallLink')
  return (
    <Box style={stylesModified}>
      <Icon type='fa-kb-iconfont-thunderbolt' style={{fontSize: 13, alignSelf: 'center', marginLeft: -2, marginRight: 2, ...iconColor}} title='Modified' />
      <Text type='BodySmall' backgroundMode={styles.modifiedMode}>Modified {modified.when} by&nbsp;</Text>
      <Text type='BodySmallLink' backgroundMode={styles.modifiedMode}>{modified.username}</Text>
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

  const metaProps = ignored
    ? {title: 'ignored', style: styles.ignored}
    : {title: meta || '', style: meta ? {color: metaColors[meta], backgroundColor: metaBGColors[meta]} : {}}

  return <Meta {...metaProps} />
}

const Row = ({users, isPublic, ignored, isFirst, meta, modified, hasData, path}: Folder & {isFirst: boolean}) => {
  const styles = isPublic ? stylesPublic : stylesPrivate

  const containerStyle = {
    ...styles.rowContainer,
  }

  const icon: IconProps.type = styles.hasStuffIcon

  return (
    <Box style={containerStyle}>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Avatars users={users} styles={styles} isPublic={isPublic} />
        <Box style={stylesBodyContainer}>
          <Names users={users} styles={styles} meta={meta} modified={modified} />
          {(meta || ignored) && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
          {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} />}
        </Box>
        <Box style={stylesActionContainer}>
          {hasData && <Icon type={icon} style={{width: 32}} />}
        </Box>
      </Box>
      {!isFirst && <Box style={stylesLine} />}
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
  hasStuffIcon: 'folder-private-has-stuff-32',
  ignored: {
    color: globalColors.white_40,
    backgroundColor: 'rgba(0, 26, 51, 0.4)',
  },
  groupIcon: 'folder-private-group-32',
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

