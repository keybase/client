import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/fs'

declare function platformSpecificSaga(): Saga.SagaGenerator<any, any>

export default platformSpecificSaga
