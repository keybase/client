import * as T from '@/constants/types'
import {makeUUID} from '@/util/uuid'

export {makeUUID} from '@/util/uuid'

export const clientID = makeUUID()

export const makeEditID = (): T.FS.EditID => T.FS.stringToEditID(makeUUID())
