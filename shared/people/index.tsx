import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import type * as T from '@/constants/types'
import Announcement from './announcement'
import FollowNotification from './follow-notification'
import FollowSuggestions from './follow-suggestions'
import Todo from './todo'
import {clearSignupEmail} from './signup-email'

type Props = {
  dismissAnnouncement: (id: T.RPCGen.HomeScreenAnnouncementID) => void
  followSuggestions: ReadonlyArray<T.People.FollowSuggestion>
  getData: (markViewed?: boolean, force?: boolean) => void
  oldItems: T.Immutable<Array<T.People.PeopleScreenItem>>
  newItems: T.Immutable<Array<T.People.PeopleScreenItem>>
  onClickUser: (username: string) => void
  resentEmail: string
  setResentEmail: (email: string) => void
  signupEmail: string
  skipTodo: (type: T.People.TodoType) => void
  myUsername: string
}
type WrapProps = {waiting: boolean} & Props

const renderPeopleItem = (item: T.Immutable<T.People.PeopleScreenItem>, props: Props): React.ReactNode => {
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
          setResentEmail={props.setResentEmail}
          skipTodo={props.skipTodo}
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
          dismissAnnouncement={props.dismissAnnouncement}
          getData={props.getData}
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

const shouldRenderNewItem = (item: T.Immutable<T.People.PeopleScreenItem>, signupEmail: string) =>
  item.type !== 'todo' || item.todoType !== 'verifyAllEmail' || !signupEmail

function EmailVerificationBanner(props: {signupEmail: string}) {
  const {signupEmail} = props
  React.useEffect(
    () => () => {
      if (signupEmail) {
        clearSignupEmail()
      }
    },
    [signupEmail]
  )

  if (!signupEmail) {
    return null
  }

  if (signupEmail === C.noEmail) {
    return <Kb.Banner color="green">Welcome to Keybase!</Kb.Banner>
  }
  return (
    <Kb.Banner color="green">{`Welcome to Keybase! A verification link was sent to ${signupEmail}.`}</Kb.Banner>
  )
}

function ResentEmailVerificationBanner(props: {
  resentEmail: string
  setResentEmail: (email: string) => void
}) {
  const {resentEmail, setResentEmail} = props
  React.useEffect(
    () => () => {
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

function PeoplePageList(props: Props) {
  const visibleNewItems = props.newItems.filter(item => shouldRenderNewItem(item, props.signupEmail))

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} relative={true} testID={TestIDs.PEOPLE_FEED}>
      <EmailVerificationBanner signupEmail={props.signupEmail} />
      <ResentEmailVerificationBanner resentEmail={props.resentEmail} setResentEmail={props.setResentEmail} />
      {visibleNewItems.map((item): React.ReactNode => renderPeopleItem(item, props))}
      <FollowSuggestions suggestions={props.followSuggestions} />
      {props.oldItems.map((item): React.ReactNode => renderPeopleItem(item, props))}
    </Kb.Box2>
  )
}

function People(props: WrapProps) {
  const {waiting, ...rest} = props
  // destructure so the compiler keys onRefresh on getData, not the whole props object
  const {getData} = props
  const onRefresh = () => getData(false, true)
  return (
    <Kb.ScrollView style={styles.container} refreshing={waiting} onRefresh={onRefresh}>
      {!isMobile && waiting && <Kb.ProgressIndicator style={styles.progress} />}
      <PeoplePageList {...rest} />
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {...Kb.Styles.globalStyles.fullHeight},
  progress: {
    ...Kb.Styles.size(24),
    left: 40,
    position: 'absolute',
    top: -72,
  },
}))

export default People
