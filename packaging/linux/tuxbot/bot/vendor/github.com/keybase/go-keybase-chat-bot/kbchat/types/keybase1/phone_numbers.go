// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/phone_numbers.avdl

package keybase1

// Phone number support for TOFU chats.
type UserPhoneNumber struct {
	PhoneNumber PhoneNumber        `codec:"phoneNumber" json:"phone_number"`
	Verified    bool               `codec:"verified" json:"verified"`
	Superseded  bool               `codec:"superseded" json:"superseded"`
	Visibility  IdentityVisibility `codec:"visibility" json:"visibility"`
	Ctime       UnixTime           `codec:"ctime" json:"ctime"`
}

func (o UserPhoneNumber) DeepCopy() UserPhoneNumber {
	return UserPhoneNumber{
		PhoneNumber: o.PhoneNumber.DeepCopy(),
		Verified:    o.Verified,
		Superseded:  o.Superseded,
		Visibility:  o.Visibility.DeepCopy(),
		Ctime:       o.Ctime.DeepCopy(),
	}
}

type PhoneNumberLookupResult struct {
	PhoneNumber        RawPhoneNumber `codec:"phoneNumber" json:"phone_number"`
	CoercedPhoneNumber PhoneNumber    `codec:"coercedPhoneNumber" json:"coerced_phone_number"`
	Err                *string        `codec:"err,omitempty" json:"err,omitempty"`
	Uid                *UID           `codec:"uid,omitempty" json:"uid,omitempty"`
}

func (o PhoneNumberLookupResult) DeepCopy() PhoneNumberLookupResult {
	return PhoneNumberLookupResult{
		PhoneNumber:        o.PhoneNumber.DeepCopy(),
		CoercedPhoneNumber: o.CoercedPhoneNumber.DeepCopy(),
		Err: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Err),
		Uid: (func(x *UID) *UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Uid),
	}
}

type PhoneNumberChangedMsg struct {
	PhoneNumber PhoneNumber `codec:"phoneNumber" json:"phone"`
}

func (o PhoneNumberChangedMsg) DeepCopy() PhoneNumberChangedMsg {
	return PhoneNumberChangedMsg{
		PhoneNumber: o.PhoneNumber.DeepCopy(),
	}
}
