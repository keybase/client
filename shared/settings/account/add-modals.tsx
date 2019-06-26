import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import {EnterEmailBody} from '../../signup/email/'
import AddPhone from '../../signup/phone-number/container'
import {Props as HeaderHocProps} from '../../common-adapters/header-hoc/types'

export const Email = () => {
  const dispatch = Container.useDispatch()
  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  return (
    <Kb.Modal
      onClose={onClose}
      header={{title: 'Add an email address'}}
      footer={{
        content: (
          <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
            {!Styles.isMobile && <Kb.Button type="Dim" label="Cancel" fullWidth={true} onClick={onClose} />}
            <Kb.Button label="Continue" fullWidth={true} />
          </Kb.ButtonBar>
        ),
        style: styles.footer,
      }}
      mode="Wide"
    >
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
        style={styles.body}
      >
        <EnterEmailBody />
      </Kb.Box2>
    </Kb.Modal>
  )
}
export const Phone = props => (
  <Kb.Modal>
    <AddPhone {...props} />
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate({
  body: {
    ...Styles.padding(
      Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xlarge,
      Styles.globalMargins.small,
      0
    ),
    backgroundColor: Styles.globalColors.blueGrey,
    flexGrow: 1,
  },
  buttonBar: {
    minHeight: undefined,
  },
  footer: {
    ...Styles.padding(Styles.globalMargins.small),
  },
})
