// @flow
import * as React from 'react'
import {NativeSectionList} from '../../common-adapters/index.native'
import type {Props} from './list.render'

class List extends React.Component<Props> {
  _renderSectionHeader = ({section}) => (section.tabs ? this.props.renderRow(1, section.tabs) : null)
  _renderRow = data => this.props.renderRow(0, data.item)

  render() {
    const sections = [
      {
        data: [this.props.rows[0]],
        key: 'headerSection',
      }, /*,      {        key: 'bodySection',        data: props.bodyRows.splice(1),        tabs: props.bodyRows[0],      }, */
    ]
    return (
      <NativeSectionList
        alwaysBounceVertical={false}
        renderItem={this._renderRow}
        renderSectionHeader={this._renderSectionHeader}
        stickySectionHeadersEnabled={true}
        sections={sections}
        style={listStyle}
        contentContainerStyle={contentContainerStyle}
      />
    )
  }
}

const listStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

const contentContainerStyle = {
  display: 'flex',
  flexGrow: 1,
}

export default List
