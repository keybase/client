// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/contacts.avdl

package keybase1

type ContactComponent struct {
	Label       string          `codec:"label" json:"label"`
	PhoneNumber *RawPhoneNumber `codec:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	Email       *EmailAddress   `codec:"email,omitempty" json:"email,omitempty"`
}

func (o ContactComponent) DeepCopy() ContactComponent {
	return ContactComponent{
		Label: o.Label,
		PhoneNumber: (func(x *RawPhoneNumber) *RawPhoneNumber {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PhoneNumber),
		Email: (func(x *EmailAddress) *EmailAddress {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Email),
	}
}

type Contact struct {
	Name       string             `codec:"name" json:"name"`
	Components []ContactComponent `codec:"components" json:"components"`
}

func (o Contact) DeepCopy() Contact {
	return Contact{
		Name: o.Name,
		Components: (func(x []ContactComponent) []ContactComponent {
			if x == nil {
				return nil
			}
			ret := make([]ContactComponent, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Components),
	}
}

type ProcessedContact struct {
	ContactIndex int               `codec:"contactIndex" json:"contactIndex"`
	ContactName  string            `codec:"contactName" json:"contactName"`
	Component    ContactComponent  `codec:"component" json:"component"`
	Resolved     bool              `codec:"resolved" json:"resolved"`
	Uid          UID               `codec:"uid" json:"uid"`
	Username     string            `codec:"username" json:"username"`
	FullName     string            `codec:"fullName" json:"fullName"`
	Following    bool              `codec:"following" json:"following"`
	ServiceMap   map[string]string `codec:"serviceMap" json:"serviceMap"`
	Assertion    string            `codec:"assertion" json:"assertion"`
	DisplayName  string            `codec:"displayName" json:"displayName"`
	DisplayLabel string            `codec:"displayLabel" json:"displayLabel"`
}

func (o ProcessedContact) DeepCopy() ProcessedContact {
	return ProcessedContact{
		ContactIndex: o.ContactIndex,
		ContactName:  o.ContactName,
		Component:    o.Component.DeepCopy(),
		Resolved:     o.Resolved,
		Uid:          o.Uid.DeepCopy(),
		Username:     o.Username,
		FullName:     o.FullName,
		Following:    o.Following,
		ServiceMap: (func(x map[string]string) map[string]string {
			if x == nil {
				return nil
			}
			ret := make(map[string]string, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.ServiceMap),
		Assertion:    o.Assertion,
		DisplayName:  o.DisplayName,
		DisplayLabel: o.DisplayLabel,
	}
}

type ContactListResolutionResult struct {
	NewlyResolved []ProcessedContact `codec:"newlyResolved" json:"newlyResolved"`
	Resolved      []ProcessedContact `codec:"resolved" json:"resolved"`
}

func (o ContactListResolutionResult) DeepCopy() ContactListResolutionResult {
	return ContactListResolutionResult{
		NewlyResolved: (func(x []ProcessedContact) []ProcessedContact {
			if x == nil {
				return nil
			}
			ret := make([]ProcessedContact, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.NewlyResolved),
		Resolved: (func(x []ProcessedContact) []ProcessedContact {
			if x == nil {
				return nil
			}
			ret := make([]ProcessedContact, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Resolved),
	}
}
