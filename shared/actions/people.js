// @flow
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'

const _getPeopleData = function(action: PeopleGen.GetPeopleDataPayload) {}

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatestPure(PeopleGen.getPeopleData, _getPeopleData)
}

export default peopleSaga
