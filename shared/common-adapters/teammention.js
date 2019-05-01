// @flow
import React from 'react'
import * as Kb from '.'
import * as Styles from '../styles'

export type Props = {|
  teamname: string,
  channel: string,
  allowFontScaling?: boolean,
|}

const TeamMention = (props: Props) => (
  <Kb.Text
    type="BodySemibold"
    className={Styles.classNames({'hover-underline': !Styles.isMobile})}
    style={Styles.collapseStyles([styles.team, styles.text])}
    allowFontScaling={props.allowFontScaling}
  >
    @{props.teamname}
    {props.channel.length > 0 && `#${props.channel}`}
  </Kb.Text>
)

const styles = Styles.styleSheetCreate({
  team: {
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
