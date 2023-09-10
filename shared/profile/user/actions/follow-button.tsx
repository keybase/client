import * as React from 'react'
import * as Kb from '../../../common-adapters'

type Props = {
  disabled?: boolean
  following?: boolean
  followsYou?: boolean
  waitingKey: string | Array<string>
  small?: boolean
  style?: Object
  onFollow?: () => void
  onUnfollow?: () => void
}

const FollowButton = (props: Props) => {
  const [mouseOver, setMouseover] = React.useState(false)
  const {following, followsYou, onFollow, onUnfollow, style, waitingKey, ...otherProps} = props

  if (following) {
    return (
      <Kb.WaitingButton
        type="Success"
        mode="Secondary"
        label={mouseOver ? 'Unfollow' : 'Following'}
        onClick={onUnfollow}
        onMouseEnter={Kb.Styles.isMobile ? undefined : () => setMouseover(true)}
        onMouseLeave={Kb.Styles.isMobile ? undefined : () => setMouseover(false)}
        waitingKey={waitingKey}
        style={props.small ? style : {...styleButton, ...style}}
        {...otherProps}
      />
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
