import * as C from '@/constants'
import * as React from 'react'
import {Banner, BannerParagraph} from './banner'
import {useTrackerState} from '@/stores/tracker2'
import {useProfileState} from '@/stores/profile'

const Kb = {Banner}
type Props = {users?: Array<string>}
type ProofBrokenBannerNonEmptyProps = {users: Array<string>}

const ProofBrokenBannerNonEmpty = (props: ProofBrokenBannerNonEmptyProps) => {
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const showUser = useTrackerState(s => s.dispatch.showUser)
  const onClickUsername = React.useCallback(
    (username: string) => {
      if (C.isMobile) {
        showUserProfile(username)
      } else {
        showUser(username, true)
      }
    },
    [showUser, showUserProfile]
  )
  const content: Array<string | {text: string; onClick: () => void}> =
    props.users.length === 1
      ? [
          'Some of ',
          {onClick: () => onClickUsername(props.users[0]!), text: props.users[0]!},
          "'s proofs have changed since you last followed them.",
        ]
      : [
          ...(props.users.length === 2
            ? [
                {onClick: () => onClickUsername(props.users[0]!), text: props.users[0]!},
                ' and ',
                {onClick: () => onClickUsername(props.users[1]!), text: props.users[1]!},
              ]
            : props.users.reduce<Array<string | {text: string; onClick: () => void}>>(
                (content, user, index, {length}) => [
                  ...content,
                  ...(index === length - 1
                    ? [{onClick: () => onClickUsername(user), text: user}]
                    : index === length - 2
                    ? [{onClick: () => onClickUsername(user), text: user}, ', and ']
                    : [{onClick: () => onClickUsername(user), text: user}, ', ']),
                ],
                []
              )),
          ' have changed their proofs since you last followed them.',
        ]
  return (
    <Kb.Banner color="red">
      <BannerParagraph bannerColor="red" content={content} />
    </Kb.Banner>
  )
}

// Skip hooks if `users` is empty.
const ProofBrokenBanner = (props: Props) =>
  props.users?.length ? <ProofBrokenBannerNonEmpty users={props.users} /> : null

export default ProofBrokenBanner
