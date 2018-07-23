// @flow
import * as React from 'react'
import * as Types from '../../constants/types/provision'
import {ClickableBox, BackButton, Box2, List, Text, Icon} from '../../common-adapters'
import {
  globalColors,
  globalMargins,
  styleSheetCreate,
  platformStyles,
  glamorous,
  isMobile,
} from '../../styles'

type Props = {|
  devices: Array<Types.Device>,
  onSelect: (name: string) => void,
  onResetAccount: () => void,
  onBack: () => void,
  waiting: boolean,
|}

const HoverBox = isMobile
  ? Box2
  : glamorous(Box2)({
      ':hover': {
        backgroundColor: globalColors.blue4,
      },
    })

class SelectOtherDevice extends React.Component<Props> {
  _renderItem = (index, {name, type}) => {
    let iconType
    switch (type) {
      case 'mobile':
        iconType = 'icon-phone-48'
        break
      case 'desktop':
        iconType = 'icon-computer-48'
        break
      case 'backup':
        iconType = 'icon-paper-key-48'
        break
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(type);
      */
        iconType = 'icon-paper-key-32'
    }

    const isBackup = type === 'backup'

    // TODO fix-up common/list-item and use that eventually

    return (
      <ClickableBox onClick={() => this.props.onSelect(name)} key={name} style={styles.clickableBox}>
        <HoverBox direction="vertical" fullHeight={true} fullWidth={true}>
          {index > 0 && <Box2 direction="vertical" fullWidth={true} style={styles.divider} />}
          <Box2
            direction="horizontal"
            style={styles.row}
            gap="medium"
            fullWidth={true}
            gapStart={true}
            gapEnd={true}
          >
            <Icon type={iconType} />
            <Box2 direction="vertical" fullWidth={true}>
              <Text type="BodySemiboldItalic">
                {name}
                {isBackup ? '...' : ''}
              </Text>
              {isBackup && <Text type="BodySmall">Paper key</Text>}
            </Box2>
          </Box2>
        </HoverBox>
      </ClickableBox>
    )
  }

  render() {
    return (
      <Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        gap={isMobile ? undefined : 'medium'}
        gapEnd={true}
      >
        <BackButton onClick={this.props.onBack} style={styles.backButton} />
        <Box2 direction="vertical" fullWidth={true} style={styles.contentBox} gap={'medium'}>
          <Text type={isMobile ? 'BodyBig' : 'Header'} style={styles.header}>
            For security reasons, you need to authorize with an existing device. Which of your existing
            devices would you like to use?
          </Text>
          <List
            style={styles.list}
            items={this.props.devices}
            renderItem={this._renderItem}
            keyProperty="name"
            fixedHeight={rowHeight}
          />
          <Box2 direction="horizontal" fullWidth={true} gap="tiny">
            <Icon type="iconfont-keybase" />
            <Text type="BodySmall">Troubleshooting</Text>
          </Box2>
          <Text type="Body">
            If you have lost all of your devices, or if you uninstalled Keybase from all of them, you can{' '}
            <Text type="BodyPrimaryLink" onClick={this.props.onResetAccount}>
              reset your account.
            </Text>
          </Text>
        </Box2>
      </Box2>
    )
  }
}

const rowHeight = 56

const styles = styleSheetCreate({
  backButton: platformStyles({
    isElectron: {
      marginLeft: globalMargins.medium,
      marginTop: globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  clickableBox: {
    height: rowHeight,
  },
  contentBox: platformStyles({
    common: {alignSelf: 'center', flexGrow: 1, padding: globalMargins.small},
    isElectron: {
      maxWidth: 460,
    },
  }),
  divider: {
    backgroundColor: globalColors.black_05,
    flexShrink: 0,
    height: 1,
    marginLeft: 95,
  },
  header: {textAlign: 'center'},
  list: {
    flexGrow: 1,
  },
  row: {
    alignItems: 'center',
    flexShrink: 0,
    height: rowHeight,
    width: '100%',
  },
})

export default SelectOtherDevice
