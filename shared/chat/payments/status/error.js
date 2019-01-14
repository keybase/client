// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  error: string,
  visible: boolean,
}

const items = []

const PaymentStatusError = (props: Props) => {
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodyExtrabold" style={styles.headerError}>
          Failed to send payment
        </Kb.Text>
        <Kb.Divider />
        <Kb.Box2 style={styles.errorContainer} direction="vertical" centerChildren={true} fullWidth={true}>
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
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

const styles = Styles.styleSheetCreate({
  bodyError: Styles.platformStyles({
    common: {color: Styles.globalColors.red, textAlign: 'center'},
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
  errorContainer: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.small,
    },
    isElectron: {
      maxWidth: 200,
      minHeight: 100,
    },
  }),
  headerError: {
    alignSelf: 'center',
    color: Styles.globalColors.red,
    padding: Styles.globalMargins.tiny,
  },
})

export default PaymentStatusError
