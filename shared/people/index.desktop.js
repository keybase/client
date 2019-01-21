// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalStyles} from '../styles'

const People = (props: Props) => (
  <Kb.ScrollView style={{...globalStyles.fullHeight}}>
    {props.waiting && (
      <Kb.ProgressIndicator style={{height: 32, left: 96, position: 'absolute', top: 8, width: 32, zIndex: 2}} />
    )}
    <Kb.Box2 direction="horizontal" centerChildren={true}>
      <PeoplePageSearchBar {...props} />
    </Kb.Box2>
    <PeoplePageList {...props} />
  </Kb.ScrollView>
)

export default People
