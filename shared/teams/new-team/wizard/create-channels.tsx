import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'

type Props = {
  teamname: string
}

const CreateChannel = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={props.teamname}>Create channels</ModalTitle>,
      }}
      allowOverflow={true}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.Text type="BodySmall">Banner</Kb.Text>
      </Kb.Box2>
      <Kb.Text type="Header">Add</Kb.Text>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  banner: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blue,
    },
    isElectron: {
      height: 96,
    },
    isMobile: {
      height: 61,
    },
  }),
}))

export default CreateChannel
