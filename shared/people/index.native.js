// @flow
import * as React from 'react'
import {
  Avatar,
  NativeSafeAreaView,
  NativeRefreshControl,
  NativeStyleSheet,
  ScrollView,
} from '../common-adapters/index.native'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalColors, globalStyles} from '../styles'
import {isIOS} from '../constants/platform'

const People = (props: Props) => (
  <NativeSafeAreaView>
    <ScrollView
      style={{...globalStyles.fullHeight}}
      refreshControl={
        <NativeRefreshControl refreshing={isIOS ? false : props.waiting} onRefresh={() => props.getData()} />
      }
    >
      <PeoplePageSearchBar
        {...props}
        styleRowContainer={{left: 0}}
        styleSearchContainer={{
          borderColor: globalColors.black_05,
          borderWidth: NativeStyleSheet.hairlineWidth,
          minHeight: 33,
          width: 200,
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
  </NativeSafeAreaView>
)

export default People
