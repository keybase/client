// @flow
import * as React from 'react'
import {SafeAreaView} from 'react-native'
import {PeoplePageContent} from './index.shared'
import {type Props} from '.'

const People = (props: Props) => (
  <SafeAreaView>
    <PeoplePageContent {...props} />
  </SafeAreaView>
)

export default People
