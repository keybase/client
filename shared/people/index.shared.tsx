import * as C from '../constants'
import * as React from 'react'
import * as Kb from '../common-adapters'
import type * as T from '../constants/types'
import Announcement from './announcement/container'
import FollowNotification from './follow-notification'
import FollowSuggestions from './follow-suggestions'
import {noEmail} from '../constants/signup'
import type {Props} from '.'
import Todo from './todo/container'
// import WotTask from './wot-task'

export const itemToComponent: (item: T.People.PeopleScreenItem, props: Props) => React.ReactNode = (
  item,
  props
) => {
  switch (item.type) {
    case 'todo':
      return (
        <Todo
          badged={item.badged}
          confirmLabel={item.confirmLabel}
          icon={item.icon}
          instructions={item.instructions}
          key={item.todoType}
          metadata={item.metadata}
          todoType={item.todoType}
        />
      )
    case 'follow':
    case 'contact':
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
    default:
      return null
  }
}

const EmailVerificationBanner = () => {
  const clearJustSignedUpEmail = C.useSignupState(s => s.dispatch.clearJustSignedUpEmail)
  const signupEmail = C.useSignupState(s => s.justSignedUpEmail)
  React.useEffect(
    () =>
      // Only have a cleanup function
      () => {
        signupEmail && clearJustSignedUpEmail()
      },
    [clearJustSignedUpEmail, signupEmail]
  )

  if (!signupEmail) {
    return null
  }

  if (signupEmail === noEmail) {
    return <Kb.Banner color="green">Welcome to Keybase!</Kb.Banner>
  }
  return (
    <Kb.Banner color="green">{`Welcome to Keybase! A verification link was sent to ${signupEmail}.`}</Kb.Banner>
  )
}

const ResentEmailVerificationBanner = () => {
  const resentEmail = C.usePeopleState(s => s.resentEmail)
  const setResentEmail = C.usePeopleState(s => s.dispatch.setResentEmail)
  React.useEffect(
    () =>
      // Only have a cleanup function
      () => {
        if (resentEmail) {
          setResentEmail('')
        }
      },
    [setResentEmail, resentEmail]
  )

  if (!resentEmail) {
    return null
  }

  return (
    <Kb.Banner color="yellow">
      <Kb.BannerParagraph
        bannerColor="yellow"
        content={`Check your inbox! A verification link was sent to ${resentEmail}.`}
      />
    </Kb.Banner>
  )
}

export const PeoplePageList = React.memo(function PeoplePageList(props: Props) {
  return (
    <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, position: 'relative', width: '100%'}}>
      <EmailVerificationBanner />
      <ResentEmailVerificationBanner />
      {props.newItems
        .filter(item => item.type !== 'todo' || item.todoType !== 'verifyAllEmail' || !props.signupEmail)
        .map(item => itemToComponent(item, props))}
      {/*Array.from(props.wotUpdates, ([key, item]) => (
        <WotTask
          key={key}
          voucher={item.voucher}
          vouchee={item.vouchee}
          status={item.status}
          onClickUser={props.onClickUser}
        />
      ))*/}

      <FollowSuggestions suggestions={props.followSuggestions} />
      {props.oldItems.map(item => itemToComponent(item, props))}
    </Kb.Box>
  )
})
