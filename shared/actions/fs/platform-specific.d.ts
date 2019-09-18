import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/fs'

declare function platformSpecificSaga(): void

export declare function ensureDownloadPermissionPromise(): Promise<void>

export default platformSpecificSaga
