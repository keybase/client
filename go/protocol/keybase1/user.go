// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/user.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type TrackProof struct {
	ProofType string `codec:"proofType" json:"proofType"`
	ProofName string `codec:"proofName" json:"proofName"`
	IdString  string `codec:"idString" json:"idString"`
}

func (o TrackProof) DeepCopy() TrackProof {
	return TrackProof{
		ProofType: o.ProofType,
		ProofName: o.ProofName,
		IdString:  o.IdString,
	}
}

type WebProof struct {
	Hostname  string   `codec:"hostname" json:"hostname"`
	Protocols []string `codec:"protocols" json:"protocols"`
}

func (o WebProof) DeepCopy() WebProof {
	return WebProof{
		Hostname: o.Hostname,
		Protocols: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Protocols),
	}
}

type Proofs struct {
	Social     []TrackProof `codec:"social" json:"social"`
	Web        []WebProof   `codec:"web" json:"web"`
	PublicKeys []PublicKey  `codec:"publicKeys" json:"publicKeys"`
}

func (o Proofs) DeepCopy() Proofs {
	return Proofs{
		Social: (func(x []TrackProof) []TrackProof {
			if x == nil {
				return nil
			}
			ret := make([]TrackProof, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Social),
		Web: (func(x []WebProof) []WebProof {
			if x == nil {
				return nil
			}
			ret := make([]WebProof, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Web),
		PublicKeys: (func(x []PublicKey) []PublicKey {
			if x == nil {
				return nil
			}
			ret := make([]PublicKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PublicKeys),
	}
}

type UserSummary struct {
	Uid          UID    `codec:"uid" json:"uid"`
	Username     string `codec:"username" json:"username"`
	Thumbnail    string `codec:"thumbnail" json:"thumbnail"`
	IdVersion    int    `codec:"idVersion" json:"idVersion"`
	FullName     string `codec:"fullName" json:"fullName"`
	Bio          string `codec:"bio" json:"bio"`
	Proofs       Proofs `codec:"proofs" json:"proofs"`
	SigIDDisplay string `codec:"sigIDDisplay" json:"sigIDDisplay"`
	TrackTime    Time   `codec:"trackTime" json:"trackTime"`
}

func (o UserSummary) DeepCopy() UserSummary {
	return UserSummary{
		Uid:          o.Uid.DeepCopy(),
		Username:     o.Username,
		Thumbnail:    o.Thumbnail,
		IdVersion:    o.IdVersion,
		FullName:     o.FullName,
		Bio:          o.Bio,
		Proofs:       o.Proofs.DeepCopy(),
		SigIDDisplay: o.SigIDDisplay,
		TrackTime:    o.TrackTime.DeepCopy(),
	}
}

type EmailAddress string

func (o EmailAddress) DeepCopy() EmailAddress {
	return o
}

type Email struct {
	Email               EmailAddress       `codec:"email" json:"email"`
	IsVerified          bool               `codec:"isVerified" json:"isVerified"`
	IsPrimary           bool               `codec:"isPrimary" json:"isPrimary"`
	Visibility          IdentityVisibility `codec:"visibility" json:"visibility"`
	LastVerifyEmailDate UnixTime           `codec:"lastVerifyEmailDate" json:"lastVerifyEmailDate"`
}

func (o Email) DeepCopy() Email {
	return Email{
		Email:               o.Email.DeepCopy(),
		IsVerified:          o.IsVerified,
		IsPrimary:           o.IsPrimary,
		Visibility:          o.Visibility.DeepCopy(),
		LastVerifyEmailDate: o.LastVerifyEmailDate.DeepCopy(),
	}
}

type UserSettings struct {
	Emails       []Email           `codec:"emails" json:"emails"`
	PhoneNumbers []UserPhoneNumber `codec:"phoneNumbers" json:"phoneNumbers"`
}

func (o UserSettings) DeepCopy() UserSettings {
	return UserSettings{
		Emails: (func(x []Email) []Email {
			if x == nil {
				return nil
			}
			ret := make([]Email, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Emails),
		PhoneNumbers: (func(x []UserPhoneNumber) []UserPhoneNumber {
			if x == nil {
				return nil
			}
			ret := make([]UserPhoneNumber, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PhoneNumbers),
	}
}

type UserSummary2 struct {
	Uid        UID    `codec:"uid" json:"uid"`
	Username   string `codec:"username" json:"username"`
	Thumbnail  string `codec:"thumbnail" json:"thumbnail"`
	FullName   string `codec:"fullName" json:"fullName"`
	IsFollower bool   `codec:"isFollower" json:"isFollower"`
	IsFollowee bool   `codec:"isFollowee" json:"isFollowee"`
}

func (o UserSummary2) DeepCopy() UserSummary2 {
	return UserSummary2{
		Uid:        o.Uid.DeepCopy(),
		Username:   o.Username,
		Thumbnail:  o.Thumbnail,
		FullName:   o.FullName,
		IsFollower: o.IsFollower,
		IsFollowee: o.IsFollowee,
	}
}

type UserSummary2Set struct {
	Users   []UserSummary2 `codec:"users" json:"users"`
	Time    Time           `codec:"time" json:"time"`
	Version int            `codec:"version" json:"version"`
}

func (o UserSummary2Set) DeepCopy() UserSummary2Set {
	return UserSummary2Set{
		Users: (func(x []UserSummary2) []UserSummary2 {
			if x == nil {
				return nil
			}
			ret := make([]UserSummary2, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Users),
		Time:    o.Time.DeepCopy(),
		Version: o.Version,
	}
}

type InterestingPerson struct {
	Uid        UID               `codec:"uid" json:"uid"`
	Username   string            `codec:"username" json:"username"`
	Fullname   string            `codec:"fullname" json:"fullname"`
	ServiceMap map[string]string `codec:"serviceMap" json:"serviceMap"`
}

func (o InterestingPerson) DeepCopy() InterestingPerson {
	return InterestingPerson{
		Uid:      o.Uid.DeepCopy(),
		Username: o.Username,
		Fullname: o.Fullname,
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
	}
}

type ProofSuggestionsRes struct {
	Suggestions []ProofSuggestion `codec:"suggestions" json:"suggestions"`
	ShowMore    bool              `codec:"showMore" json:"showMore"`
}

func (o ProofSuggestionsRes) DeepCopy() ProofSuggestionsRes {
	return ProofSuggestionsRes{
		Suggestions: (func(x []ProofSuggestion) []ProofSuggestion {
			if x == nil {
				return nil
			}
			ret := make([]ProofSuggestion, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Suggestions),
		ShowMore: o.ShowMore,
	}
}

type ProofSuggestion struct {
	Key              string             `codec:"key" json:"key"`
	BelowFold        bool               `codec:"belowFold" json:"belowFold"`
	ProfileText      string             `codec:"profileText" json:"profileText"`
	ProfileIcon      []SizedImage       `codec:"profileIcon" json:"profileIcon"`
	ProfileIconWhite []SizedImage       `codec:"profileIconWhite" json:"profileIconWhite"`
	PickerText       string             `codec:"pickerText" json:"pickerText"`
	PickerSubtext    string             `codec:"pickerSubtext" json:"pickerSubtext"`
	PickerIcon       []SizedImage       `codec:"pickerIcon" json:"pickerIcon"`
	Metas            []Identify3RowMeta `codec:"metas" json:"metas"`
}

func (o ProofSuggestion) DeepCopy() ProofSuggestion {
	return ProofSuggestion{
		Key:         o.Key,
		BelowFold:   o.BelowFold,
		ProfileText: o.ProfileText,
		ProfileIcon: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ProfileIcon),
		ProfileIconWhite: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ProfileIconWhite),
		PickerText:    o.PickerText,
		PickerSubtext: o.PickerSubtext,
		PickerIcon: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PickerIcon),
		Metas: (func(x []Identify3RowMeta) []Identify3RowMeta {
			if x == nil {
				return nil
			}
			ret := make([]Identify3RowMeta, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Metas),
	}
}

type NextMerkleRootRes struct {
	Res *MerkleRootV2 `codec:"res,omitempty" json:"res,omitempty"`
}

func (o NextMerkleRootRes) DeepCopy() NextMerkleRootRes {
	return NextMerkleRootRes{
		Res: (func(x *MerkleRootV2) *MerkleRootV2 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Res),
	}
}

// PassphraseState values are used in .config.json, so should not be changed without a migration strategy
type PassphraseState int

const (
	PassphraseState_KNOWN  PassphraseState = 0
	PassphraseState_RANDOM PassphraseState = 1
)

func (o PassphraseState) DeepCopy() PassphraseState { return o }

var PassphraseStateMap = map[string]PassphraseState{
	"KNOWN":  0,
	"RANDOM": 1,
}

var PassphraseStateRevMap = map[PassphraseState]string{
	0: "KNOWN",
	1: "RANDOM",
}

func (e PassphraseState) String() string {
	if v, ok := PassphraseStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type CanLogoutRes struct {
	CanLogout       bool            `codec:"canLogout" json:"canLogout"`
	Reason          string          `codec:"reason" json:"reason"`
	PassphraseState PassphraseState `codec:"passphraseState" json:"passphraseState"`
}

func (o CanLogoutRes) DeepCopy() CanLogoutRes {
	return CanLogoutRes{
		CanLogout:       o.CanLogout,
		Reason:          o.Reason,
		PassphraseState: o.PassphraseState.DeepCopy(),
	}
}

type UserPassphraseStateMsg struct {
	PassphraseState PassphraseState `codec:"passphraseState" json:"state"`
}

func (o UserPassphraseStateMsg) DeepCopy() UserPassphraseStateMsg {
	return UserPassphraseStateMsg{
		PassphraseState: o.PassphraseState.DeepCopy(),
	}
}

type UserBlock struct {
	Username      string `codec:"username" json:"username"`
	ChatBlocked   bool   `codec:"chatBlocked" json:"chatBlocked"`
	FollowBlocked bool   `codec:"followBlocked" json:"followBlocked"`
	CreateTime    *Time  `codec:"createTime,omitempty" json:"createTime,omitempty"`
	ModifyTime    *Time  `codec:"modifyTime,omitempty" json:"modifyTime,omitempty"`
}

func (o UserBlock) DeepCopy() UserBlock {
	return UserBlock{
		Username:      o.Username,
		ChatBlocked:   o.ChatBlocked,
		FollowBlocked: o.FollowBlocked,
		CreateTime: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.CreateTime),
		ModifyTime: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ModifyTime),
	}
}

type RecordInfoArg struct {
	ReportText     string `codec:"reportText" json:"reportText"`
	AttachMessages bool   `codec:"attachMessages" json:"attachMessages"`
}

func (o RecordInfoArg) DeepCopy() RecordInfoArg {
	return RecordInfoArg{
		ReportText:     o.ReportText,
		AttachMessages: o.AttachMessages,
	}
}

type UserBlockArg struct {
	Username       string         `codec:"username" json:"username"`
	SetChatBlock   *bool          `codec:"setChatBlock,omitempty" json:"setChatBlock,omitempty"`
	SetFollowBlock *bool          `codec:"setFollowBlock,omitempty" json:"setFollowBlock,omitempty"`
	Report         *RecordInfoArg `codec:"report,omitempty" json:"report,omitempty"`
}

func (o UserBlockArg) DeepCopy() UserBlockArg {
	return UserBlockArg{
		Username: o.Username,
		SetChatBlock: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.SetChatBlock),
		SetFollowBlock: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.SetFollowBlock),
		Report: (func(x *RecordInfoArg) *RecordInfoArg {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Report),
	}
}

type LoadUncheckedUserSummariesArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	Uids      []UID `codec:"uids" json:"uids"`
}

type LoadUserArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Uid       UID `codec:"uid" json:"uid"`
}

type LoadUserByNameArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type LoadUserPlusKeysArg struct {
	SessionID  int `codec:"sessionID" json:"sessionID"`
	Uid        UID `codec:"uid" json:"uid"`
	PollForKID KID `codec:"pollForKID" json:"pollForKID"`
}

type LoadUserPlusKeysV2Arg struct {
	SessionID  int                 `codec:"sessionID" json:"sessionID"`
	Uid        UID                 `codec:"uid" json:"uid"`
	PollForKID KID                 `codec:"pollForKID" json:"pollForKID"`
	Oa         OfflineAvailability `codec:"oa" json:"oa"`
}

type LoadPublicKeysArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Uid       UID `codec:"uid" json:"uid"`
}

type LoadMyPublicKeysArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoadMySettingsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ListTrackingArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Filter    string `codec:"filter" json:"filter"`
	Assertion string `codec:"assertion" json:"assertion"`
}

type ListTrackingJSONArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Filter    string `codec:"filter" json:"filter"`
	Verbose   bool   `codec:"verbose" json:"verbose"`
	Assertion string `codec:"assertion" json:"assertion"`
}

type LoadAllPublicKeysUnverifiedArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Uid       UID `codec:"uid" json:"uid"`
}

type ListTrackers2Arg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Assertion string `codec:"assertion" json:"assertion"`
	Reverse   bool   `codec:"reverse" json:"reverse"`
}

type ProfileEditArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	FullName  string `codec:"fullName" json:"fullName"`
	Location  string `codec:"location" json:"location"`
	Bio       string `codec:"bio" json:"bio"`
}

type InterestingPeopleArg struct {
	MaxUsers int `codec:"maxUsers" json:"maxUsers"`
}

type MeUserVersionArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	ForcePoll bool `codec:"forcePoll" json:"forcePoll"`
}

type GetUPAKArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type GetUPAKLiteArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type UploadUserAvatarArg struct {
	Filename string         `codec:"filename" json:"filename"`
	Crop     *ImageCropRect `codec:"crop,omitempty" json:"crop,omitempty"`
}

type ProofSuggestionsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type FindNextMerkleRootAfterRevokeArg struct {
	Uid  UID              `codec:"uid" json:"uid"`
	Kid  KID              `codec:"kid" json:"kid"`
	Loc  SigChainLocation `codec:"loc" json:"loc"`
	Prev MerkleRootV2     `codec:"prev" json:"prev"`
}

type FindNextMerkleRootAfterResetArg struct {
	Uid        UID             `codec:"uid" json:"uid"`
	ResetSeqno Seqno           `codec:"resetSeqno" json:"resetSeqno"`
	Prev       ResetMerkleRoot `codec:"prev" json:"prev"`
}

type CanLogoutArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoadPassphraseStateArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type UserCardArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Username   string `codec:"username" json:"username"`
	UseSession bool   `codec:"useSession" json:"useSession"`
}

type SetUserBlocksArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Blocks    []UserBlockArg `codec:"blocks" json:"blocks"`
}

type GetUserBlocksArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Usernames []string `codec:"usernames" json:"usernames"`
}

type BlockUserArg struct {
	Username string `codec:"username" json:"username"`
}

type UnblockUserArg struct {
	Username string `codec:"username" json:"username"`
}

type UserInterface interface {
	// Load user summaries for the supplied uids.
	// They are "unchecked" in that the client is not verifying the info from the server.
	// If len(uids) > 500, the first 500 will be returned.
	LoadUncheckedUserSummaries(context.Context, LoadUncheckedUserSummariesArg) ([]UserSummary, error)
	// Load a user from the server.
	LoadUser(context.Context, LoadUserArg) (User, error)
	LoadUserByName(context.Context, LoadUserByNameArg) (User, error)
	// Load a user + device keys from the server.
	LoadUserPlusKeys(context.Context, LoadUserPlusKeysArg) (UserPlusKeys, error)
	LoadUserPlusKeysV2(context.Context, LoadUserPlusKeysV2Arg) (UserPlusKeysV2AllIncarnations, error)
	// Load public keys for a user.
	LoadPublicKeys(context.Context, LoadPublicKeysArg) ([]PublicKey, error)
	// Load my public keys (for logged in user).
	LoadMyPublicKeys(context.Context, int) ([]PublicKey, error)
	// Load user settings (for logged in user).
	LoadMySettings(context.Context, int) (UserSettings, error)
	// The list-tracking functions get verified data from the tracking statements
	// in the user's sigchain.
	//
	// If assertion is empty, it will use the current logged in user.
	ListTracking(context.Context, ListTrackingArg) ([]UserSummary, error)
	ListTrackingJSON(context.Context, ListTrackingJSONArg) (string, error)
	// Load all the user's public keys (even those in reset key families)
	// from the server with no verification
	LoadAllPublicKeysUnverified(context.Context, LoadAllPublicKeysUnverifiedArg) ([]PublicKey, error)
	ListTrackers2(context.Context, ListTrackers2Arg) (UserSummary2Set, error)
	ProfileEdit(context.Context, ProfileEditArg) error
	InterestingPeople(context.Context, int) ([]InterestingPerson, error)
	MeUserVersion(context.Context, MeUserVersionArg) (UserVersion, error)
	// getUPAK returns a UPAK. Used mainly for debugging.
	GetUPAK(context.Context, UID) (UPAKVersioned, error)
	// getUPAKLite returns a UPKLiteV1AllIncarnations. Used mainly for debugging.
	GetUPAKLite(context.Context, UID) (UPKLiteV1AllIncarnations, error)
	UploadUserAvatar(context.Context, UploadUserAvatarArg) error
	ProofSuggestions(context.Context, int) (ProofSuggestionsRes, error)
	// FindNextMerkleRootAfterRevoke finds the first Merkle Root that contains the UID/KID
	// revocation at the given SigChainLocataion. The MerkleRootV2 prev is a hint as to where
	// we'll start our search. Usually it's the next one, but not always
	FindNextMerkleRootAfterRevoke(context.Context, FindNextMerkleRootAfterRevokeArg) (NextMerkleRootRes, error)
	// FindNextMerkleRootAfterReset finds the first Merkle root that contains the UID reset
	// at resetSeqno. You should pass it prev, which was the last known Merkle root at the time of
	// the reset. Usually, we'll just turn up the next Merkle root, but not always.
	FindNextMerkleRootAfterReset(context.Context, FindNextMerkleRootAfterResetArg) (NextMerkleRootRes, error)
	CanLogout(context.Context, int) (CanLogoutRes, error)
	LoadPassphraseState(context.Context, int) (PassphraseState, error)
	UserCard(context.Context, UserCardArg) (*UserCard, error)
	SetUserBlocks(context.Context, SetUserBlocksArg) error
	GetUserBlocks(context.Context, GetUserBlocksArg) ([]UserBlock, error)
	BlockUser(context.Context, string) error
	UnblockUser(context.Context, string) error
}

