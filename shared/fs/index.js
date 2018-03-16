// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles} from '../styles'
import {Box, List} from '../common-adapters'
import FolderHeader from './header/container'
import SortBar from './sortbar/container'
import {Row, Placeholder} from './row'
import Footer from './footer/container'

type FolderProps = {
  items: Array<Types.Path>,
  path: Types.Path,
  progress: 'pending' | 'loaded',
}

class Files extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => <Row key={Types.pathToString(item)} path={item} />
  _renderRowPlaceholder = index => <Placeholder key={index} />

  render() {
    const list =
      this.props.progress === 'pending' ? (
        <List items={['1', '2', '3']} renderItem={this._renderRowPlaceholder} />
      ) : (
        <List items={this.props.items} renderItem={this._renderRow} />
      )
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          <FolderHeader path={this.props.path} />
          <SortBar path={this.props.path} />
          {list}
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

export default Files
