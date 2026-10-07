import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

type Props = {
  disabled?: boolean
  following?: boolean
  followsYou?: boolean
  waitingKey: T.Waiting.WaitingKeys
  small?: boolean
  style?: object
  onFollow?: () => void
  onUnfollow?: () => void
}

const FollowButton = (props: Props) => {
  const [mouseOver, setMouseover] = React.useState(false)
  const {following, followsYou, onFollow, onUnfollow, style, waitingKey, ...otherProps} = props

  if (following) {
    const button = (
      <Kb.WaitingButton
        type="Success"
        mode="Secondary"
        label={mouseOver ? 'Unfollow' : 'Following'}
        onClick={onUnfollow}
        waitingKey={waitingKey}
        style={props.small ? style : {...styleButton, ...style}}
        {...otherProps}
      />
    )
    if (isMobile) {
      return button
    }
    return (
      <Kb.Box2
        direction="vertical"
        onMouseEnter={() => setMouseover(true)}
        onMouseLeave={() => setMouseover(false)}
      >
        {button}
      </Kb.Box2>
    )
  } else {
    return (
      <Kb.WaitingButton
        type="Success"
        label={followsYou ? 'Follow back' : 'Follow'}
        onClick={onFollow}
        waitingKey={waitingKey}
        style={props.small ? style : {...styleButton, ...style}}
        {...otherProps}
      />
    )
  }
}

const styleButton = Kb.Styles.platformStyles({
  isElectron: {width: 125},
})

export default FollowButton
