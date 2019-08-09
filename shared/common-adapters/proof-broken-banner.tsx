import * as React from 'react'
import * as Container from '../util/container'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import {isMobile} from '../constants/platform'
import {Banner, BannerParagraph} from './banner'

const Kb = {
  Banner,
}

type Props = {
  users: Array<string> | null
}

type ProofBrokenBannerNonEmptyProps = {
  users: Array<string>
}

const ProofBrokenBannerNonEmpty = (props: ProofBrokenBannerNonEmptyProps) => {
  const dispatch = Container.useDispatch()
  const onClickUsername = React.useCallback(
    isMobile
      ? (username: string) => dispatch(ProfileGen.createShowUserProfile({username}))
      : (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
    [dispatch]
  )
  const content: Array<string | {text: string; onClick: () => void}> =
    props.users.length === 1
      ? [
          'Some of ',
          {onClick: () => onClickUsername(props.users[0]), text: props.users[0]},
          "'s proofs hahve changed since you last followed them.",
        ]
      : [
          ...(props.users.length === 2
            ? [
                {onClick: () => onClickUsername(props.users[0]), text: props.users[0]},
                ' and ',
                {onClick: () => onClickUsername(props.users[1]), text: props.users[1]},
              ]
            : props.users.reduce(
                (content, user, index, {length}) => [
                  ...content,
                  ...(index === length - 1
                    ? [{onClick: () => onClickUsername(user), text: user}]
                    : index === length - 2
                    ? [{onClick: () => onClickUsername(user), text: user}, ', and ']
                    : [{onClick: () => onClickUsername(user), text: user}, ', ']),
                ],
                [] as Array<string | {text: string; onClick: () => void}>
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
  props.users && props.users.length ? <ProofBrokenBannerNonEmpty users={props.users} /> : null

export default ProofBrokenBanner
