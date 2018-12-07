// @flow
import * as React from 'react'
import {Box2, PlainInput, ProgressIndicator, ScrollView} from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalStyles} from '../styles'

// TEMP
import AddSuggestors, * as Suggestors from '../chat/conversation/input-area/suggestors'

const People = (props: Props) => (
  <ScrollView style={{...globalStyles.fullHeight}}>
    {props.waiting && (
      <ProgressIndicator style={{height: 32, left: 96, position: 'absolute', top: 8, width: 32, zIndex: 2}} />
    )}
    <PeoplePageSearchBar
      {...props}
      styleRowContainer={{left: 80}}
      styleSearchContainer={{minHeight: 24, width: 240}}
      styleSearchText={{fontSize: 13}}
    />
    <PeoplePageList {...props} />
    <SuggestorTestArea
      dataSources={{}}
      renderers={{}}
      suggestorToMarker={{}}
      transformers={{}}
      someOtherProps="hi"
    />
  </ScrollView>
)

const _SuggestorTestArea = (props: Suggestors.PropsWithSuggestor<{someOtherProps: string}>) => (
  <Box2
    direction="vertical"
    style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, margin: 20, padding: 10}}
  >
    <PlainInput onChangeText={props.onChangeText} onKeyDown={props.onKeyDown} ref={props.inputRef} />
  </Box2>
)
const SuggestorTestArea = AddSuggestors(_SuggestorTestArea)

export default People
