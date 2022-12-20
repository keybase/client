import * as React from 'react'
import * as Styles from '../styles'

import {Box2} from './box'
import ClickableBox from './clickable-box'
import Avatar from './avatar'
import Text from './text'
import type {IconType} from './icon.constants-gen'
import Icon from './icon'

type Props = {
  icon: IconType
  title: string
  description: string
  onClick?: (event: React.BaseSyntheticEvent) => void
}

const Kb = {
  Avatar,
  Box2,
  ClickableBox,
  Icon,
  Text,
}

const RichButton = (props: Props) => {
  const [isPressing, setPressing] = React.useState(false)

  return (
    <Kb.ClickableBox
      className="hover_container"
      style={Styles.collapseStyles([styles.containerStyle, isPressing && styles.mobileContainer])}
      onClick={props.onClick}
      onPressIn={() => setPressing(true)}
      onPressOut={() => setPressing(false)}
      hoverColor={Styles.globalColors.blueLighter_20}
    >
      <Kb.Icon type={props.icon} style={styles.thumbnail} />

      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne} gap="xtiny">
        <Kb.Text
          className="hover_contained_color_blueDark"
          style={isPressing ? styles.mobileTitle : undefined}
          type="BodySemibold"
        >
          {props.title}
        </Kb.Text>
        <Kb.Text type="BodySmall">{props.description}</Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  containerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    justifyContent: 'flex-start',
    padding: Styles.globalMargins.small,
  },
  mobileContainer: {
    backgroundColor: Styles.globalColors.blueLighter_20,
  },
  mobileTitle: {
    color: Styles.globalColors.blueDark,
  },
  thumbnail: {
    marginRight: Styles.globalMargins.small,
  },
}))

export default RichButton
