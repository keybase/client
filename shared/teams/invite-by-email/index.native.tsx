import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {FloatingRolePicker} from '../role-picker'
import * as Styles from '../../styles'
import {MobileProps, ContactRowProps} from './index'
import {pluralize} from '../../util/string'

const AccessDenied = ({openAppSettings}) => (
  <Kb.Box
    style={{
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: Styles.globalMargins.small,
    }}
  >
    <Kb.Icon
      type="iconfont-close"
      style={{
        marginBottom: Styles.globalMargins.large,
      }}
      color={Styles.globalColors.red}
      fontSize={Styles.globalMargins.xlarge}
    />
    <Kb.Box>
      <Kb.Text center={true} type="Body" style={{marginBottom: Styles.globalMargins.small}}>
        We don't have permission to access your contacts!
      </Kb.Text>
      <Kb.Text center={true} type="Body" style={{marginBottom: Styles.globalMargins.small}}>
        To fix this, please open Settings > Keybase and check off 'Allow Keybase to access Contacts'.
      </Kb.Text>
      <Kb.ButtonBar>
        <Kb.Button label="Open settings" onClick={openAppSettings} />
      </Kb.ButtonBar>
    </Kb.Box>
  </Kb.Box>
)

const contactRow = (_: number, props: ContactRowProps) => {
  const source =
    typeof props.contact.thumbnailPath === 'string'
      ? {uri: `file://${props.contact.thumbnailPath}`}
      : props.contact.thumbnailPath
  const hasThumbnail = props.contact.thumbnailPath && props.contact.thumbnailPath.length > 0
  return (
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 56,
        padding: Styles.globalMargins.small,
        width: '100%',
      }}
    >
      <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
          {!!hasThumbnail && !!source && (
            <Kb.NativeImage
              style={{borderRadius: 24, height: 48, marginRight: 16, width: 48}}
              source={source}
            />
          )}
          {!hasThumbnail && <Kb.Avatar size={48} style={{marginRight: 16}} />}
          <Kb.Box>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>
              <Kb.Text type="BodySemibold">{props.contact.name}</Kb.Text>
            </Kb.Box>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>
              <Kb.Text type="BodySmall">{props.contact.email || props.contact.phoneNo}</Kb.Text>
            </Kb.Box>
          </Kb.Box>
        </Kb.Box>
        <Kb.Box>
          <Kb.Button
            type="Success"
            mode={props.selected ? 'Secondary' : 'Primary'}
            label={props.selected ? 'Invited!' : 'Invite'}
            waiting={props.loading}
            small={true}
            onClick={props.onClick}
            style={{
              paddingLeft: Styles.globalMargins.small,
              paddingRight: Styles.globalMargins.small,
              width: 100,
            }}
          />
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

type State = {
  filter: string
  isRolePickerOpen: boolean
}

// Container handles all the props, this just handles filtering
class InviteByEmailMobile extends React.Component<MobileProps, State> {
  state = {
    filter: '',
    isRolePickerOpen: false,
  }

  _trim(s: string | null): string {
    return (s && s.replace(/^[^a-z0-9@.]/i, '').toLowerCase()) || ''
  }

  componentWillUnmount() {
    this.props.onClearError()
  }

  onCancelRolePicker = () => {
    this.setState({isRolePickerOpen: false})
  }

  onConfirmRolePicker = () => {
    this.setState({isRolePickerOpen: false})
  }

  onOpenRolePicker = () => {
    this.setState({isRolePickerOpen: true})
  }

  render() {
    // Filter before adding props to avoid a long map fcn
    const filteredContactRows = this.props.contactRowProps.filter(contact => {
      let {filter} = this.state
      filter = this._trim(filter)
      if (filter.length === 0) {
        return true
      }
      return (
        this._trim(contact.contact.name || '').includes(filter) ||
        this._trim(contact.contact.email || '').includes(filter) ||
        this._trim(contact.contact.phoneNo || '').includes(filter)
      )
    })
    let contents
    if (this.props.hasPermission) {
      contents = (
        <Kb.Box
          style={{...Styles.globalStyles.flexBoxColumn, flex: 1, paddingBottom: Styles.globalMargins.xtiny}}
        >
          {!!this.props.errorMessage && (
            <Kb.Box2
              direction="horizontal"
              style={{
                alignItems: 'center',
                backgroundColor: Styles.globalColors.red,
                justifyContent: 'center',
                padding: Styles.globalMargins.tiny,
              }}
              fullWidth={true}
            >
              <Kb.Text center={true} type="BodySemibold" negative={true}>
                {this.props.errorMessage}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Box
            style={{
              ...Styles.globalStyles.flexBoxRow,
              borderBottomColor: Styles.globalColors.black_10,
              borderBottomWidth: Styles.hairlineWidth,
            }}
          >
            <Kb.Input
              keyboardType="email-address"
              value={this.state.filter}
              onChangeText={filter => this.setState({filter})}
              hintText="Search"
              hideUnderline={true}
              small={true}
              style={{width: '100%'}}
              errorStyle={{minHeight: 14}}
              inputStyle={{
                fontSize: 16,
                margin: Styles.globalMargins.small,
                textAlign: 'left',
              }}
            />
          </Kb.Box>
          <FloatingRolePicker
            confirmLabel={`Invite as ${pluralize(this.props.role)}`}
            selectedRole={this.props.role}
            onSelectRole={this.props.onRoleChange}
            onConfirm={this.onConfirmRolePicker}
            onCancel={this.onCancelRolePicker}
            position={'bottom center'}
            open={this.state.isRolePickerOpen}
            disabledRoles={{owner: 'Cannot invite an owner via email.'}}
          />
          <Kb.List
            keyProperty="id"
            items={filteredContactRows}
            fixedHeight={56}
            ListHeaderComponent={
              <Kb.ClickableBox
                onClick={() => this.onOpenRolePicker()}
                style={{
                  ...Styles.globalStyles.flexBoxColumn,
                  alignItems: 'center',
                  borderBottomColor: Styles.globalColors.black_10,
                  borderBottomWidth: Styles.hairlineWidth,
                  justifyContent: 'center',
                  marginBottom: Styles.globalMargins.xtiny,
                  padding: Styles.globalMargins.small,
                }}
              >
                <Kb.Text center={true} type="BodySmall">
                  Users will be invited to {this.props.name} as
                  <Kb.Text type="BodySmallPrimaryLink">{' ' + this.props.role + 's'}</Kb.Text>.
                </Kb.Text>
              </Kb.ClickableBox>
            }
            renderItem={contactRow}
            style={{alignSelf: 'stretch'}}
          />
        </Kb.Box>
      )
    } else {
      contents = (
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
          <AccessDenied openAppSettings={this.props.openAppSettings} />
        </Kb.Box>
      )
    }
    return contents
  }
}

export {InviteByEmailMobile}
