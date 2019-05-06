// @flow
import React from 'react'
import Text from '../../../common-adapters/text'
import * as Styles from '../../../styles'

const Kb = {Text}

type Props = {|
  allowFontScaling?: boolean,
  channel: string,
  name: string,
  style?: Styles.StylesCrossPlatform,
|}

const UnknownMention = (props: Props) => {
  let text = `@${props.name}`
  if (props.channel.length > 0) {
    text += `#${props.channel}`
  }
  return (
    <Kb.Text
      type="Body"
      className={Styles.classNames({'hover-underline': !Styles.isMobile})}
      allowFontScaling={props.allowFontScaling}
      style={Styles.collapseStyles([props.style, styles.text])}
    >
      {text}
    </Kb.Text>
  )
}

const styles = Styles.styleSheetCreate({
  text: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.grey,
      borderRadius: 2,
      letterSpacing: 0.3,
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
})

export default UnknownMention
