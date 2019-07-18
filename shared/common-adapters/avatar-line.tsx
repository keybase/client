import * as React from 'react'
import Avatar, {AvatarSize} from './avatar'
import {Box2} from './box'
import Text from './text'
import * as Styles from '../styles/index'

const Kb = {
  Avatar,
  Box2,
  Text,
}

type Props = {
  usernames: Array<string>
  maxShown: number
  size: AvatarSize
  layout: 'horizontal' | 'vertical'
}

// TODO: consider making `diagonal` to replace MultiAvatar, but that's hard.

const AvatarLine = (props: Props) => {
  const usernamesToShow = props.usernames.slice(0, props.maxShown)
  const extra = props.usernames.length - usernamesToShow.length
  const reverse = {horizontal: 'horizontalReverse', vertical: 'verticalReverse'} as const
  const styles = styleMap[props.size][props.layout]
  return (
    <Kb.Box2 direction={reverse[props.layout]} style={styles.container}>
      {!!extra && (
        <Kb.Box2 direction={props.layout} alignItems="center" style={styles.overflowBox}>
          <Kb.Text type={getTextSize(props.size)} style={styles.text}>
            +{extra}
          </Kb.Text>
        </Kb.Box2>
      )}
      {usernamesToShow
        .map(username => (
          <Kb.Avatar
            size={props.size}
            username={username}
            key={username}
            borderColor="white"
            style={styles.avatar}
          />
        ))
        .reverse()}
    </Kb.Box2>
  )
}

const getTextSize = size => (size >= 48 ? 'BodySmallBold' : 'BodyTinyBold')

const avatarSizes: Array<AvatarSize> = [128, 96, 64, 48, 32, 24, 16]

const styleMap = avatarSizes.reduce(
  (styles, size) => ({
    ...styles,
    [size]: {
      horizontal: Styles.styleSheetCreate({
        avatar: {
          marginRight: -size / 3,
        },
        container: {
          marginLeft: 2,
          marginRight: size / 3 + 2,
        },
        overflowBox: {
          backgroundColor: Styles.globalColors.grey,
          borderBottomRightRadius: size,
          borderTopRightRadius: size,
          height: size,
          justifyContent: 'flex-end',
          paddingLeft: size / 2,
        },
        text: {
          color: Styles.globalColors.black_50,
          paddingRight: size / 5,
        },
      }),
      vertical: Styles.styleSheetCreate({
        avatar: {
          marginBottom: -size / 3,
        },
        container: {
          marginBottom: size / 3 + 2,
          marginTop: 2,
        },
        overflowBox: {
          backgroundColor: Styles.globalColors.grey,
          borderBottomLeftRadius: size,
          borderBottomRightRadius: size,
          justifyContent: 'flex-end',
          paddingTop: size / 2,
          width: size,
        },
        text: {
          color: Styles.globalColors.black_50,
          paddingBottom: size / 5,
        },
      }),
    },
  }),
  {}
)

export default AvatarLine
