// @flow
import * as React from 'react'
import {RefreshControl, SafeAreaView, StyleSheet} from 'react-native'
import {Avatar, ScrollView} from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalColors, globalStyles} from '../styles'

const People = (props: Props) => (
  <SafeAreaView>
    <ScrollView
      style={{...globalStyles.fullHeight}}
      refreshControl={<RefreshControl refreshing={props.waiting} onRefresh={() => props.getData()} />}
    >
      <PeoplePageSearchBar
        {...props}
        styleRowContainer={{left: 0}}
        styleSearchContainer={{
          borderColor: globalColors.black_05,
          borderWidth: StyleSheet.hairlineWidth,
          minHeight: 33,
          width: 233,
        }}
        styleSearchText={{fontSize: 15}}
      />
      <Avatar
        username={props.myUsername}
        onClick={() => props.onClickUser(props.myUsername)}
        size={32}
        style={{position: 'absolute', top: 8, right: 16, zIndex: 2}}
      />
      <PeoplePageList {...props} />
    </ScrollView>
  </SafeAreaView>
)

export default People
