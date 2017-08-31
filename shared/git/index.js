// @flow
import * as React from 'react'
import {Box, Text, Icon, ClickableBox, Input, Button} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'

type RowProps = {
  devicename: string,
  lastEdit: string,
  name: string,
  teamname: ?string,
  url: string,
}

type RowState = {
  expanded: boolean,
}

class Row
  extends React.Component<
    RowProps & {
      onCopy: (url: string) => void,
      onDelete: (url: string) => void,
    },
    RowState
  > {
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
                backgroundColor: globalColors.blue2,
              }
            : {}),
        }}
      >
        <ClickableBox onClick={this._toggleExpand} style={_rowClickStyle}>
          <Box style={_rowTopStyle}>
            <Icon
              type={this.state.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={_iconCaretStyle}
            />
            <Icon
              type={this.state.expanded ? 'iconfont-keybase' : 'iconfont-keybase'}
              style={_iconRepoStyle}
            />
            <Text type="BodySemibold">{this.props.name}</Text>
          </Box>
        </ClickableBox>
        {this.state.expanded &&
          <Box style={_rowBottomStyle}>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySmall">
                Last push {this.props.lastEdit} ago, signed and encrypted using device&nbsp;
              </Text>
              <Text type="BodySmall" style={_deviceStyle}>{this.props.devicename}</Text>
            </Box>
            <Box style={globalStyles.flexBoxRow}>
              <Box style={_bubbleStyle}>
                <Input
                  small={true}
                  readonly={true}
                  value={this.props.url}
                  onClick={this._inputOnClick}
                  ref={this._setRef}
                  style={_inputStyle}
                  hideUnderline={true}
                />
                <Box style={_copyStyle}>
                  <Icon
                    type="iconfont-team-join"
                    style={{color: globalColors.white, hoverColor: globalColors.grey}}
                    onClick={this._onCopy}
                  />
                  {/* TEMP icon */}
                </Box>
              </Box>
              <Button type="Danger" label="Delete repo" onClick={this._onDelete} />
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

const _inputStyle = {
  width: '100%',
}

const _bubbleStyle = {
  ...globalStyles.flexBoxCenter,
  borderColor: globalColors.blue,
  borderRadius: 20,
  borderStyle: 'solid',
  borderWidth: 1,
  marginRight: 8,
  minHeight: 30,
  minWidth: 430,
  overflow: 'hidden',
  position: 'relative',
}

const _deviceStyle = {
  ...globalStyles.fontBold,
  ...globalStyles.italic,
}

const _rowBottomStyle = {
  ...globalStyles.flexBoxColumn,
  paddingLeft: 22,
}

const _iconCaretStyle = {
  fontSize: 12,
}

const _iconRepoStyle = {
  marginLeft: 12,
  marginRight: 12,
}

const _rowTopStyle = {
  ...globalStyles.flexBoxRow,
}

const _rowStyle = {
  ...globalStyles.flexBoxColumn,
  padding: 12,
  width: '100%',
}
const _rowClickStyle = {
  ...globalStyles.flexBoxColumn,
}

type Props = {
  onCopy: (url: string) => void,
  onDelete: (url: string) => void,
  personals: Array<RowProps>,
  teams: Array<RowProps>,
}

const Git = (props: Props) => (
  <Box style={_gitStyle}>
    <Text type="BodySemibold">Personal repositories</Text>
    {props.personals.map(p => <Row {...p} key={p.url} onCopy={props.onCopy} onDelete={props.onDelete} />)}
    <Text type="BodySemibold">Team repositories</Text>
    {props.teams.map(p => <Row {...p} key={p.url} onCopy={props.onCopy} onDelete={props.onDelete} />)}
  </Box>
)

const _gitStyle = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  width: '100%',
}

export default Git
