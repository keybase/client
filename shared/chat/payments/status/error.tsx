import * as React from 'react'
import * as Styles from '../../../styles'
import {Box2} from '../../../common-adapters/box'
import Divider from '../../../common-adapters/divider'
import Text from '../../../common-adapters/text'
import FloatingMenu from '../../../common-adapters/floating-menu'

// This is actually a dependency of common-adapters/markdown so we have to treat it like a common-adapter, no * import allowed
const Kb = {
  Box2,
  Divider,
  FloatingMenu,
  Text,
}

type Props = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  error: string
  visible: boolean
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
    common: {color: Styles.globalColors.redDark, textAlign: 'center'},
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
    color: Styles.globalColors.redDark,
    padding: Styles.globalMargins.tiny,
  },
})

export default PaymentStatusError
