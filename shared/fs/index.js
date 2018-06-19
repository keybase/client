// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalMargins} from '../styles'
import {Box, Icon, List, ScrollView, Text} from '../common-adapters'
import FolderHeader from './header/container'
import SortBar from './sortbar/container'
import {Still, Editing, Placeholder, rowHeight} from './row'
import Footer from './footer/container'
import {isMobile} from '../constants/platform'
import ConnectedBanner from './banner/container'

type FolderProps = {
  stillItems: Array<Types.Path>,
  editingItems: Array<Types.EditID>,
  isUserReset: boolean,
  resetParticipants: Array<string>,
  path: Types.Path,
  routePath: I.List<string>,
  progress: 'pending' | 'loaded',
}

type StillRowItem = {
  type: 'still',
  path: Types.Path,
}

type EditingRowItem = {
  type: 'editing',
  editID: Types.EditID,
}

type PlaceholderRowItem = {
  type: 'placeholder',
  key: string,
}

type RowItem = StillRowItem | EditingRowItem | PlaceholderRowItem

class Files extends React.PureComponent<FolderProps> {
  _mapPropsToRowItems = (): Array<RowItem> =>
    this.props.progress === 'pending'
      ? [{type: 'placeholder', key: '1'}, {type: 'placeholder', key: '2'}, {type: 'placeholder', key: '3'}]
      : this.props.editingItems
          .map((editID: Types.EditID): EditingRowItem => ({
            type: 'editing',
            editID,
          }))
          .concat(
            this.props.stillItems.map((path: Types.Path): StillRowItem => ({
              type: 'still',
              path,
            }))
          )

  _rowRenderer = (index: number, item: RowItem) => {
    switch (item.type) {
      case 'placeholder':
        return <Placeholder key={item.key} />
      case 'still':
        return <Still key={Types.pathToString(item.path)} path={item.path} routePath={this.props.routePath} />
      case 'editing':
        return (
          <Editing
            key={Types.editIDToString(item.editID)}
            editID={item.editID}
            routePath={this.props.routePath}
          />
        )
      default:
        /*::
      let type = item.type
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(type);
      */
        return <Text type="BodyError">This should not happen.</Text>
    }
  }

  render() {
    const rowItems = this._mapPropsToRowItems()
    const content = this.props.isUserReset ? (
      <Box style={globalStyles.flexBoxColumn}>
        <Box style={resetContainerStyle}>
          <Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
          <Icon type="icon-access-denied-266" />
        </Box>
      </Box>
    ) : rowItems && rowItems.length ? (
      <List fixedHeight={rowHeight} items={rowItems} renderItem={this._rowRenderer} />
    ) : (
      <Box style={stylesEmptyContainer}>
        <Text type="BodySmall">This is an empty folder.</Text>
      </Box>
    )
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          <FolderHeader path={this.props.path} routePath={this.props.routePath} />
          <SortBar path={this.props.path} />
          {isMobile && this.props.resetParticipants.length > 0 ? (
            <ScrollView>
              <ConnectedBanner path={this.props.path} />
              <Box>{content}</Box>
            </ScrollView>
          ) : (
            content
          )}
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

const resetContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginTop: 2 * globalMargins.xlarge,
}

export default Files