func UserProtocol(i UserInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.user",
		Methods: map[string]rpc.ServeHandlerDescription{
			"loadUncheckedUserSummaries": {
				MakeArg: func() interface{} {
					var ret [1]LoadUncheckedUserSummariesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadUncheckedUserSummariesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadUncheckedUserSummariesArg)(nil), args)
						return
					}
					ret, err = i.LoadUncheckedUserSummaries(ctx, typedArgs[0])
					return
				},
			},
			"loadUser": {
				MakeArg: func() interface{} {
					var ret [1]LoadUserArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadUserArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadUserArg)(nil), args)
						return
					}
					ret, err = i.LoadUser(ctx, typedArgs[0])
					return
				},
			},
			"loadUserByName": {
				MakeArg: func() interface{} {
					var ret [1]LoadUserByNameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadUserByNameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadUserByNameArg)(nil), args)
						return
					}
					ret, err = i.LoadUserByName(ctx, typedArgs[0])
					return
				},
			},
			"loadUserPlusKeys": {
				MakeArg: func() interface{} {
					var ret [1]LoadUserPlusKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadUserPlusKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadUserPlusKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadUserPlusKeys(ctx, typedArgs[0])
					return
				},
			},
			"loadUserPlusKeysV2": {
				MakeArg: func() interface{} {
					var ret [1]LoadUserPlusKeysV2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadUserPlusKeysV2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadUserPlusKeysV2Arg)(nil), args)
						return
					}
					ret, err = i.LoadUserPlusKeysV2(ctx, typedArgs[0])
					return
				},
			},
			"loadPublicKeys": {
				MakeArg: func() interface{} {
					var ret [1]LoadPublicKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadPublicKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadPublicKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadPublicKeys(ctx, typedArgs[0])
					return
				},
			},
			"loadMyPublicKeys": {
				MakeArg: func() interface{} {
					var ret [1]LoadMyPublicKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadMyPublicKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadMyPublicKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadMyPublicKeys(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"loadMySettings": {
				MakeArg: func() interface{} {
					var ret [1]LoadMySettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadMySettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadMySettingsArg)(nil), args)
						return
					}
					ret, err = i.LoadMySettings(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"listTracking": {
				MakeArg: func() interface{} {
					var ret [1]ListTrackingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListTrackingArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListTrackingArg)(nil), args)
						return
					}
					ret, err = i.ListTracking(ctx, typedArgs[0])
					return
				},
			},
			"listTrackingJSON": {
				MakeArg: func() interface{} {
					var ret [1]ListTrackingJSONArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListTrackingJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListTrackingJSONArg)(nil), args)
						return
					}
					ret, err = i.ListTrackingJSON(ctx, typedArgs[0])
					return
				},
			},
			"loadAllPublicKeysUnverified": {
				MakeArg: func() interface{} {
					var ret [1]LoadAllPublicKeysUnverifiedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadAllPublicKeysUnverifiedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadAllPublicKeysUnverifiedArg)(nil), args)
						return
					}
					ret, err = i.LoadAllPublicKeysUnverified(ctx, typedArgs[0])
					return
				},
			},
			"listTrackers2": {
				MakeArg: func() interface{} {
					var ret [1]ListTrackers2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListTrackers2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListTrackers2Arg)(nil), args)
						return
					}
					ret, err = i.ListTrackers2(ctx, typedArgs[0])
					return
				},
			},
			"profileEdit": {
				MakeArg: func() interface{} {
					var ret [1]ProfileEditArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ProfileEditArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ProfileEditArg)(nil), args)
						return
					}
					err = i.ProfileEdit(ctx, typedArgs[0])
					return
				},
			},
			"interestingPeople": {
				MakeArg: func() interface{} {
					var ret [1]InterestingPeopleArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]InterestingPeopleArg)
					if !ok {
						err = rpc.NewTypeError((*[1]InterestingPeopleArg)(nil), args)
						return
					}
					ret, err = i.InterestingPeople(ctx, typedArgs[0].MaxUsers)
					return
				},
			},
			"meUserVersion": {
				MakeArg: func() interface{} {
					var ret [1]MeUserVersionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MeUserVersionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MeUserVersionArg)(nil), args)
						return
					}
					ret, err = i.MeUserVersion(ctx, typedArgs[0])
					return
				},
			},
			"getUPAK": {
				MakeArg: func() interface{} {
					var ret [1]GetUPAKArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUPAKArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUPAKArg)(nil), args)
						return
					}
					ret, err = i.GetUPAK(ctx, typedArgs[0].Uid)
					return
				},
			},
			"getUPAKLite": {
				MakeArg: func() interface{} {
					var ret [1]GetUPAKLiteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUPAKLiteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUPAKLiteArg)(nil), args)
						return
					}
					ret, err = i.GetUPAKLite(ctx, typedArgs[0].Uid)
					return
				},
			},
			"uploadUserAvatar": {
				MakeArg: func() interface{} {
					var ret [1]UploadUserAvatarArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UploadUserAvatarArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UploadUserAvatarArg)(nil), args)
						return
					}
					err = i.UploadUserAvatar(ctx, typedArgs[0])
					return
				},
			},
			"proofSuggestions": {
				MakeArg: func() interface{} {
					var ret [1]ProofSuggestionsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ProofSuggestionsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ProofSuggestionsArg)(nil), args)
						return
					}
					ret, err = i.ProofSuggestions(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"findNextMerkleRootAfterRevoke": {
				MakeArg: func() interface{} {
					var ret [1]FindNextMerkleRootAfterRevokeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindNextMerkleRootAfterRevokeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindNextMerkleRootAfterRevokeArg)(nil), args)
						return
					}
					ret, err = i.FindNextMerkleRootAfterRevoke(ctx, typedArgs[0])
					return
				},
			},
			"findNextMerkleRootAfterReset": {
				MakeArg: func() interface{} {
					var ret [1]FindNextMerkleRootAfterResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindNextMerkleRootAfterResetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindNextMerkleRootAfterResetArg)(nil), args)
						return
					}
					ret, err = i.FindNextMerkleRootAfterReset(ctx, typedArgs[0])
					return
				},
			},
			"canLogout": {
				MakeArg: func() interface{} {
					var ret [1]CanLogoutArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CanLogoutArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CanLogoutArg)(nil), args)
						return
					}
					ret, err = i.CanLogout(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"loadPassphraseState": {
				MakeArg: func() interface{} {
					var ret [1]LoadPassphraseStateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadPassphraseStateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadPassphraseStateArg)(nil), args)
						return
					}
					ret, err = i.LoadPassphraseState(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"userCard": {
				MakeArg: func() interface{} {
					var ret [1]UserCardArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UserCardArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UserCardArg)(nil), args)
						return
					}
					ret, err = i.UserCard(ctx, typedArgs[0])
					return
				},
			},
			"setUserBlocks": {
				MakeArg: func() interface{} {
					var ret [1]SetUserBlocksArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetUserBlocksArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetUserBlocksArg)(nil), args)
						return
					}
					err = i.SetUserBlocks(ctx, typedArgs[0])
					return
				},
			},
			"getUserBlocks": {
				MakeArg: func() interface{} {
					var ret [1]GetUserBlocksArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUserBlocksArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUserBlocksArg)(nil), args)
						return
					}
					ret, err = i.GetUserBlocks(ctx, typedArgs[0])
					return
				},
			},
			"blockUser": {
				MakeArg: func() interface{} {
					var ret [1]BlockUserArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BlockUserArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BlockUserArg)(nil), args)
						return
					}
					err = i.BlockUser(ctx, typedArgs[0].Username)
					return
				},
			},
			"unblockUser": {
				MakeArg: func() interface{} {
					var ret [1]UnblockUserArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UnblockUserArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UnblockUserArg)(nil), args)
						return
					}
					err = i.UnblockUser(ctx, typedArgs[0].Username)
					return
				},
			},
		},
	}
}

