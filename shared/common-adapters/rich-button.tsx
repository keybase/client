import * as React from 'react'
import * as Styles from '../styles'

import {Box2} from './box'
import ClickableBox from './clickable-box'
import Avatar from './avatar'
import Text from './text'

type Props = {
  image: string
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

const RichButton = (props: Props) => (
  <Kb.ClickableBox
    className="hover_container"
    style={styles.containerStyle}
    onClick={props.onClick}
    hoverColor={Styles.globalColors.blueLighter_20}
  >
    <Kb.Avatar imageOverrideUrl={props.image} style={styles.thumbnail} size={64}></Kb.Avatar>

    <Kb.Box2 direction="vertical">
      <Kb.Text className="hover_contained_color_blueDark" style={styles.title} type="BodySemibold">
        {props.title}
      </Kb.Text>
      <Kb.Text type="BodySmall">{props.description}</Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(() => ({
  containerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    justifyContent: 'center',
    padding: Styles.globalMargins.small,
  },
  title: {
    marginBottom: Styles.globalMargins.xtiny,
  },
  thumbnail: {
    marginRight: Styles.globalMargins.small,
  },
}))

export default RichButton
