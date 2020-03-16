// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/sigs.avdl

package keybase1

type Sig struct {
	Seqno        Seqno  `codec:"seqno" json:"seqno"`
	SigID        SigID  `codec:"sigID" json:"sigID"`
	SigIDDisplay string `codec:"sigIDDisplay" json:"sigIDDisplay"`
	Type         string `codec:"type" json:"type"`
	CTime        Time   `codec:"cTime" json:"cTime"`
	Revoked      bool   `codec:"revoked" json:"revoked"`
	Active       bool   `codec:"active" json:"active"`
	Key          string `codec:"key" json:"key"`
	Body         string `codec:"body" json:"body"`
}

func (o Sig) DeepCopy() Sig {
	return Sig{
		Seqno:        o.Seqno.DeepCopy(),
		SigID:        o.SigID.DeepCopy(),
		SigIDDisplay: o.SigIDDisplay,
		Type:         o.Type,
		CTime:        o.CTime.DeepCopy(),
		Revoked:      o.Revoked,
		Active:       o.Active,
		Key:          o.Key,
		Body:         o.Body,
	}
}

type SigTypes struct {
	Track          bool `codec:"track" json:"track"`
	Proof          bool `codec:"proof" json:"proof"`
	Cryptocurrency bool `codec:"cryptocurrency" json:"cryptocurrency"`
	IsSelf         bool `codec:"isSelf" json:"isSelf"`
}

func (o SigTypes) DeepCopy() SigTypes {
	return SigTypes{
		Track:          o.Track,
		Proof:          o.Proof,
		Cryptocurrency: o.Cryptocurrency,
		IsSelf:         o.IsSelf,
	}
}

type SigListArgs struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Username  string    `codec:"username" json:"username"`
	AllKeys   bool      `codec:"allKeys" json:"allKeys"`
	Types     *SigTypes `codec:"types,omitempty" json:"types,omitempty"`
	Filterx   string    `codec:"filterx" json:"filterx"`
	Verbose   bool      `codec:"verbose" json:"verbose"`
	Revoked   bool      `codec:"revoked" json:"revoked"`
}

func (o SigListArgs) DeepCopy() SigListArgs {
	return SigListArgs{
		SessionID: o.SessionID,
		Username:  o.Username,
		AllKeys:   o.AllKeys,
		Types: (func(x *SigTypes) *SigTypes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Types),
		Filterx: o.Filterx,
		Verbose: o.Verbose,
		Revoked: o.Revoked,
	}
}
