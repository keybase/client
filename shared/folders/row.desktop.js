// @flow
import * as React from 'react'
import {Box, Button, Text, Icon, MultiAvatar, Avatar, Meta, Usernames} from '../common-adapters'
import {getStyle} from '../common-adapters/text'
import {globalStyles, globalColors, globalMargins, desktopStyles, platformStyles} from '../styles'
import * as Types from '../constants/types/folders'

type Folder = Types.Folder

class Avatars extends React.PureComponent<any> {
  render() {
    const {ignored, isPublic, isTeam} = this.props
    let users = this.props.users
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

    let teamname = 'unknown'
    if (isTeam && users.length > 0) {
      teamname = users[0].username
    }

    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          height: 48,
          justifyContent: 'flex-start',
          padding: 0,
          width: 56,
        }}
      >
        {isTeam ? (
          <Avatar
            size={32}
            teamname={teamname}
            isTeam={true}
            style={{opacity, marginLeft: globalMargins.xtiny, marginTop: globalMargins.xtiny}}
          />
        ) : (
          <MultiAvatar singleSize={32} multiSize={32} avatarProps={avatarProps} style={{opacity}} />
        )}
      </Box>
    )
  }
}

class Modified extends React.PureComponent<any> {
  render() {
    const {styles, modified} = this.props
    const iconColor = getStyle('BodySmall', styles.modifiedMode).color
    const boltStyle = {
      alignSelf: 'center',
      marginTop: 2,
    }

    return (
      <Box style={stylesModified}>
        <Icon type="iconfont-thunderbolt" style={boltStyle} hint="Modified" color={iconColor} fontSize={10} />
        <Text type="BodySmall" backgroundMode={styles.modifiedMode}>
          Modified {modified.when} by&nbsp;
        </Text>
        <Text type="BodySmallSecondaryLink" backgroundMode={styles.modifiedMode}>
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

    const color = {
      new: globalColors.white,
      rekey: globalColors.white,
    }[meta]

    const backgroundColor = {
      new: globalColors.orange,
      rekey: globalColors.red,
    }[meta]

    return <Meta title={meta || ''} color={color} backgroundColor={backgroundColor} />
  }
}

type RowType = {
  hasReadOnlyUsers: boolean,
  installed: boolean,
  sortName: string,
  onOpen: (path: string) => void,
  onChat: (tlf: string) => void,
  onClick: (path: string) => void,
  onRekey: (path: string) => void,
}

class Row extends React.PureComponent<RowType & Folder> {
  render() {
    const {users, isPublic, isTeam, ignored, meta, modified, onClick, onRekey, path} = this.props
    const styles = isPublic ? stylesPublic : stylesPrivate

    let redColor = globalColors.red

    if (ignored) {
      redColor = globalColors.red_75
    }

    const containerStyle = {
      ...styles.rowContainer,
      minHeight: 40,
      backgroundColor: globalColors.white,
    }

    return (
      <Box style={containerStyle} className="folder-row" onClick={() => onClick && onClick(path)}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Avatars users={users} styles={styles} ignored={ignored} isPublic={isPublic} isTeam={isTeam} />
          <Box style={stylesBodyContainer}>
            <Usernames
              users={users}
              type={'BodySmallSemibold'}
              style={{
                color: isPublic ? globalColors.yellowGreen2 : globalColors.black_75,
                opacity: ignored ? 0.6 : 1,
              }}
              redColor={redColor}
            />
            {meta && !ignored && <RowMeta ignored={ignored} meta={meta} styles={styles} />}
            {!(meta || ignored) && modified && <Modified modified={modified} styles={styles} />}
          </Box>
          <Box
            style={{
              ...stylesActionContainer,
              width: undefined,
              marginRight: globalMargins.small,
            }}
          >
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
