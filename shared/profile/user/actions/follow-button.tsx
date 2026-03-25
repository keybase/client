import * as Kb from '@/common-adapters'
import * as React from 'react'

type Props = {
  disabled?: boolean
  following?: boolean
  followsYou?: boolean
  waitingKey: string | Array<string>
  small?: boolean
  style?: object
  onFollow?: () => void
  onUnfollow?: () => void
}

const getButtonStyle = (small: boolean | undefined, style: object | undefined) =>
  small ? style : {...styleButton, ...style}

const FollowButton = ({
  following,
  followsYou,
  onFollow,
  onUnfollow,
  small,
  style,
  waitingKey,
  ...buttonProps
}: Props) => {
  const [mouseOver, setMouseOver] = React.useState(false)
  const sharedProps = {
    ...buttonProps,
    style: getButtonStyle(small, style),
    waitingKey,
  }

  if (!following) {
    return (
      <Kb.WaitingButton
        {...sharedProps}
        type="Success"
        label={followsYou ? 'Follow back' : 'Follow'}
        onClick={onFollow}
      />
    )
  }

  const button = (
    <Kb.WaitingButton
      {...sharedProps}
      type="Success"
      mode="Secondary"
      label={mouseOver ? 'Unfollow' : 'Following'}
      onClick={onUnfollow}
    />
  )

  return Kb.Styles.isMobile ? (
    button
  ) : (
    <Kb.Box2
      direction="vertical"
      onMouseOver={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
    >
      {button}
    </Kb.Box2>
  )
}

const styleButton = Kb.Styles.platformStyles({
  isElectron: {width: 125},
})

export default FollowButton
