import * as React from 'react'
import _Password from '../../settings/password'

const Password = () => {
  const onSave = React.useCallback((pw: string, confirm: string) => console.log(pw, confirm), [])
  return <_Password hasRandomPW={false} onSave={onSave} />
}
Password.navigationOptions = {
  gesturesEnabled: false,
  header: null,
}

export default Password
