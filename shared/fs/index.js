// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles} from '../styles'
import {Box, List, Text} from '../common-adapters'
import FolderHeader from './header/container'
import SortBar from './sortbar/container'
import {Row, Placeholder} from './row'
import Footer from './footer/container'

type FolderProps = {
  items: Array<Types.Path>,
  path: Types.Path,
  routePath: I.List<string>,
  progress: 'pending' | 'loaded',
}

class Files extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => (
    <Row key={Types.pathToString(item)} path={item} routePath={this.props.routePath} />
  )
  _renderRowPlaceholder = index => <Placeholder key={index} />

  render() {
    const content =
      this.props.progress === 'pending' ? (
        <List items={['1', '2', '3']} renderItem={this._renderRowPlaceholder} />
      ) : this.props.items.length === 0 ? (
        <Box style={stylesEmptyContainer}>
          <Text type="BodySmall">This is an empty folder.</Text>
        </Box>
      ) : (
        <List items={this.props.items} renderItem={this._renderRow} />
      )
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          <FolderHeader path={this.props.path} routePath={this.props.routePath} />
          <SortBar path={this.props.path} />
          {content}
          <Footer />
        </Box>
      </Box>
    )
  }
}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
}

const stylesEmptyContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
}

export default Files
