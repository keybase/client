import * as React from 'react'
import * as Styles from '../styles'

import {Box2} from './box'
import ClickableBox from './clickable-box'
import Avatar from './avatar'
import Text from './text'

type Props = {
  imageUrl: string
  title: string
  description: string
  onClick?: (event: React.BaseSyntheticEvent) => void
}

const Kb = {
  Avatar,
  Box2,
  ClickableBox,
  Text,
}

const RichButton = (props: Props) => {
  const [isPressing, setPressing] = React.useState()

  return (
    <Kb.ClickableBox
      className="hover_container"
      style={Styles.collapseStyles([styles.containerStyle, isPressing && styles.mobileContainer])}
      onClick={props.onClick}
      onPressIn={() => setPressing(true)}
      onPressOut={() => setPressing(false)}
      hoverColor={Styles.globalColors.blueLighter_20}
    >
      <Kb.Avatar imageOverrideUrl={props.imageUrl} style={styles.thumbnail} size={64} />

      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
        <Kb.Text
          className="hover_contained_color_blueDark"
          style={Styles.collapseStyles([styles.title, isPressing && styles.mobileTitle])}
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
  title: {
    marginBottom: Styles.globalMargins.xtiny,
  },
}))

export default RichButton
