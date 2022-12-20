import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import {ParticipantsRow} from '../../common'

export type SearchProps = {
  heading: 'To' | 'From'
  onClickResult: (username: string) => void
  onShowTracker: (username: string) => void
  onScanQRCode: (() => void) | null
  onSearch: () => void
}

const placeholder = 'Search Keybase'

// TODO: Once UserInput is cleaned up, we may be able to stretch it
// properly horizontally without wrapping a vertical Box2 around it.
const Search = (props: SearchProps) => (
  <ParticipantsRow heading={props.heading} style={styles.row} headingStyle={styles.rowHeading}>
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.PlainInput
        placeholder={placeholder}
        style={styles.input}
        onFocus={props.onSearch}
        allowFontScaling={false}
      />
      {props.onScanQRCode && (
        <Kb.Icon
          color={Styles.globalColors.black_50}
          type="iconfont-qr-code"
          onClick={props.onScanQRCode}
          style={styles.qrCode}
        />
      )}
    </Kb.Box2>
  </ParticipantsRow>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      input: {
        alignSelf: 'center',
        borderBottomWidth: 0,
        borderWidth: 0,
        flexGrow: 1,
        marginLeft: Styles.globalMargins.xtiny,
        paddingLeft: 0,
      },
      qrCode: {
        alignSelf: 'center',
        marginRight: Styles.globalMargins.tiny,
      },
      row: {
        minHeight: 48,
        paddingBottom: 0,
        paddingTop: 0,
      },
      rowHeading: {
        marginRight: 0, // Removing the right margin on the heading is to offset some left margin in UserInput
      },
    } as const)
)

const SendFormParticipantsSearch = Search
export default SendFormParticipantsSearch
