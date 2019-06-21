import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as Types from '../../../../../constants/types/wallets'
import * as Constants from '../../../../../constants/wallets'
import {WalletPopup} from '../../../../common'
import openUrl from '../../../../../util/open-url'

export type Props = {
  error: string
  inflationDestination: Types.AccountInflationDestination
  options: Array<{
    name: string
    recommended: boolean
    address: Types.AccountID
    link: string
  }>
  onSubmit: (dest: string, name: string) => void
  onClose: () => void
}

type State = {
  address: string
  name: string
  otherAddress: string
}

class InflationDestinationPopup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    let address = props.inflationDestination.accountID
    let name = props.inflationDestination.name

    // initialize input
    let otherAddress = ''
    const fromOptions = props.options.find(o => o.address === address)
    if (!fromOptions && Types.isValidAccountID(address)) {
      otherAddress = address
    }

    // choose first recommended
    if (!Types.isValidAccountID(address)) {
      const reco = props.options.find(o => o.recommended)
      address = reco && reco.address ? reco.address : ''
      name = reco && reco.name ? reco.name : ''
    }

    this.state = {address, name, otherAddress}
  }

  _submit = () => {
    this.props.onSubmit(this.state.address, this.state.name)
  }

  componentDidUpdate(prevProps: Props) {
    // got updated
    if (this.props.inflationDestination !== prevProps.inflationDestination) {
      this.props.onClose()
    }
  }

  render() {
    const props = this.props
    const buttons = [
      !Styles.isMobile && (
        <Kb.WaitingButton
          fullWidth={Styles.isMobile}
          key="Cancel"
          label="Cancel"
          onClick={props.onClose}
          type="Dim"
          waitingKey={Constants.inflationDestinationWaitingKey}
          onlyDisable={true}
        />
      ),
      <Kb.WaitingButton
        fullWidth={Styles.isMobile}
        waitingKey={Constants.inflationDestinationWaitingKey}
        key="Save"
        label="Save"
        onClick={this._submit}
        disabled={!this.state.address.length}
        type="Wallet"
      />,
    ].filter(Boolean)

    // Only show the lumenaut thing if its an option
    let lumenautLink
    this.props.options.forEach(o => {
      if (o.name === 'Lumenaut' && o.link.length) {
        lumenautLink = () => openUrl(o.link)
      }
    })

    return (
      <WalletPopup
        onExit={props.onClose}
        backButtonType="cancel"
        headerStyle={styles.header}
        containerStyle={styles.container}
        bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
      >
        <Kb.Box2
          centerChildren={true}
          direction="vertical"
          fullWidth={true}
          fullHeight={!Styles.isMobile}
          gap="small"
        >
          <Kb.Icon
            type={
              Styles.isMobile
                ? 'icon-stellar-coins-stacked-inflation-64'
                : 'icon-stellar-coins-stacked-inflation-48'
            }
          />
          <Kb.Text type="Header"> Inflation destination</Kb.Text>
          <Kb.Text center={true} type="Body">
            Every year, the total Lumens grows by 1% due to inflation, and you can cast a vote for who gets
            it.
          </Kb.Text>
          {!!lumenautLink && (
            <Kb.Text center={true} type="Body">
              One service,{' '}
              <Kb.Text type="BodyPrimaryLink" onClick={lumenautLink}>
                Lumenaut
              </Kb.Text>
              , takes your votes then gives the inflation they collect on your behalf back to you. So it's a
              common choice.
            </Kb.Text>
          )}
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioContainer}>
            {this.props.options.map(o => (
              <Kb.Box2 key={o.name} direction="horizontal" fullWidth={true} gap="xtiny" style={styles.row}>
                <Kb.RadioButton
                  onSelect={() => this.setState({address: Types.accountIDToString(o.address), name: o.name})}
                  selected={this.state.address === o.address}
                  label={o.name}
                />
                {o.recommended && <Kb.Text type="BodySemibold">(Recommended)</Kb.Text>}
                {!!o.link && (
                  <Kb.Icon
                    color={Styles.globalColors.blue}
                    type="iconfont-open-browser"
                    onClick={() => openUrl(o.link)}
                    fontSize={Styles.isMobile ? 16 : 12}
                  />
                )}
              </Kb.Box2>
            ))}
            <Kb.Box2
              key="other"
              direction="vertical"
              fullWidth={true}
              gap="xtiny"
              style={styles.otherContainer}
            >
              <Kb.RadioButton
                onSelect={() => this.setState({address: this.state.otherAddress, name: ''})}
                selected={this.state.address === this.state.otherAddress}
                label="Other"
              />
              <Kb.Box2 direction="vertical" gap="xtiny" style={styles.otherInput}>
                <Kb.Text type="BodyTinySemibold" style={styles.specify}>
                  Specify:
                </Kb.Text>
                <Kb.PlainInput
                  placeholder="Enter a Stellar address..."
                  multiline={true}
                  value={this.state.otherAddress}
                  onChangeText={otherAddress =>
                    this.setState({address: otherAddress, name: '', otherAddress})
                  }
                />
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
          {!!props.error && <Kb.Text type="BodySmallError">{props.error}</Kb.Text>}
        </Kb.Box2>
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {flexGrow: 1},
    isElectron: {
      borderRadius: 'inherit',
      paddingBottom: Styles.globalMargins.medium,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
      textAlign: 'center',
    },
    isMobile: {
      padding: Styles.globalMargins.small,
    },
  }),
  header: {borderBottomWidth: 0},
  otherContainer: {alignItems: 'flex-start'},
  otherInput: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
    minHeight: 88,
    padding: Styles.globalMargins.tiny,
  },
  radioContainer: Styles.platformStyles({
    isElectron: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  row: {
    alignItems: 'center',
    flexShrink: 0,
  },
  specify: {
    color: Styles.globalColors.blueDark,
  },
})

export default InflationDestinationPopup
