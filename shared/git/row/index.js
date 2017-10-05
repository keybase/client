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
  openUserTracker: (username: string) => void,
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
                paddingBottom: isMobile ? globalMargins.tiny : 0,
              }
            : {}),
        }}
      >
        <ClickableBox
          onClick={this.props.onToggleExpand}
          style={this.props.expanded ? _rowClickStyleExpanded : _rowClickStyle}
          hoverColor={isMobile ? undefined : globalColors.transparent}
          underlayColor={globalColors.transparent}
        >
          <Box style={_rowTopStyle}>
            <Icon
              type={this.props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={_iconCaretStyle}
            />
            <Avatar
              size={isMobile ? 40 : 24}
              isTeam={!!this.props.teamname}
              teamname={this.props.teamname}
              username={this.props.teamname ? undefined : this.props.you}
              style={{marginRight: globalMargins.tiny}}
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
                <ClickableBox style={_copyStyle} onClick={this._onCopy}>
                  <Icon
                    type="iconfont-clipboard"
                    style={{
                      color: globalColors.white,
                      fontSize: isMobile ? 20 : 16,
                      ...(isMobile ? {} : {hoverColor: globalColors.blue5}),
                    }}
                  />
                </ClickableBox>
              </Box>
              {!isMobile &&
                this.props.canDelete &&
                <Button type="Danger" small={true} label="Delete repo" onClick={this.props.onShowDelete} />}
              <Box style={{alignSelf: 'flex-start', position: 'relative'}}>
                <Copied showing={this.state.showingCopy} />
              </Box>
            </Box>
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'center',
                alignSelf: 'flex-start',
                flexWrap: 'wrap',
                marginBottom: globalMargins.xtiny,
                marginTop: globalMargins.tiny,
              }}
            >
              <Text type="BodySmall">
                {`Last push ${this.props.lastEditTime}${!!this.props.teamname && !!this.props.lastEditUser ? ' by ' : ''}`}
              </Text>
              {!!this.props.teamname &&
                !!this.props.lastEditUser &&
                <Avatar
                  username={this.props.lastEditUser}
                  size={isMobile ? 16 : 12}
                  style={{marginLeft: isMobile ? 0 : 4}}
                />}
              {!!this.props.teamname &&
                !!this.props.lastEditUser &&
                <Box style={{marginLeft: 2}}>
                  <Usernames
                    type="BodySmallSemibold"
                    underline={true}
                    colorFollowing={true}
                    users={[{following: this.props.lastEditUserFollowing, username: this.props.lastEditUser}]}
                    onUsernameClicked={() => this.props.openUserTracker(this.props.lastEditUser)}
                  />
                </Box>}
              {isMobile && <Text type="BodySmall">.{' '}</Text>}
              <Text type="BodySmall">
                <Text type="BodySmall">
                  {isMobile ? 'Signed and encrypted using device' : ', signed and encrypted using device'}
                </Text>
                <Text type="BodySmall" style={_deviceStyle} onClick={this.props.onClickDevice}>
                  {' '}{this.props.devicename}
                </Text>
                <Text type="BodySmall">.</Text>
              </Text>
            </Box>
            {isMobile &&
              this.props.canDelete &&
              <Button
                type="Danger"
                small={false}
                label="Delete repo"
                onClick={this.props.onShowDelete}
                style={{marginTop: globalMargins.tiny, alignSelf: 'flex-start'}}
              />}
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
      borderRadius: 20,
      left: -165,
      opacity: showing ? 1 : 0,
      paddingBottom: 5,
      paddingTop: globalMargins.xtiny,
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
      position: 'absolute',
      top: -28,
    }}
  >
    <Text type="BodySmall" backgroundMode="Terminal" style={{color: globalColors.white}}>Copied!</Text>
  </Box>
)

const _copyStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.blue,
  borderRadius: 0,
  left: undefined,
  paddingLeft: isMobile ? 24 : 12,
  paddingRight: isMobile ? 24 : 12,
}

const _inputInputStyle = {
  ...globalStyles.fontTerminal,
  // on desktop the input text isn't vertically aligned
  ...(isMobile
    ? {fontSize: 15}
    : {
        display: 'inline-block',
        fontSize: 13,
        paddingTop: 3,
      }),
  color: globalColors.darkBlue,
}

const _inputStyle = {
  paddingTop: isMobile ? 10 : undefined,
  width: '100%',
}

const _bubbleStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.white,
  borderColor: globalColors.black_05,
  borderRadius: 200,
  borderStyle: 'solid',
  borderWidth: 1,
  flex: isMobile ? 1 : undefined,
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
  minHeight: isMobile ? 40 : 28,
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
  paddingLeft: globalMargins.medium,
  paddingBottom: globalMargins.tiny,
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
  paddingLeft: globalMargins.tiny,
  marginBottom: globalMargins.xtiny,
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
  paddingLeft: 0,
  width: '100%',
}
const _rowClickStyle = {
  ...globalStyles.flexBoxColumn,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  width: '100%',
}

const _rowClickStyleExpanded = {
  ..._rowClickStyle,
  paddingBottom: 0,
}

// $FlowIssue we need to fix up timer hoc props
export default HOCTimers(Row)
