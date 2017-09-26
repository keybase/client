// @flow
import * as React from 'react'
import {
  Box,
  Text,
  Icon,
  ClickableBox,
  Input,
  Button,
  Avatar,
  Meta,
  Usernames,
  HOCTimers,
} from '../../common-adapters'

import {globalStyles, globalColors, globalMargins, transition} from '../../styles'
import {isMobile} from '../../constants/platform'

export type Props = {
  canDelete: boolean,
  devicename: string,
  expanded: boolean,
  lastEditTime: string,
  lastEditUser: string,
  lastEditUserFollowing: boolean,
  name: string,
  you: ?string,
  teamname: ?string,
  url: string,
  isNew: boolean,
  onCopy: () => void,
  onClickDevice: () => void,
  onShowDelete: () => void,
  onToggleExpand: () => void,
  setTimeout: (() => void, number) => number,
}

type State = {
  showingCopy: boolean,
}

class Row extends React.Component<Props, State> {
  state = {
    showingCopy: false,
  }

  _input: any

  _inputOnClick = () => {
    this._input && this._input.select()
  }

  _setRef = r => (this._input = r)

  _onCopy = () => {
    this.props.onCopy()
    this.setState({showingCopy: true})
    this.props.setTimeout(() => this.setState({showingCopy: false}), 1000)
  }

  render() {
    return (
      <Box
        style={{
          ..._rowStyle,
          ...(this.props.expanded
            ? {
                backgroundColor: globalColors.blue5,
                borderColor: globalColors.black_05,
              }
            : {}),
        }}
      >
        <ClickableBox
          onClick={this.props.onToggleExpand}
          style={_rowClickStyle}
          hoverColor={isMobile ? undefined : globalColors.transparent}
          underlayColor={globalColors.transparent}
        >
          <Box style={_rowTopStyle}>
            <Icon
              type={this.props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={_iconCaretStyle}
            />
            <Avatar
              size={24}
              isTeam={!!this.props.teamname}
              teamname={this.props.teamname}
              username={this.props.teamname ? undefined : this.props.you}
              style={{marginRight: globalMargins.xtiny}}
            />
            <Text type="BodySemibold" style={{color: globalColors.darkBlue}}>
              {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
            </Text>
            {this.props.isNew && <Meta title="New" style={_metaStyle} />}
          </Box>
        </ClickableBox>
        {this.props.expanded &&
          <Box style={_rowBottomStyle}>
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <Text type="Body">Clone:</Text>
              <Box style={_bubbleStyle}>
                <Input
                  small={true}
                  readonly={true}
                  value={this.props.url}
                  onClick={this._inputOnClick}
                  ref={this._setRef}
                  style={_inputStyle}
                  editable={false}
                  inputStyle={_inputInputStyle}
                  hideUnderline={true}
                />
                <Box style={_copyStyle}>
                  <Icon
                    type="iconfont-clipboard"
                    style={{color: globalColors.white, ...(isMobile ? {} : {hoverColor: globalColors.blue5})}}
                    onClick={this._onCopy}
                  />
                </Box>
              </Box>
              {!isMobile &&
                this.props.canDelete &&
                <Button type="Danger" small={true} label="Delete repo" onClick={this.props.onShowDelete} />}
              <Box style={{alignSelf: 'flex-start', position: 'relative'}}>
                <Copied showing={this.state.showingCopy} />
              </Box>
            </Box>
            {isMobile &&
              this.props.canDelete &&
              <Button
                type="Danger"
                small={true}
                label="Delete repo"
                onClick={this.props.onShowDelete}
                style={{marginTop: globalMargins.tiny, alignSelf: 'flex-end'}}
              />}
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'center',
                alignSelf: 'flex-end',
                flexWrap: 'wrap',
                marginBottom: 3,
                marginTop: 5,
              }}
            >
              <Text type="BodySmall">
                {`Last push ${this.props.lastEditTime}${!!this.props.teamname && !!this.props.lastEditUser ? ' by ' : ''}`}
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
                  users={[{following: this.props.lastEditUserFollowing, username: this.props.lastEditUser}]}
                  style={{marginLeft: 2, marginRight: 2}}
                />}
              <Text type="BodySmall">
                <Text type="BodySmall">
                  {isMobile ? 'Signed and encrypted using device' : ', signed and encrypted using device'}
                </Text>
                <Text type="BodySmall" style={_deviceStyle} onClick={this.props.onClickDevice}>
                  {' '}{this.props.devicename}
                </Text>
              </Text>
            </Box>
          </Box>}
      </Box>
    )
  }
}

const Copied = ({showing}) => (
  <Box
    style={{
      ...transition('opacity'),
      backgroundColor: globalColors.black_60,
      borderRadius: 10,
      left: -160,
      opacity: showing ? 1 : 0,
      padding: 5,
      position: 'absolute',
      top: -28,
    }}
  >
    <Text type="Body" backgroundMode="Terminal">Copied!</Text>
  </Box>
)

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
  // on desktop the input text isn't vertically aligned
  ...(isMobile
    ? {height: 2}
    : {
        display: 'inline-block',
        paddingTop: 3,
      }),
  color: globalColors.darkBlue,
  fontSize: 13,
}

const _inputStyle = {
  paddingTop: isMobile ? 5 : undefined,
  width: '100%',
}

const _bubbleStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.white,
  borderColor: globalColors.black_05,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 1,
  flex: isMobile ? 1 : undefined,
  marginLeft: 8,
  marginRight: 8,
  minHeight: 28,
  minWidth: isMobile ? undefined : 367,
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
  ...(isMobile
    ? {}
    : {
        display: 'inline-block',
      }),
  fontSize: 12,
  marginBottom: 2,
  marginRight: globalMargins.tiny,
}

const _metaStyle = {
  alignSelf: 'center',
  backgroundColor: globalColors.orange,
  marginLeft: 6,
}

const _rowTopStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 8,
}

const _rowStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  borderBottomWidth: 1,
  borderColor: globalColors.transparent,
  borderStyle: 'solid',
  borderTopWidth: 1,
  flexShrink: 0,
  minHeight: globalMargins.large,
  padding: globalMargins.tiny,
  paddingLeft: 0,
  paddingTop: 11,
  width: '100%',
}
const _rowClickStyle = {
  ...globalStyles.flexBoxColumn,
}

// $FlowIssue we need to fix up timer hoc props
export default HOCTimers(Row)
