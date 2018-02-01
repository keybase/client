// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, BackButton, ClickableBox, Icon, List, Text} from '../common-adapters'
import {type IconType} from '../common-adapters/icon'
import {RowConnector} from './row'

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  minHeight: isMobile ? 64 : 40,
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
}

type FolderHeaderProps = {
  path: Types.Path,
}

type FileRowProps = {
  name: string,
  path: Types.Path,
  icon: IconType,
  onOpen: () => void,
}

type FolderProps = {
  items: Array<Types.Path>,
  path: Types.Path,
  onBack: () => void,
}

const folderBoxStyle = {...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'stretch'}

const folderHeaderStyleRoot = {...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'left',
  borderBottomWidth: 0,
  paddingLeft: 16,
  paddingRight: 16,
}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const rootHeaderContent = (
  <Box style={folderHeaderStyleRoot}>
    <Text type="BodyBig">Keybase Files</Text>
  </Box>
)

type FolderHeaderState = {
  pathElems: Array<string>,
}

const headerPathStyleParent = {color: globalColors.black_60}
const iconStyle = {marginRight: globalMargins.small}

class FolderHeader extends React.Component<FolderHeaderProps, FolderHeaderState> {
  state: FolderHeaderState

  constructor(props) {
    super(props)
    this.state = {
      pathElems: Types.getPathElements(props.path),
    }
  }

  componentWillReceiveProps = (nextProps: FolderHeaderProps) => {
    this.setState(prevState => ({pathElems: Types.getPathElements(nextProps.path)}))
  }

  _renderItem = (index, item) => {
    switch (this.state.pathElems.length) {
      case 2:
      // {private, public, team}
      // fallthrough
      case 3:
        // TLF
        let separator = <Icon type="iconfont-back" style={{...iconStyle}} />
        if (index === 0) {
          separator = null
        }
        if (index === this.state.pathElems.length - 1) {
          return (
            <Box>
              {separator}(<Text type="BodyBig">{item}</Text>)
            </Box>
          )
        } else {
          return (
            <Box>
              {separator}(<Text type="BodySmallSemibold" style={{...headerPathStyleParent}}>
                {item}
              </Text>)
            </Box>
          )
        }
      default:
      // Subfolder within TLF
    }
  }

  render() {
    let content = rootHeaderContent
    if (this.state.pathElems.length > 1) {
      content = (
        <Box style={{...folderHeaderStyleTree}}>
          <List items={this.state.pathElems} renderItem={this._renderItem} />
        </Box>
      )
    }
    return <Box>{content}</Box>
  }
}

const FileRow = RowConnector(({path, name, icon, onOpen}: FileRowProps) => (
  <ClickableBox onClick={onOpen} style={stylesCommonRow}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={{...iconStyle}} />
      <Box style={folderBoxStyle}>
        <Text type="Body">{name}</Text>
      </Box>
    </Box>
  </ClickableBox>
))

class Files extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => <FileRow key={Types.pathToString(item)} path={item} />

  render() {
    const {onBack, path, items} = this.props
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          {onBack &&
            Types.pathToString(path) !== '/keybase' && (
              <Box style={globalStyles.flexBoxColumn}>
                <BackButton onClick={onBack} style={{left: 16, position: 'absolute', top: 16}} />
              </Box>
            )}
          <FolderHeader path={path} />
          <List items={items} renderItem={this._renderRow} />
        </Box>
      </Box>
    )
  }
}

export default Files
