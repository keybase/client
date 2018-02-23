// @flow
import * as React from 'react'
import {NativeSectionList} from '../../common-adapters/index.native'
import type {Props} from './list.render'

export default (props: Props) => (
  <NativeSectionList
    renderItem={data => props.renderRow(0, data.item)}
    renderSectionHeader={({section}) => (section.tabs ? props.renderRow(1, section.tabs) : null)}
    sections={[
      {
        data: [props.headerRow],
        key: 'headerSection',
      },
      {
        key: 'bodySection',
        data: props.bodyRows.splice(1),
        tabs: props.bodyRows[0],
      },
    ]}
  />
)
