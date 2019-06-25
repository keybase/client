import * as React from 'react'
import WaitingButton from '../waiting-button'
import {Box, Box2} from '../box'
import HeaderOrPopup from '../header-or-popup'
import ButtonBar from '../button-bar'
import Banner from '../banner'
import Icon from '../icon'
import ScrollView from '../scroll-view'
import Text from '../text'
import * as Styles from '../../styles'
import {IconType} from '../icon.constants'

// generally one of icon or header will be given
export type Props = {
  confirmText?: string
  content?: React.ReactNode
  description: string
  error?: string
  header?: React.ReactNode
  icon?: IconType
  onCancel: () => void | null
  onConfirm: () => void | null
  prompt: string
  waitingKey?: string
}

class _ConfirmModal extends React.PureComponent<Props> {
  render() {
    const iconType = this.props.icon || 'iconfont-wrenches' // for flow
    return (
      <Box style={styles.mobileFlex}>
        <Box2 direction="vertical" style={styles.container}>
          {this.props.error && <Banner color="red" text={this.props.error} />}
          <Box2 direction="vertical" style={styles.container2}>
            <ScrollView contentContainerStyle={{flexGrow: 1}}>
              <Box2
                alignItems="center"
                direction="vertical"
                centerChildren={true}
                fullWidth={true}
                fullHeight={true}
                style={styles.inner}
              >
                {this.props.icon && (
                  <Icon
                    boxStyle={styles.icon}
                    color={Styles.globalColors.black_50}
                    fontSize={Styles.isMobile ? 64 : 48}
                    style={styles.icon}
                    type={iconType}
                  />
                )}
                {this.props.header && (
                  <Box2 alignItems="center" direction="vertical" style={styles.icon}>
                    {this.props.header}
                  </Box2>
                )}
                <Text center={true} style={styles.text} type="HeaderBig">
                  {this.props.prompt}
                </Text>
                <Text center={true} style={styles.text} type="Body">
                  {this.props.description}
                </Text>
                {this.props.content}
              </Box2>
            </ScrollView>
          </Box2>
        </Box2>
        <Box2 direction="horizontal" style={styles.buttonBox}>
          <ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            {!Styles.isMobile && (
              <WaitingButton
                disabled={!this.props.onCancel}
                type="Dim"
                label="Cancel"
                onClick={this.props.onCancel}
                style={styles.button}
                waitingKey={this.props.waitingKey}
              />
            )}
            <WaitingButton
              disabled={!this.props.onConfirm}
              type="Danger"
              label={this.props.confirmText || 'Confirm'}
              onClick={this.props.onConfirm}
              style={styles.button}
              waitingKey={this.props.waitingKey}
            />
          </ButtonBar>
        </Box2>
      </Box>
    )
  }
}
const ConfirmModal = HeaderOrPopup(_ConfirmModal)

const styles = Styles.styleSheetCreate({
  button: {
    flex: 1,
  },
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 40,
    },
  }),
  buttonBox: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      padding: Styles.globalMargins.xsmall,
    },
    isElectron: {
      borderRadius: 4,
    },
  }),
  container: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      overflow: 'hidden',
      padding: 0,
      width: 560,
    },
    isMobile: {
      flex: 1,
      width: '100%',
    },
  }),
  container2: Styles.platformStyles({
    isElectron: {
      padding: 64,
    },
  }),
  errorBannerText: {
    color: Styles.globalColors.white,
    maxWidth: 512,
  },
  icon: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  inner: {
    backgroundColor: Styles.globalColors.white,
  },
  mobileFlex: Styles.platformStyles({
    isMobile: {flex: 1},
  }),
  text: {
    color: Styles.globalColors.black,
    margin: Styles.globalMargins.small,
  },
})

export default ConfirmModal
