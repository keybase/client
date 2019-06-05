import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/profile'
import {subtitle as platformSubtitle} from '../../util/platforms'
import Modal from '../modal'

type Props = {
  username: string
  errorMessage?: string | null
  idle: boolean
  onClose: () => void
  onSubmit: () => void
  isWaiting: boolean
}

class Block extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (!prevProps.idle && this.props.idle) {
      this.props.onClose()
    }
  }

  render() {
    const props = this.props
    return (
      <Modal onCancel={props.onClose} skipButton={true}>
        {!!props.errorMessage && (
          <Kb.Box style={styles.errorBanner}>
            <Kb.Text center={!Styles.isMobile} style={styles.errorBannerText} type="BodySemibold">
              {props.errorMessage}
            </Kb.Text>
          </Kb.Box>
        )}
        <Kb.Box style={styles.contentContainer}>
          <Kb.Text center={!Styles.isMobile} style={styles.descriptionText} type="Header">
            Really block {props.username}?
          </Kb.Text>
          <Kb.Text style={styles.reminderText} type="Body">
            Hide them from followers and suggestions.
          </Kb.Text>
          <Kb.Text style={styles.reminderText} type="Body">
            Prevent them from creating new chats or teams with you.
          </Kb.Text>
          <Kb.Text style={styles.reminderText} type="Body">
            They may be able to figure out that you blocked them.
          </Kb.Text>
          <Kb.ButtonBar>
            <Kb.WaitingButton
              type="Dim"
              onClick={props.onClose}
              label="Cancel"
              waitingKey={Constants.waitingKey}
            />
            <Kb.WaitingButton
              type="Danger"
              onClick={props.onSubmit}
              label={'Block'}
              waitingKey={Constants.blockUserWaitingKey}
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Modal>
    )
  }
}

const styles = Styles.styleSheetCreate({
  contentContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    margin: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.large,
    maxWidth: 512,
    ...(Styles.isMobile ? {} : {textAlign: 'center'}),
  },
  descriptionText: {marginTop: Styles.globalMargins.medium},
  errorBanner: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.red,
    justifyContent: 'center',
    minHeight: Styles.globalMargins.large,
    padding: Styles.globalMargins.tiny,
    width: '100%',
  },
  errorBannerText: {
    color: Styles.globalColors.white,
    maxWidth: 512,
  },
  platformSubtitle: {
    color: Styles.globalColors.black_20,
  },
  platformUsername: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      textDecorationLine: 'line-through',
    },
    isElectron: {
      maxWidth: 400,
      overflowWrap: 'break-word',
    },
  }),
  positionRelative: {position: 'relative'},
  reminderText: {marginTop: Styles.globalMargins.tiny},
  siteIcon: Styles.isMobile ? {height: 64, width: 64} : {height: 48, width: 48},
})

export default Block
