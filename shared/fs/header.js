// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, Icon, List, Text} from '../common-adapters'

type FolderHeaderProps = {
  path: Types.Path,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomWidth: 0,
  justifyContent: 'center',
  minHeight: isMobile ? 64 : 40,
}

const folderHeaderStyleRoot = {
  ...stylesCommonRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'center',
  justifyContent: 'left',
  paddingLeft: 16,
  paddingRight: 16,
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

  constructor(props: FolderHeaderProps) {
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
              {separator}
              <Text type="BodyBig">{item}</Text>
            </Box>
          )
        } else {
          return (
            <Box>
              {separator}
              <Text type="BodySmallSemibold" style={{...headerPathStyleParent}}>
                {item}
              </Text>
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
        <Box style={folderHeaderStyleTree}>
          <List items={this.state.pathElems} renderItem={this._renderItem} />
        </Box>
      )
    }
    return <Box>{content}</Box>
  }
}

export default FolderHeader
