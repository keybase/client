// @flow
import React from 'react'
import Text from '../../../common-adapters/text'
import * as Styles from '../../../styles'
import {TeamInfo} from '../../../profile/user/teams'

export type Props = {|
  allowFontScaling?: boolean,
  channel: string,
  description?: string,
  isOpen: boolean,
  name: string,
  resolved: boolean,
  numMembers?: number,
  publicAdmins: Array<string>,
  style?: Styles.StylesCrossPlatform,
|}

const TeamMention = (props: Props) => {
  let text = `@${props.name}`
  if (props.channel.length > 0) {
    text += `#${props.channel}`
  }
  return props.resolved ? (
    <Text
      type="BodySemibold"
      className={Styles.classNames({'hover-underline': !Styles.isMobile})}
      style={Styles.collapseStyles([props.style, styles.resolved, styles.text])}
      allowFontScaling={props.allowFontScaling}
    >
      {text}
    </Text>
  ) : (
    <Text type="Body" style={props.style} allowFontScaling={props.allowFontScaling}>
      {text}
    </Text>
  )
}

const styles = Styles.styleSheetCreate({
  resolved: {
    backgroundColor: Styles.globalColors.blue,
    borderRadius: 2,
    color: Styles.globalColors.white,
  },
  text: Styles.platformStyles({
    common: {
      letterSpacing: 0.3,
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
})

export default TeamMention
