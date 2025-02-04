import * as React from 'react'
import {Box, Button, Input, Icon} from '@/common-adapters'
import {globalColors, globalStyles, desktopStyles, platformStyles} from '@/styles'
import {defaultKBFSPath} from '@/constants/config'

export type Props = {
  isPublic: boolean
  onAdded: (path: string) => void
  username?: string
}

const UserButton = (props: {isPublic: boolean; onClick: () => void}) => {
  const {isPublic, onClick} = props
  return (
    <Box
      style={{
        ...stylesButtonContainer,
        backgroundColor: globalColors.white,
      }}
    >
      <Button
        small={true}
        onClick={onClick}
        labelStyle={{color: globalColors.white}}
        style={{
          backgroundColor: globalColors.blue,
        }}
        label={isPublic ? 'Open public folder' : 'New private folder'}
      />
    </Box>
  )
}

type UserInputProps = {
  isPublic: boolean
  onSubmit: () => void
  onCancel: () => void
  onUpdateText: (text: string) => void
  username?: string
  text: string
}

const UserInput = (props: UserInputProps) => {
  const {isPublic, onSubmit, onCancel, onUpdateText, username, text} = props
  return (
    <Box
      style={{
        ...stylesInputContainer,
        backgroundColor: globalColors.white,
      }}
    >
      <Input
        small={true}
        smallLabel={isPublic || !username ? '' : `${username},`}
        smallLabelStyle={{color: globalColors.blueDarker, marginRight: 0}}
        hideUnderline={true}
        autoFocus={true}
        hintText={isPublic ? 'user or user1,user2,user3' : 'user1,user2,user3,...'}
        style={{flex: 1}}
        onChangeText={onUpdateText}
        value={text}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            onSubmit()
          } else if (event.key === 'Escape') {
            onCancel()
          }
        }}
      />
      <Icon
        type="iconfont-folder-open"
        onClick={onSubmit}
        style={platformStyles({
          isElectron: desktopStyles.clickable,
        })}
        color={globalColors.blue}
      />
    </Box>
  )
}

const UserAdd = (props: Props) => {
  const {isPublic, onAdded, username} = props
  const [showingInput, setShowingInput] = React.useState(false)
  const [text, setText] = React.useState('')

  const submit = () => {
    if (text) {
      onAdded(
        isPublic
          ? `${defaultKBFSPath}/public/${text}`
          : `${defaultKBFSPath}/private/${username || ''},${text}`
      )
    }
    showInput(false)
  }

  const showInput = (showing: boolean) => {
    setShowingInput(showing)
    setText('')
  }

  return showingInput ? (
    <UserInput
      onSubmit={submit}
      text={text}
      onCancel={() => showInput(false)}
      onUpdateText={setText}
      isPublic={isPublic}
      username={username}
    />
  ) : (
    <UserButton onClick={() => showInput(true)} isPublic={isPublic} />
  )
}

const stylesButtonContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: 40,
  justifyContent: 'center',
  paddingLeft: 4,
  paddingRight: 4,
} as const

const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  height: 40,
  justifyContent: 'flex-start',
  overflow: 'hidden',
  paddingLeft: 6,
  paddingRight: 10,
} as const

export default UserAdd
