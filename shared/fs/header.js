// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Avatar, Box, ClickableBox, Icon, Text} from '../common-adapters'
import {FolderHeaderBreadcrumbConnector} from './header-container'

type FolderHeaderProps = {
  path: Types.Path,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomWidth: 1,
  borderBottomColor: globalColors.black_05,
  minHeight: isMobile ? 64 : 48,
}

const folderHeaderStyleRoot = {
  ...stylesCommonRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 16,
}

const folderBreadcrumbStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 0,
  paddingRight: 0,
}

const rootHeaderContent = (
  <Box style={folderHeaderStyleRoot}>
    <Text type="BodyBig">Keybase Files</Text>
  </Box>
)

type FolderHeaderState = {
  pathElems: Array<string>,
}

type FolderBreadcrumbProps = {
  index: number,
  totalCrumbs: number,
  visibility: Types.Visibility,
  item: string,
  path: Types.Path,
}

type FolderBreadcrumbConnectedProps = {
  visibility: Types.Visibility,
  item: string,
  onOpen: () => void,
}

const headerPathStyleParent = {color: globalColors.black_60}
const iconStyle = {
  fontSize: 11,
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
}

const styleTeamAvatar = {
  marginRight: globalMargins.xtiny,
}

const FolderHeaderBreadcrumb = FolderHeaderBreadcrumbConnector(
  ({visibility, item, onOpen}: FolderBreadcrumbConnectedProps) => {
    return (
      <ClickableBox onClick={onOpen}>
        <Text type="BodySmallSemibold" style={headerPathStyleParent}>
          {item}
        </Text>
      </ClickableBox>
    )
  }
)

const FolderHeaderItem = ({index, totalCrumbs, visibility, item, path}: FolderBreadcrumbProps) => {
  let separator = <Icon type="iconfont-back" style={iconStyle} />
  if (index === 0) {
    separator = null
  }
  if (index === totalCrumbs - 1) {
    return (
      <Box style={folderBreadcrumbStyle}>
        {separator}
        {visibility === 'team' &&
          index === 2 && <Avatar size={12} teamname={item} isTeam={true} style={styleTeamAvatar} />}
        <Text type="BodyBig">{item}</Text>
      </Box>
    )
  } else {
    return (
      <Box style={folderBreadcrumbStyle}>
        {separator}
        {visibility === 'team' &&
          index === 2 && <Avatar size={12} teamname={item} isTeam={true} style={styleTeamAvatar} />}
        <FolderHeaderBreadcrumb visibility={visibility} item={item} path={path} />
      </Box>
    )
  }
}

class FolderHeader extends React.Component<FolderHeaderProps, FolderHeaderState> {
  state: FolderHeaderState

  constructor(props: FolderHeaderProps) {
    super(props)
    this.state = {
      pathElems: Types.getPathElements(props.path),
    }
  }

  componentWillReceiveProps = (nextProps: FolderHeaderProps) => {
    this.setState(prevState => ({pathElems: Types.getPathElements(nextProps.path)}))
  }

  _createBreadcrumbs = () => {
    switch (this.state.pathElems.length) {
      case 1:
        return rootHeaderContent
      case 2:
      // {private, public, team}
      // fallthrough
      case 3:
        // TLF
        const visibility = Types.getPathVisibility(this.props.path)
        return (
          <Box style={folderHeaderStyleTree}>
            {this.state.pathElems.map((elem, index, pathElems) => {
              // TODO: make this more efficient, currently it's doing repeated
              // work for each item.
              const pelems = pathElems.slice(0, index + 1)
              const path = Types.stringToPath('/' + pelems.join('/'))
              return (
                <FolderHeaderItem
                  key={index}
                  index={index}
                  visibility={visibility}
                  item={elem}
                  totalCrumbs={pathElems.length}
                  path={path}
                />
              )
            })}
          </Box>
        )
      default:
      // TODO: fix with list
    }
  }

  render() {
    return <Box>{this._createBreadcrumbs()}</Box>
  }
}

export default FolderHeader
