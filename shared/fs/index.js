// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalMargins} from '../styles'
import {Box, Divider, Icon, List, ScrollView, Text} from '../common-adapters'
import FolderHeader from './header/container'
import SortBar from './sortbar/container'
import {TlfType, Tlf, Still, Editing, Placeholder, Uploading} from './row/containers'
import Footer from './footer/footer'
import {isMobile} from '../constants/platform'
import ConnectedResetBanner from './banner/reset-banner/container'

type FolderProps = {
  isUserReset: boolean,
  items: Array<Types.RowItem>,
  path: Types.Path,
  resetParticipants: Array<string>,
  routePath: I.List<string>,
}

export const WrapRow = ({children}: {children: React.Node}) => (
  <Box style={stylesRowContainer}>
    {children}
    <Divider key="divider" style={stylesDivider} />
  </Box>
)

class Files extends React.PureComponent<FolderProps> {
  _rowRenderer = (index: number, item: Types.RowItem) => {
    switch (item.rowType) {
      case 'placeholder':
        return (
          <WrapRow key={`placeholder:${item.name}`}>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case 'tlf-type':
        return (
          <WrapRow key={`still:${item.name}`}>
            <TlfType name={item.name} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'tlf':
        return (
          <WrapRow key={`still:${item.name}`}>
            <Tlf name={item.name} tlfType={item.tlfType} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'still':
        return (
          <WrapRow key={`still:${item.name}`}>
            <Still name={item.name} path={item.path} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'uploading':
        return (
          <WrapRow key={`uploading:${item.name}`}>
            <Uploading name={item.name} path={item.path} />
          </WrapRow>
        )
      case 'editing':
        return (
          <WrapRow key={`editing:${Types.editIDToString(item.editID)}`}>
            <Editing editID={item.editID} routePath={this.props.routePath} />
          </WrapRow>
        )
      default:
        /*::
      let rowType = item.rowType
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (rowType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(rowType);
      */
        return (
          <WrapRow key="">
            <Text type="BodySmallError">This should not happen.</Text>
          </WrapRow>
        )
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
              <ConnectedResetBanner path={this.props.path} />
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
