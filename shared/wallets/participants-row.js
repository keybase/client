// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type Props = {|
  heading: string,
  bottomDivider?: boolean,
  headingAlignment: 'Left' | 'Right',
  dividerColor?: string,
  headingStyle?: Styles.StylesCrossPlatform,
  children?: React.Node,
|}

const Row = (props: Props) => (
  <React.Fragment>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text
        type="BodyTinySemibold"
        style={Styles.collapseStyles([
          styles.headingText,
          props.headingAlignment === 'Right' ? {textAlign: 'right', width: 32} : {},
          props.headingStyle,
        ])}
      >
        {props.heading}
      </Kb.Text>
      {props.children}
    </Kb.Box2>
    {props.bottomDivider && (
      <Kb.Divider style={props.dividerColor ? {backgroundColor: props.dividerColor} : {}} />
    )}
  </React.Fragment>
)

Row.defaultProps = {
  headingAlignment: 'Left',
  bottomDivider: true,
}

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
