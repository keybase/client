// @flow
import * as React from 'react'
import type {Folder} from './list'
import {Box, Button, Text, Icon, MultiAvatar, Avatar, Meta, Usernames} from '../common-adapters'
import {getStyle} from '../common-adapters/text'
import {globalStyles, globalColors, globalMargins, desktopStyles, platformStyles} from '../styles'

class Avatars extends React.PureComponent<any> {
  render() {
    const {smallMode, ignored, isPublic, isTeam} = this.props
    let users = this.props.users
    if (!isPublic && users.length > 1) {
      users = users.filter(({you}) => !you)
    }
    const avatarCount = Math.min(2, users.length)
    const opacity = ignored ? 0.5 : 1
    const avatarProps = users.slice(0, 2).map(({username}, idx) => ({
      borderColor: avatarCount > 1 && idx === 0 ? globalColors.white : undefined,
      loadingColor: globalColors.lightGrey,
      size: smallMode ? 24 : 32,
      username,
    }))

    let teamname = 'unknown'
    if (isTeam && users.length > 0) {
      teamname = users[0].username
    }

    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          height: smallMode ? globalMargins.large : 56,
          justifyContent: 'flex-start',
          padding: globalMargins.xtiny,
          width: smallMode ? globalMargins.large : 56,
        }}
      >
        {isTeam ? (
          <Avatar
            size={smallMode ? 32 : 40}
            teamname={teamname}
            isTeam={true}
            style={{opacity, marginLeft: globalMargins.xtiny, marginTop: globalMargins.xtiny}}
          />
        ) : (
          <MultiAvatar
            singleSize={smallMode ? 32 : 40}
            multiSize={smallMode ? 24 : 32}
            avatarProps={avatarProps}
            style={{opacity}}
          />
        )}
      </Box>
    )
  }
}

class Modified extends React.PureComponent<any> {
  render() {
    const {smallMode, styles, modified} = this.props
    const iconColor = {color: getStyle('BodySmall', styles.modifiedMode).color}
    const boltStyle = {
      fontSize: smallMode ? 10 : 10,
      alignSelf: 'center',
      ...(smallMode ? {marginTop: 2} : {marginLeft: -2, marginRight: 1, marginTop: 2}),
      ...iconColor,
    }

    return (
      <Box style={stylesModified}>
        <Icon type="iconfont-thunderbolt" style={boltStyle} hint="Modified" />
        <Text type="BodySmall" backgroundMode={styles.modifiedMode}>
          Modified {modified.when} by&nbsp;
        </Text>
        <Text type="BodySmallInlineLink" backgroundMode={styles.modifiedMode}>
          {modified.username}
        </Text>
      </Box>
    )
  }
}

class RowMeta extends React.PureComponent<any> {
  render() {
    const {meta} = this.props
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
      style: meta ? {color: metaColors[meta], backgroundColor: metaBGColors[meta]} : {},
    }

    return <Meta {...metaProps} />
  }
}

type RowType = {
  hasReadOnlyUsers: boolean,
  installed: boolean,
  smallMode: boolean,
  sortName: string,
  onOpen: (path: string) => void,
  onChat: (tlf: string) => void,
  onClick: (path: string) => void,
  onRekey: (path: string) => void,
}

class Row extends React.PureComponent<RowType & Folder> {
  render() {
    const {
      users,
      isPublic,
      isTeam,
      hasReadOnlyUsers,
      ignored,
      installed,
      meta,
      modified,
      smallMode,
      onChat,
      onOpen,
      onClick,
      onRekey,
      path,
      // sortName,
    } = this.props
    const onOpenClick = event => {
      event.preventDefault()
      event.stopPropagation()
      if (onOpen) {
        onOpen(path)
      }
    }
    const onChatClick = event => {
      event.preventDefault()
      event.stopPropagation()
      if (onChat) {
        onChat(path)
      }
    }
    const styles = isPublic ? stylesPublic : stylesPrivate

    let redColor = globalColors.red

    if (ignored) {
      redColor = globalColors.red_75
    }

    const containerStyle = {
      ...styles.rowContainer,
      minHeight: smallMode ? 40 : 48,
      backgroundColor: globalColors.white,
      opacity: !smallMode && !installed ? 0.4 : 1,
    }

    return (
      <Box style={containerStyle} className="folder-row" onClick={() => onClick && onClick(path)}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Avatars
            users={users}
            styles={styles}
            smallMode={smallMode}
            ignored={ignored}
            isPublic={isPublic}
            isTeam={isTeam}
          />
          <Box style={stylesBodyContainer}>
            <Usernames
              users={users}
              type={smallMode ? 'BodySmallSemibold' : 'BodySemibold'}
              style={{
                color: isPublic ? globalColors.yellowGreen2 : globalColors.darkBlue,
                opacity: ignored ? 0.6 : 1,
              }}
              redColor={redColor}
            />
            {meta && !ignored && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
            {!(meta || ignored) &&
              modified && <Modified modified={modified} styles={styles} smallMode={smallMode} />}
          </Box>
          {!smallMode &&
            !isPublic &&
            !hasReadOnlyUsers &&
            meta !== 'rekey' && (
              <Box style={{...stylesActionContainer, width: smallMode ? undefined : 64}}>
                <Text
                  type="BodySmallSecondaryLink"
                  className="folder-row-hover-action"
                  onClick={onChatClick}
                  style={styles.action}
                >
                  Chat
                </Text>
              </Box>
            )}
          <Box
            style={{
              ...stylesActionContainer,
              width: smallMode ? undefined : 64,
              marginRight: globalMargins.small,
            }}
          >
            {!smallMode &&
              meta !== 'rekey' && (
                <Text
                  type="BodySmallSecondaryLink"
                  className="folder-row-hover-action"
                  onClick={onOpenClick}
                  style={styles.action}
                >
                  Open
                </Text>
              )}
            {meta === 'rekey' && (
              <Button
                small={true}
                type="PrimaryPrivate"
                onClick={e => {
                  if (onRekey) {
                    e.stopPropagation()
                    onRekey(path)
                  }
                }}
                label="Rekey"
                style={styles.action}
              />
            )}
          </Box>
        </Box>
      </Box>
    )
  }
}

const rowContainer = {
  ...globalStyles.flexBoxColumn,
  ...desktopStyles.clickable,
  position: 'relative',
}

const stylesPrivate = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.white,
    color: globalColors.white,
  },
  ignored: {
    color: globalColors.white_40,
    backgroundColor: globalColors.white,
  },
  groupIcon: {
    small: 'icon-folder-private-group-24',
    normal: 'icon-folder-private-group-32',
  },
  nameColor: globalColors.white,
  modifiedMode: 'Terminal',
  action: platformStyles({
    isElectron: {
      ...desktopStyles.clickable,
      alignSelf: 'center',
      marginRight: globalMargins.tiny,
    },
  }),
}

const stylesPublic = {
  rowContainer: {
    ...rowContainer,
    backgroundColor: globalColors.white,
    color: globalColors.yellowGreen2,
  },
  ignored: {
    color: globalColors.white_75,
    backgroundColor: globalColors.white,
  },
  groupIcon: {
    small: 'icon-folder-public-group-24',
    normal: 'icon-folder-public-group-32',
  },
  nameColor: globalColors.yellowGreen2,
  modifiedMode: 'Normal',
  action: platformStyles({
    isElectron: {
      ...desktopStyles.clickable,
      alignSelf: 'center',
      marginRight: globalMargins.tiny,
    },
  }),
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
  justifyContent: 'center',
}

const stylesModified = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

export default Row
