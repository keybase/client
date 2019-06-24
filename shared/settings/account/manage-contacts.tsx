import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  contactsImported: boolean
  onToggleImport: () => void
}

const ManageContacts = (props: Props) => {
  const contactsImported = Container.useSelector(s => s.settings.contactImportEnabled)
  const dispatch = Container.useDispatch()
  if (contactsImported === null) {
    dispatch(SettingsGen.createGetContactImportEnabled())
  }
}
