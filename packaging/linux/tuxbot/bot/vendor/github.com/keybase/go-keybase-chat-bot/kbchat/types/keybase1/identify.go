// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/identify.avdl

package keybase1

type IdentifyProofBreak struct {
	RemoteProof RemoteProof     `codec:"remoteProof" json:"remoteProof"`
	Lcr         LinkCheckResult `codec:"lcr" json:"lcr"`
}

func (o IdentifyProofBreak) DeepCopy() IdentifyProofBreak {
	return IdentifyProofBreak{
		RemoteProof: o.RemoteProof.DeepCopy(),
		Lcr:         o.Lcr.DeepCopy(),
	}
}

type IdentifyTrackBreaks struct {
	Keys   []IdentifyKey        `codec:"keys" json:"keys"`
	Proofs []IdentifyProofBreak `codec:"proofs" json:"proofs"`
}

func (o IdentifyTrackBreaks) DeepCopy() IdentifyTrackBreaks {
	return IdentifyTrackBreaks{
		Keys: (func(x []IdentifyKey) []IdentifyKey {
			if x == nil {
				return nil
			}
			ret := make([]IdentifyKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Keys),
		Proofs: (func(x []IdentifyProofBreak) []IdentifyProofBreak {
			if x == nil {
				return nil
			}
			ret := make([]IdentifyProofBreak, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Proofs),
	}
}

type Identify2Res struct {
	Upk          UserPlusKeys         `codec:"upk" json:"upk"`
	IdentifiedAt Time                 `codec:"identifiedAt" json:"identifiedAt"`
	TrackBreaks  *IdentifyTrackBreaks `codec:"trackBreaks,omitempty" json:"trackBreaks,omitempty"`
}

func (o Identify2Res) DeepCopy() Identify2Res {
	return Identify2Res{
		Upk:          o.Upk.DeepCopy(),
		IdentifiedAt: o.IdentifiedAt.DeepCopy(),
		TrackBreaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackBreaks),
	}
}

type Identify2ResUPK2 struct {
	Upk          UserPlusKeysV2AllIncarnations `codec:"upk" json:"upk"`
	IdentifiedAt Time                          `codec:"identifiedAt" json:"identifiedAt"`
	TrackBreaks  *IdentifyTrackBreaks          `codec:"trackBreaks,omitempty" json:"trackBreaks,omitempty"`
}

func (o Identify2ResUPK2) DeepCopy() Identify2ResUPK2 {
	return Identify2ResUPK2{
		Upk:          o.Upk.DeepCopy(),
		IdentifiedAt: o.IdentifiedAt.DeepCopy(),
		TrackBreaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackBreaks),
	}
}

type IdentifyLiteRes struct {
	Ul          UserOrTeamLite       `codec:"ul" json:"ul"`
	TrackBreaks *IdentifyTrackBreaks `codec:"trackBreaks,omitempty" json:"trackBreaks,omitempty"`
}

func (o IdentifyLiteRes) DeepCopy() IdentifyLiteRes {
	return IdentifyLiteRes{
		Ul: o.Ul.DeepCopy(),
		TrackBreaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackBreaks),
	}
}

type ResolveIdentifyImplicitTeamRes struct {
	DisplayName string                              `codec:"displayName" json:"displayName"`
	TeamID      TeamID                              `codec:"teamID" json:"teamID"`
	Writers     []UserVersion                       `codec:"writers" json:"writers"`
	TrackBreaks map[UserVersion]IdentifyTrackBreaks `codec:"trackBreaks" json:"trackBreaks"`
	FolderID    TLFID                               `codec:"folderID" json:"folderID"`
}

func (o ResolveIdentifyImplicitTeamRes) DeepCopy() ResolveIdentifyImplicitTeamRes {
	return ResolveIdentifyImplicitTeamRes{
		DisplayName: o.DisplayName,
		TeamID:      o.TeamID.DeepCopy(),
		Writers: (func(x []UserVersion) []UserVersion {
			if x == nil {
				return nil
			}
			ret := make([]UserVersion, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Writers),
		TrackBreaks: (func(x map[UserVersion]IdentifyTrackBreaks) map[UserVersion]IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			ret := make(map[UserVersion]IdentifyTrackBreaks, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.TrackBreaks),
		FolderID: o.FolderID.DeepCopy(),
	}
}
