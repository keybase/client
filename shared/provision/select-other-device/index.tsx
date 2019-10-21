import * as React from 'react'
import * as Types from '../../constants/types/provision'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'

type Props = {
  devices: Array<Types.Device>
  onSelect: (name: string) => void
  onResetAccount: () => void
  onBack: () => void
}

class SelectOtherDevice extends React.Component<Props> {
  static navigationOptions = {
    header: null,
    headerBottomStyle: {height: undefined},
    headerLeft: null, // no back button
  }

  _renderItem = (index, item) => {
    if (item.__reset) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.or}>
            or
          </Kb.Text>
          <Kb.ListItem2
            type="Small"
            firstItem={true}
            key="reset"
            onClick={this.props.onResetAccount}
            icon={<Kb.Icon type="icon-skull-32" />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodySemibold">I lost all my devices/paper keys</Kb.Text>
                <Kb.Text type="BodySmall">Reset your account</Kb.Text>
              </Kb.Box2>
            }
          />
        </Kb.Box2>
      )
    }

    const {name, type} = item
    let iconType: Kb.IconType
    let description: string = ''
    switch (type) {
      case 'mobile':
        iconType = 'icon-phone-32'
        description = 'Phone'
        break
      case 'desktop':
        iconType = 'icon-computer-32'
        description = 'Computer'
        break
      case 'backup':
        iconType = 'icon-paper-key-32'
        description = 'Paper key'
        break
      default:
        iconType = 'icon-paper-key-32'
    }

    return (
      <Kb.ListItem2
        type="Small"
        firstItem={index === 0}
        key={name}
        onClick={() => this.props.onSelect(name)}
        icon={<Kb.Icon type={iconType} />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold">{name}</Kb.Text>
            <Kb.Text type="BodySmall">{description}</Kb.Text>
          </Kb.Box2>
        }
      />
    )
  }

  render() {
    const items = [...this.props.devices, {__reset: true}]
    return (
      <SignupScreen
        noBackground={true}
        onBack={this.props.onBack}
        title={`Authorize this ${Styles.isMobile ? 'phone' : 'computer'}`}
        contentContainerStyle={Styles.padding(0)}
      >
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          fullWidth={true}
          style={styles.contentBox}
          gap="medium"
        >
          <Kb.List
            style={styles.list}
            items={items}
            renderItem={this._renderItem}
            keyProperty="name"
            ListHeaderComponent={
              <Kb.Box2 direction="vertical" style={styles.headerText}>
                <Kb.Text center={true} type="Body">
                  For security reasons, you need to authorize this {Styles.isMobile ? 'phone' : 'computer'}{' '}
                  with another device or a paper key.
                </Kb.Text>
                <Kb.Text center={true} type="Body">
                  Which do you have handy?
                </Kb.Text>
              </Kb.Box2>
            }
          />
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  contentBox: Styles.platformStyles({
    common: {alignSelf: 'center', flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  headerText: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  list: {
    flexGrow: 1,
  },
  or: {
    backgroundColor: Styles.globalColors.blueGrey,
    color: Styles.globalColors.black_50,
    ...Styles.padding(Styles.globalMargins.xsmall),
  },
}))

export default SelectOtherDevice
