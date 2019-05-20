// @flow
import * as React from 'react'
import type {AvatarSize} from '../common-adapters/avatar'
import * as Kb from '../common-adapters'
import * as Styles from '../styles/index'

type Props = {|
  usernames: Array<string>,
  maxShown: number,
  size: AvatarSize,
  layout: 'horizontal' | 'vertical',
|}
// TODO: consider making `diagonal` to replace MultiAvatar, but that's hard.

const AvatarLine = (props: Props) => {
  const usernamesToShow = props.usernames.slice(0, props.maxShown)
  const extra = props.usernames.length - usernamesToShow.length
  const reverse = {horizontal: 'horizontalReverse', vertical: 'verticalReverse'}
  return (
    <Kb.Box2 direction={reverse[props.layout]} style={getOverallStyle(props, extra)}>
      {!!extra && (
        <Kb.Box2 direction={props.layout} alignItems="center" style={getOverflowBoxStyle(props)}>
          <Kb.Text type={getTextSize(props.size)} style={getOverflowTextStyle(props)}>
            +{extra}
          </Kb.Text>
        </Kb.Box2>
      )}
      {usernamesToShow
        .map((username, i) => (
          <Kb.Avatar
            size={props.size}
            username={username}
            key={i}
            borderColor="white"
            style={getAvatarStyle(props)}
          />
        ))
        .reverse()}
    </Kb.Box2>
  )
}

const getAvatarStyle = props =>
  props.layout === 'horizontal' ? {marginRight: -props.size / 3} : {marginBottom: -props.size / 3}

const getOverallStyle = (props, extra) =>
  Styles.collapseStyles([
    styles.container,
    extra
      ? {}
      : props.layout === 'horizontal'
      ? {marginRight: props.size / 3 + 2}
      : {marginBottom: props.size / 3 + 2},
  ])

const getOverflowBoxStyle = props =>
  Styles.collapseStyles([
    styles.overflowBox,
    props.layout === 'horizontal'
      ? {
          borderBottomRightRadius: props.size,
          borderTopRightRadius: props.size,
          height: props.size,
          paddingLeft: props.size / 2,
        }
      : {
          borderBottomLeftRadius: props.size,
          borderBottomRightRadius: props.size,
          paddingTop: props.size / 2,
          width: props.size,
        },
  ])

const getOverflowTextStyle = props =>
  Styles.collapseStyles([
    styles.text,
    props.layout === 'horizontal' ? {paddingRight: props.size / 5} : {paddingBottom: props.size / 5},
  ])

const getTextSize = size => (size >= 48 ? 'BodySmallBold' : 'BodyTinyBold')
const styles = Styles.styleSheetCreate({
  container: {
    marginLeft: 2,
  },
  overflowBox: {
    backgroundColor: Styles.globalColors.grey,
    justifyContent: 'flex-end',
  },
  text: {
    color: Styles.globalColors.black_40,
  },
})

export default AvatarLine
