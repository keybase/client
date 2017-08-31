// @flow
import * as React from 'react'
import {Box, Text, Icon, ClickableBox, Input, Button, Avatar, Meta, Usernames} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

export type Props = {
  devicename: string,
  lastEditTime: string,
  lastEditUser: string,
  lastEditUserFollowing: boolean,
  name: string,
  teamname: ?string,
  url: string,
  isNew: boolean,
}

type _Props = Props & {
  onCopy: (url: string) => void,
  onDelete: (url: string) => void,
}

type State = {
  expanded: boolean,
}

class Row extends React.Component<_Props, State> {
  _input: any

  state = {
    expanded: false,
  }

  _toggleExpand = () => {
    this.setState(prevState => ({expanded: !prevState.expanded}))
  }

  _inputOnClick = () => {
    this._input && this._input.select()
  }

  _setRef = r => (this._input = r)

  _onCopy = () => {
    this.props.onCopy(this.props.url)
  }

  _onDelete = () => {
    this.props.onDelete(this.props.url)
  }

  render() {
    return (
      <Box
        style={{
          ..._rowStyle,
          ...(this.state.expanded
            ? {
                backgroundColor: globalColors.blue5,
                borderColor: globalColors.black_05,
              }
            : {}),
        }}
      >
        <ClickableBox
          onClick={this._toggleExpand}
          style={_rowClickStyle}
          hoverColor={globalColors.transparent}
          underlayColor={globalColors.transparent}
        >
          <Box style={_rowTopStyle}>
            <Icon
              type={this.state.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={_iconCaretStyle}
            />
            <Icon
              type={this.props.teamname ? 'iconfont-repo-team' : 'iconfont-repo-personal'}
              style={_iconRepoStyle}
            />
            {this.props.teamname &&
              <Avatar
                size={12}
                isTeam={true}
                teamname={this.props.teamname}
                style={{marginRight: globalMargins.xtiny}}
              />}
            <Text type="BodySemibold" style={{color: globalColors.darkBlue}}>
              {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
            </Text>
            {!!this.props.teamname && this.props.isNew && <Meta title="New" style={_metaStyle} />}
          </Box>
        </ClickableBox>
        {this.state.expanded &&
          <Box style={_rowBottomStyle}>
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: 5, marginTop: 2}}>
              <Text type="BodySmall">
                Last push
                {' '}
                {this.props.lastEditTime}
                {' '}
                ago
                {' '}
                {!!this.props.teamname && !!this.props.lastEditUser && ' by'}
              </Text>
              {!!this.props.teamname &&
                !!this.props.lastEditUser &&
                <Avatar
                  username={this.props.lastEditUser}
                  size={12}
                  style={{marginLeft: 2, marginRight: 2}}
                />}
              {!!this.props.teamname &&
                !!this.props.lastEditUser &&
                <Usernames
                  type="BodySmall"
                  colorFollowing={true}
                  users={[{username: this.props.lastEditUser, following: this.props.lastEditUserFollowing}]}
                  style={{marginLeft: 2, marginRight: 2}}
                />}
              <Text type="BodySmall">
                , signed and encrypted using device&nbsp;
              </Text>
              <Text type="BodySmall" style={_deviceStyle}>{this.props.devicename}</Text>
            </Box>
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
              <Text type="Body">Clone:</Text>
              <Box style={_bubbleStyle}>
                <Input
                  small={true}
                  readonly={true}
                  value={this.props.url}
                  onClick={this._inputOnClick}
                  ref={this._setRef}
                  style={_inputStyle}
                  inputStyle={_inputInputStyle}
                  hideUnderline={true}
                />
                <Box style={_copyStyle}>
                  <Icon
                    type={/* temp */ 'iconfont-team-join'}
                    style={{color: globalColors.white, hoverColor: globalColors.blue5}}
                    onClick={this._onCopy}
                  />
                </Box>
              </Box>
              <Button type="Danger" small={true} label="Delete repo" onClick={this._onDelete} />
            </Box>
          </Box>}
      </Box>
    )
  }
}

const _copyStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.blue,
  left: undefined,
  paddingLeft: 12,
  paddingRight: 12,
}

const _inputInputStyle = {
  ...globalStyles.fontTerminal,
  color: globalColors.darkBlue,
  fontSize: 13,
}

const _inputStyle = {
  width: '100%',
}

const _bubbleStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.white,
  borderColor: globalColors.black_05,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 1,
  marginLeft: 8,
  marginRight: 8,
  minHeight: 28,
  minWidth: 367,
  overflow: 'hidden',
  paddingLeft: globalMargins.small,
  position: 'relative',
}

const _deviceStyle = {
  ...globalStyles.fontSemibold,
  ...globalStyles.italic,
  color: globalColors.black_60,
}

const _rowBottomStyle = {
  ...globalStyles.flexBoxColumn,
  paddingLeft: 32,
}

const _iconCaretStyle = {
  display: 'inline-block',
  fontSize: 12,
  marginBottom: 2,
}

const _metaStyle = {
  alignSelf: 'center',
  backgroundColor: globalColors.orange,
  marginLeft: 6,
}

const _iconRepoStyle = {
  color: globalColors.darkBlue,
  marginLeft: 12,
  marginRight: 6,
}

const _rowTopStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 8,
}

const _rowStyle = {
  ...globalStyles.flexBoxColumn,
  borderBottomWidth: 1,
  borderColor: globalColors.transparent,
  borderStyle: 'solid',
  borderTopWidth: 1,
  minHeight: globalMargins.large,
  padding: globalMargins.tiny,
  paddingLeft: 0,
  paddingTop: 11,
  width: '100%',
}
const _rowClickStyle = {
  ...globalStyles.flexBoxColumn,
}

export default Row
