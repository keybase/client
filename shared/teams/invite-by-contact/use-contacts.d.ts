import {Contact} from '.'

type UseContactsResult = {
  contacts: Contact[] | null
  errorMessage: string | null
  loading: boolean
  region: string
}
declare const useContacts: () => UseContactsResult
export default useContacts
