import * as RR from 'react-redux'
import {TypedState} from '../constants/reducer'

const connect_ = RR.connect
const connect: RR.Connect<TypedState> = connect_ as any
export default connect
