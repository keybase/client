// @flow
import * as React from 'react'
import {List} from '../../../common-adapters'
import renderMemberRow from './member-row/container'
import type {MemberRow} from '../row-types'

export type Props = {
  members: Array<MemberRow>,
}

export const Members = (props: Props) => (
  <List items={props.members} fixedHeight={48} renderItem={renderMemberRow} style={{alignSelf: 'stretch'}} />
)
