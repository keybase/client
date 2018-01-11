// @flow
import * as React from 'react'
import {ProgressIndicator, ScrollView} from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalColors, globalStyles} from '../styles'

const noScrollBarStyle = `
  .noScrollBar::-webkit-scrollbar: {
    display: 'none';
  }
}`

const People = (props: Props) => (
  <ScrollView style={{...globalStyles.fullHeight}}>
    <style>{noScrollBarStyle}</style>
    {props.waiting && (
      <ProgressIndicator style={{position: 'absolute', top: 8, left: 96, zIndex: 2, width: 32, height: 32}} />
    )}
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