type UserClient struct {
	Cli rpc.GenericClient
}

// Load user summaries for the supplied uids.
// They are "unchecked" in that the client is not verifying the info from the server.
// If len(uids) > 500, the first 500 will be returned.
func (c UserClient) LoadUncheckedUserSummaries(ctx context.Context, __arg LoadUncheckedUserSummariesArg) (res []UserSummary, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUncheckedUserSummaries", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Load a user from the server.
func (c UserClient) LoadUser(ctx context.Context, __arg LoadUserArg) (res User, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUser", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) LoadUserByName(ctx context.Context, __arg LoadUserByNameArg) (res User, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUserByName", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Load a user + device keys from the server.
func (c UserClient) LoadUserPlusKeys(ctx context.Context, __arg LoadUserPlusKeysArg) (res UserPlusKeys, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUserPlusKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) LoadUserPlusKeysV2(ctx context.Context, __arg LoadUserPlusKeysV2Arg) (res UserPlusKeysV2AllIncarnations, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUserPlusKeysV2", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Load public keys for a user.
func (c UserClient) LoadPublicKeys(ctx context.Context, __arg LoadPublicKeysArg) (res []PublicKey, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadPublicKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Load my public keys (for logged in user).
func (c UserClient) LoadMyPublicKeys(ctx context.Context, sessionID int) (res []PublicKey, err error) {
	__arg := LoadMyPublicKeysArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.user.loadMyPublicKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Load user settings (for logged in user).
func (c UserClient) LoadMySettings(ctx context.Context, sessionID int) (res UserSettings, err error) {
	__arg := LoadMySettingsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.user.loadMySettings", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// The list-tracking functions get verified data from the tracking statements
// in the user's sigchain.
//
// If assertion is empty, it will use the current logged in user.
func (c UserClient) ListTracking(ctx context.Context, __arg ListTrackingArg) (res []UserSummary, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTracking", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) ListTrackingJSON(ctx context.Context, __arg ListTrackingJSONArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTrackingJSON", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Load all the user's public keys (even those in reset key families)
// from the server with no verification
func (c UserClient) LoadAllPublicKeysUnverified(ctx context.Context, __arg LoadAllPublicKeysUnverifiedArg) (res []PublicKey, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadAllPublicKeysUnverified", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) ListTrackers2(ctx context.Context, __arg ListTrackers2Arg) (res UserSummary2Set, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTrackers2", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) ProfileEdit(ctx context.Context, __arg ProfileEditArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.profileEdit", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c UserClient) InterestingPeople(ctx context.Context, maxUsers int) (res []InterestingPerson, err error) {
	__arg := InterestingPeopleArg{MaxUsers: maxUsers}
	err = c.Cli.Call(ctx, "keybase.1.user.interestingPeople", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) MeUserVersion(ctx context.Context, __arg MeUserVersionArg) (res UserVersion, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.meUserVersion", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// getUPAK returns a UPAK. Used mainly for debugging.
func (c UserClient) GetUPAK(ctx context.Context, uid UID) (res UPAKVersioned, err error) {
	__arg := GetUPAKArg{Uid: uid}
	err = c.Cli.Call(ctx, "keybase.1.user.getUPAK", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// getUPAKLite returns a UPKLiteV1AllIncarnations. Used mainly for debugging.
func (c UserClient) GetUPAKLite(ctx context.Context, uid UID) (res UPKLiteV1AllIncarnations, err error) {
	__arg := GetUPAKLiteArg{Uid: uid}
	err = c.Cli.Call(ctx, "keybase.1.user.getUPAKLite", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) UploadUserAvatar(ctx context.Context, __arg UploadUserAvatarArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.uploadUserAvatar", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c UserClient) ProofSuggestions(ctx context.Context, sessionID int) (res ProofSuggestionsRes, err error) {
	__arg := ProofSuggestionsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.user.proofSuggestions", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// FindNextMerkleRootAfterRevoke finds the first Merkle Root that contains the UID/KID
// revocation at the given SigChainLocataion. The MerkleRootV2 prev is a hint as to where
// we'll start our search. Usually it's the next one, but not always
func (c UserClient) FindNextMerkleRootAfterRevoke(ctx context.Context, __arg FindNextMerkleRootAfterRevokeArg) (res NextMerkleRootRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.findNextMerkleRootAfterRevoke", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// FindNextMerkleRootAfterReset finds the first Merkle root that contains the UID reset
// at resetSeqno. You should pass it prev, which was the last known Merkle root at the time of
// the reset. Usually, we'll just turn up the next Merkle root, but not always.
func (c UserClient) FindNextMerkleRootAfterReset(ctx context.Context, __arg FindNextMerkleRootAfterResetArg) (res NextMerkleRootRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.findNextMerkleRootAfterReset", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) CanLogout(ctx context.Context, sessionID int) (res CanLogoutRes, err error) {
	__arg := CanLogoutArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.user.canLogout", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) LoadPassphraseState(ctx context.Context, sessionID int) (res PassphraseState, err error) {
	__arg := LoadPassphraseStateArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.user.loadPassphraseState", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) UserCard(ctx context.Context, __arg UserCardArg) (res *UserCard, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.userCard", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) SetUserBlocks(ctx context.Context, __arg SetUserBlocksArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.setUserBlocks", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c UserClient) GetUserBlocks(ctx context.Context, __arg GetUserBlocksArg) (res []UserBlock, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.getUserBlocks", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserClient) BlockUser(ctx context.Context, username string) (err error) {
	__arg := BlockUserArg{Username: username}
	err = c.Cli.Call(ctx, "keybase.1.user.blockUser", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c UserClient) UnblockUser(ctx context.Context, username string) (err error) {
	__arg := UnblockUserArg{Username: username}
	err = c.Cli.Call(ctx, "keybase.1.user.unblockUser", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
