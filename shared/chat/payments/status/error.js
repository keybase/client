// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  attachTo: () => ?React.Component<any>,
  error: string,
  visible: boolean,
}

const items = []
const onHidden = () => {}

const PaymentStatusError = (props: Props) => {
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.Text type="BodyExtrabold" style={styles.headerError}>
          Failed to send payment
        </Kb.Text>
        <Kb.Divider />
        <Kb.Box2
          style={styles.errorContainer}
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          fullHeight={true}
        >
          <Kb.Text type="BodySemibold" style={styles.bodyError}>
            {props.error}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    ),
  }
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={onHidden}
      visible={props.visible}
    />
  )
}

const styles = Styles.styleSheetCreate({
  bodyError: Styles.platformStyles({
    common: {color: Styles.globalColors.red},
    isElectron: {
      textAlign: 'center',
    },
  }),
  errorContainer: Styles.platformStyles({
    isElectron: {
      maxWidth: 200,
      minHeight: 100,
      padding: Styles.globalMargins.small,
    },
  }),
  headerError: {
    alignSelf: 'center',
    color: Styles.globalColors.red,
    padding: Styles.globalMargins.tiny,
  },
})

export default PaymentStatusError
