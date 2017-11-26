// @flow
import PurgeMessage from './purge-message.desktop'
import {connect} from 'react-redux'
import * as PgpGen from '../actions/pgp-gen'

const mapStateToProps = (state: any) => ({})
const mapDispatchToProps = (dispatch: any) => ({
  onClose: () => {
    dispatch(PgpGen.createPgpAckedMessage({hitOk: false}))
  },
  onOk: () => {
    dispatch(PgpGen.createPgpAckedMessage({hitOk: true}))
  },
})
export default connect(mapStateToProps, mapDispatchToProps)(PurgeMessage)
