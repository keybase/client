import * as React from 'react'
import * as Types from '../constants/types/people'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Todo from './todo/container'
import FollowNotification from './follow-notification'
import Announcement from './announcement/container'
import FollowSuggestions from './follow-suggestions'
import {Props} from '.'
import AirdropBanner from '../wallets/airdrop/banner/container'

export const itemToComponent: (item: Types.PeopleScreenItem, props: Props) => React.ReactNode = (
  item,
  props
) => {
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
          key={String(item.notificationTime.getTime())}
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
          id={item.id}
          key={item.text}
          text={item.text}
          url={item.url}
        />
      )
  }
  return null
}

export const PeoplePageList = (props: Props) => (
  <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, position: 'relative', width: '100%'}}>
    {Styles.isMobile && <AirdropBanner />}
    {props.newItems.map(item => itemToComponent(item, props))}
    <FollowSuggestions suggestions={props.followSuggestions} />
    {props.oldItems.map(item => itemToComponent(item, props))}
  </Kb.Box>
)
