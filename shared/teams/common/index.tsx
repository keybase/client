import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import * as TeamTypes from '../../constants/types/teams'
export {default as ParticipantMeta} from './meta'
export {default as Activity, ModalTitle} from './activity'

export const usePhoneNumberList = () => {
  const [phoneNumbers, setPhoneNumbers] = React.useState([{key: 0, phoneNumber: '', valid: false}])
  const setPhoneNumber = (i: number, phoneNumber: string, valid: boolean) => {
    const pn = phoneNumbers[i]
    if (pn) {
      pn.phoneNumber = phoneNumber
      pn.valid = valid
      setPhoneNumbers([...phoneNumbers])
    }
  }
  const addPhoneNumber = () => {
    phoneNumbers.push({key: phoneNumbers[phoneNumbers.length - 1].key + 1, phoneNumber: '', valid: false})
    setPhoneNumbers([...phoneNumbers])
  }
  const removePhoneNumber = (i: number) => {
    phoneNumbers.splice(i, 1)
    setPhoneNumbers([...phoneNumbers])
  }

  return {addPhoneNumber, phoneNumbers, removePhoneNumber, setPhoneNumber}
}

const emptyMap = new Map()
const isBot = (type: TeamTypes.TeamRoleType) => type === 'bot' || type === 'restrictedbot'
export const useTeamHumans = (teamID: TeamTypes.TeamID) => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(TeamsGen.createGetMembers({teamID}))
  }, [dispatch, teamID])
  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID)) || emptyMap
  const bots = new Set<string>()
  teamMembers.forEach(({type}, username) => isBot(type) && bots.add(username))
  const teamHumanCount = teamMembers.size - bots.size
  console.log({songgao: 'useTeamHumans', bots, teamMembers, teamID})
  return {bots, teamHumanCount}
}
