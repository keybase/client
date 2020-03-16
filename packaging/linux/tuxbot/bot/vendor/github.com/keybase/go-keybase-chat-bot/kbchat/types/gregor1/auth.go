// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/gregor1/auth.avdl

package gregor1

type AuthResult struct {
	Uid      UID       `codec:"uid" json:"uid"`
	Username string    `codec:"username" json:"username"`
	Sid      SessionID `codec:"sid" json:"sid"`
	IsAdmin  bool      `codec:"isAdmin" json:"isAdmin"`
}

func (o AuthResult) DeepCopy() AuthResult {
	return AuthResult{
		Uid:      o.Uid.DeepCopy(),
		Username: o.Username,
		Sid:      o.Sid.DeepCopy(),
		IsAdmin:  o.IsAdmin,
	}
}
