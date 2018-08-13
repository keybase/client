// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  heading: string,
  dividerColor?: string,
  headingStyle?: Styles.StylesCrossPlatform,
  children?: React.Node,
|}

const Row = (props: Props) => (
  <React.Fragment>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text
        type="BodyTinySemibold"
        style={Styles.collapseStyles([styles.headingText, props.headingStyle])}
      >
        {props.heading}
      </Kb.Text>
      {props.children}
    </Kb.Box2>
    <Kb.Divider style={props.dividerColor ? {backgroundColor: props.dividerColor} : {}} />
  </React.Fragment>
)

const styles = Styles.styleSheetCreate({
  headingText: {
    color: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.tiny,
  },
  row: {
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default Row
