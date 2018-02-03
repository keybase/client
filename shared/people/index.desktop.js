// @flow
import * as React from 'react'
import {ProgressIndicator, ScrollView} from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalStyles} from '../styles'

const People = (props: Props) => (
  <ScrollView style={{...globalStyles.fullHeight}}>
    {props.waiting && (
      <ProgressIndicator style={{position: 'absolute', top: 8, left: 96, zIndex: 2, width: 32, height: 32}} />
    )}
    <PeoplePageSearchBar
      {...props}
      styleRowContainer={{left: 80}}
      styleSearchContainer={{minHeight: 24, width: 240}}
      styleSearchText={{fontSize: 13}}
    />
    <PeoplePageList {...props} />
  </ScrollView>
)

export default People
