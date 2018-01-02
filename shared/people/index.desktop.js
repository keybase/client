// @flow
import * as React from 'react'
import {ScrollView} from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalColors, globalStyles} from '../styles'

const People = (props: Props) => (
  <ScrollView style={{...globalStyles.fullHeight}}>
    <PeoplePageSearchBar
      {...props}
      styleRowContainer={{left: 80}}
      styleSearchContainer={{border: `1px solid ${globalColors.black_05}`, minHeight: 28, width: 273}}
      styleSearchText={{fontSize: 13}}
    />
    <PeoplePageList {...props} />
  </ScrollView>
)

export default People
