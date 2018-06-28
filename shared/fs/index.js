// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalMargins} from '../styles'
import {Box, Divider, Icon, List, ScrollView, Text} from '../common-adapters'
import FolderHeader from './header/container'
import SortBar from './sortbar/container'
import {Still, Editing, Placeholder, Uploading} from './row'
import Footer from './footer/container'
import {isMobile} from '../constants/platform'
import ConnectedBanner from './banner/container'

type FolderProps = {
  items: Array<Types.RowItem>,
  isUserReset: boolean,
  resetParticipants: Array<string>,
  path: Types.Path,
  routePath: I.List<string>,
}

export const wrapRow = (rowContent, key: string) => (
  <Box style={stylesRowContainer} key={key}>
    {rowContent}
    <Divider key="divider" style={stylesDivider} />
  </Box>
)

class Files extends React.PureComponent<FolderProps> {
  _rowRenderer = (index: number, item: Types.RowItem) => {
    switch (item.rowType) {
      case 'placeholder':
        return wrapRow(<Placeholder type={item.type} />, `placeholder:${item.name}`)
      case 'still':
        return wrapRow(<Still path={item.path} routePath={this.props.routePath} />, `still:${item.name}`)
      case 'uploading':
        return wrapRow(<Uploading path={item.path} />, `uploading:${item.name}`)
      case 'editing':
        return wrapRow(
          <Editing editID={item.editID} routePath={this.props.routePath} />,
          `editing:${Types.editIDToString(item.editID)}`
        )
      default:
        /*::
      let rowType = item.rowType
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (rowType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(rowType);
      */
        return wrapRow(<Text type="BodyError">This should not happen.</Text>, '')
    }
  }

  render() {
    const content = this.props.isUserReset ? (
      <Box style={globalStyles.flexBoxColumn}>
        <Box style={resetContainerStyle}>
          <Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
          <Icon type="icon-access-denied-266" />
        </Box>
      </Box>
    ) : this.props.items && this.props.items.length ? (
      <List fixedHeight={rowHeight} items={this.props.items} renderItem={this._rowRenderer} />
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

const rowHeight = isMobile ? 64 : 40

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

const stylesRowContainer = {
  ...globalStyles.flexBoxColumn,
  height: rowHeight,
  minHeight: rowHeight,
  maxHeight: rowHeight,
}

const stylesDivider = {
  marginLeft: 48,
}

export default Files
