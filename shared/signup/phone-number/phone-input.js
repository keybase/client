// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {countryData, AsYouTypeFormatter} from '../../util/phone-numbers/'

const getCallingCode = countryCode => countryData[countryCode].callingCode
const getPlaceholder = countryCode => 'Ex: ' + countryData[countryCode].example

type Props = {
  defaultCountry?: string, // TODO get this from core. ISO 3166-1 alpha-2 format (e.g. 'US')
  error: string,
  onChangeNumber: (number: string) => void, // E.164 format (e.g. '+18002667883').
  style?: Styles.StylesCrossPlatform,
}

type State = {
  country: string,
}

class _PhoneInput extends React.Component<Kb.PropsWithOverlay<Props>, State> {
  state = {country: this.props.defaultCountry || 'FR'}

  render() {
    return (
      <Kb.Box2 direction="horizontal" style={Styles.collapseStyles([styles.container, this.props.style])}>
        <Kb.ClickableBox onClick={this.props.toggleShowingMenu}>
          <Kb.Box2
            direction="horizontal"
            style={styles.callingCodeContainer}
            alignItems="center"
            fullHeight={true}
          >
            <Kb.Text type="BodySemibold">{getCallingCode(this.state.country)}</Kb.Text>
            <Kb.Icon type="iconfont-caret-down" sizeType="Small" />
          </Kb.Box2>
        </Kb.ClickableBox>
        <Kb.PlainInput style={styles.input} placeholder={getPlaceholder(this.state.country)} />
      </Kb.Box2>
    )
  }
}
const PhoneInput = Kb.OverlayParentHOC(_PhoneInput)

const styles = Styles.styleSheetCreate({
  callingCodeContainer: {
    ...Styles.padding(0, Styles.globalMargins.xsmall),
    borderRightColor: Styles.globalColors.black_10,
    borderRightWidth: 1,
    borderStyle: 'solid',
    justifyContent: 'space-between',
    minWidth: Styles.isMobile ? 83 : 78,
  },
  container: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  input: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
    },
  }),
})

export default PhoneInput
