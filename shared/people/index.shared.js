// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Todo from './todo/container'
import FollowNotification from './follow-notification'
import Announcement from './announcement/container'
import FollowSuggestions from './follow-suggestions'
import {type Props} from '.'

export const itemToComponent: (Types.PeopleScreenItem, Props) => React.Node = (item, props) => {
  switch (item.type) {
    case 'todo':
      return (
        <Todo
          badged={item.badged}
          todoType={item.todoType}
          instructions={item.instructions}
          confirmLabel={item.confirmLabel}
          dismissable={item.dismissable}
          icon={item.icon}
          key={item.todoType}
        />
      )
    case 'notification':
      return (
        <FollowNotification
          type={item.type}
          newFollows={item.newFollows}
          notificationTime={item.notificationTime}
          badged={item.badged}
          numAdditional={item.numAdditional}
          key={item.notificationTime}
          onClickUser={props.onClickUser}
        />
      )
    case 'announcement':
      return (
        <Announcement
          appLink={item.appLink}
          badged={item.badged}
          confirmLabel={item.confirmLabel}
          dismissable={item.dismissable}
          iconUrl={item.iconUrl}
          key={item.text}
          text={item.text}
          url={item.url}
        />
      )
  }
  return null
}

export const PeoplePageSearchBar = (
  props: Props & {
    styleRowContainer?: any,
    styleSearchContainer?: any,
    styleSearch?: any,
    styleSearchText?: any,
  }
) => (
  <Kb.Box style={Styles.collapseStyles([styleRowContainer, props.styleRowContainer])}>
    <Kb.ClickableBox
      onClick={props.onSearch}
      style={Styles.collapseStyles([styleSearchContainer, props.styleSearchContainer])}
    >
      <Kb.Icon
        style={Styles.collapseStyles([styleSearch, props.styleSearch])}
        type="iconfont-search"
        color={Styles.globalColors.black_20}
      />
      <Kb.Text style={Styles.collapseStyles([styleSearchText, props.styleSearchText])} type="Body">
        Search people
      </Kb.Text>
    </Kb.ClickableBox>
  </Kb.Box>
)

const styleRowContainer = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  height: 48,
  position: 'absolute',
  top: 0,
  right: 0,
  backgroundColor: Styles.globalColors.white_90,
  zIndex: 1,
}

export const PeoplePageList = (props: Props) => (
  <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, width: '100%', position: 'relative', marginTop: 48}}>
    {props.newItems.map(item => itemToComponent(item, props))}
    <FollowSuggestions suggestions={props.followSuggestions} />
    {props.oldItems.map(item => itemToComponent(item, props))}
  </Kb.Box>
)

const styleSearchContainer = {
  ...Styles.globalStyles.flexBoxRow,
  ...Styles.desktopStyles.clickable,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: Styles.globalColors.black_10,
  borderRadius: Styles.borderRadius,
  justifyContent: 'center',
  zIndex: 20,
}

const styleSearch = {
  padding: Styles.globalMargins.xtiny,
}

const styleSearchText = {
  ...styleSearch,
  color: Styles.globalColors.black_40,
  position: 'relative',
  top: -1,
}
