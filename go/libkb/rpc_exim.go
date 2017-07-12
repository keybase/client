// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Export-Import for RPC stubs

package libkb

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/openpgp"
	pgpErrors "github.com/keybase/go-crypto/openpgp/errors"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func (sh SigHint) Export() *keybase1.SigHint {
	return &keybase1.SigHint{
		RemoteId:  sh.remoteID,
		ApiUrl:    sh.apiURL,
		HumanUrl:  sh.humanURL,
		CheckText: sh.checkText,
	}
}

func (l LinkCheckResult) ExportToIdentifyRow(i int) keybase1.IdentifyRow {
	return keybase1.IdentifyRow{
		RowId:     i,
		Proof:     ExportRemoteProof(l.link),
		TrackDiff: ExportTrackDiff(l.diff),
	}
}

func (l LinkCheckResult) Export() keybase1.LinkCheckResult {
	ret := keybase1.LinkCheckResult{
		ProofId:       l.position,
		ProofResult:   ExportProofError(l.err),
		SnoozedResult: ExportProofError(l.snoozedErr),
		TorWarning:    l.torWarning,
	}
	if l.cached != nil {
		ret.Cached = l.cached.Export()
	}
	bt := false
	if l.diff != nil {
		ret.Diff = ExportTrackDiff(l.diff)
		if l.diff.BreaksTracking() {
			bt = true
		}
	}
	if l.remoteDiff != nil {
		ret.RemoteDiff = ExportTrackDiff(l.remoteDiff)
		if l.remoteDiff.BreaksTracking() {
			bt = true
		}
	}
	if l.hint != nil {
		ret.Hint = l.hint.Export()
	}
	ret.TmpTrackExpireTime = keybase1.ToTime(l.tmpTrackExpireTime)
	ret.BreaksTracking = bt
	return ret
}

func (cr CheckResult) Export() *keybase1.CheckResult {
	return &keybase1.CheckResult{
		ProofResult: ExportProofError(cr.Status),
		Time:        keybase1.ToTime(cr.Time),
		Freshness:   cr.Freshness(),
	}
}

func ExportRemoteProof(p RemoteProofChainLink) keybase1.RemoteProof {
	k, v := p.ToKeyValuePair()
	return keybase1.RemoteProof{
		ProofType:     p.GetProofType(),
		Key:           k,
		Value:         strings.ToLower(v),
		DisplayMarkup: v,
		SigID:         p.GetSigID(),
		MTime:         keybase1.ToTime(p.GetCTime()),
	}
}

func (is IdentifyState) ExportToUncheckedIdentity() *keybase1.Identity {
	return is.res.ExportToUncheckedIdentity()
}

func (ir IdentifyOutcome) ExportToUncheckedIdentity() *keybase1.Identity {
	tmp := keybase1.Identity{
		Status: ExportErrorAsStatus(ir.Error),
	}
	if ir.TrackUsed != nil {
		tmp.WhenLastTracked = keybase1.ToTime(ir.TrackUsed.GetCTime())
	}

	pc := ir.ProofChecksSorted()
	tmp.Proofs = make([]keybase1.IdentifyRow, len(pc))
	for j, p := range pc {
		tmp.Proofs[j] = p.ExportToIdentifyRow(j)
	}

	tmp.Revoked = make([]keybase1.TrackDiff, len(ir.Revoked))
	for j, d := range ir.Revoked {
		// Should have all non-nil elements...
		tmp.Revoked[j] = *ExportTrackDiff(d)
		if d.BreaksTracking() {
			tmp.BreaksTracking = true
		}
	}
	tmp.RevokedDetails = ir.RevokedDetails
	return &tmp
}

type ExportableError interface {
	error
	ToStatus() keybase1.Status
}

func ExportProofError(pe ProofError) (ret keybase1.ProofResult) {
	if pe == nil {
		ret.State = keybase1.ProofState_OK
		ret.Status = keybase1.ProofStatus_OK
	} else {
		ret.Status = pe.GetProofStatus()
		ret.State = ProofErrorToState(pe)
		ret.Desc = pe.GetDesc()
	}
	return
}

func ImportProofError(e keybase1.ProofResult) ProofError {
	ps := keybase1.ProofStatus(e.Status)
	if ps == keybase1.ProofStatus_OK {
		return nil
	}
	return NewProofError(ps, e.Desc)
}

func ExportErrorAsStatus(e error) (ret *keybase1.Status) {
	if e == nil {
		return nil
	}

	if e == io.EOF {
		return &keybase1.Status{
			Code: SCStreamEOF,
			Name: "STREAM_EOF",
		}
	}

	if e == pgpErrors.ErrKeyIncorrect {
		return &keybase1.Status{
			Code: SCKeyNoActive,
			Name: "SC_KEY_NO_ACTIVE",
			Desc: "No PGP key found",
		}
	}

	if ee, ok := e.(ExportableError); ok {
		tmp := ee.ToStatus()
		return &tmp
	}

	if G.Env.GetRunMode() != ProductionRunMode {
		G.Log.Warning("not exportable error: %v (%T)", e, e)
	}

	return &keybase1.Status{
		Name: "GENERIC",
		Code: SCGeneric,
		Desc: e.Error(),
	}
}

//=============================================================================

func WrapError(e error) interface{} {
	return ExportErrorAsStatus(e)
}

var _ rpc.WrapErrorFunc = WrapError

type ErrorUnwrapper struct{}

func (eu ErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

func (eu ErrorUnwrapper) UnwrapError(arg interface{}) (appError error, dispatchError error) {
	targ, ok := arg.(*keybase1.Status)
	if !ok {
		dispatchError = errors.New("Error converting status to keybase1.Status object")
		return
	}
	appError = ImportStatusAsError(targ)
	return
}

var _ rpc.ErrorUnwrapper = ErrorUnwrapper{}

//=============================================================================

func ImportStatusAsError(s *keybase1.Status) error {
	if s == nil {
		return nil
	}
	switch s.Code {
	case SCOk:
		return nil
	case SCGeneric:
		return errors.New(s.Desc)
	case SCBadSession:
		return BadSessionError{}
	case SCBadLoginPassword:
		return PassphraseError{s.Desc}
	case SCKeyBadGen:
		return KeyGenError{s.Desc}
	case SCAlreadyLoggedIn:
		return LoggedInError{}
	case SCCanceled:
		return CanceledError{s.Desc}
	case SCInputCanceled:
		return InputCanceledError{}
	case SCKeyNoSecret:
		return NoSecretKeyError{}
	case SCLoginRequired:
		return LoginRequiredError{s.Desc}
	case SCNoSession:
		return NoSessionError{}
	case SCKeyCorrupted:
		return KeyCorruptedError{s.Desc}
	case SCKeyInUse:
		var fp *PGPFingerprint
		if len(s.Desc) > 0 {
			fp, _ = PGPFingerprintFromHex(s.Desc)
		}
		return KeyExistsError{fp}
	case SCKeyNotFound:
		return NoKeyError{s.Desc}
	case SCKeyNoEldest:
		return NoSigChainError{}
	case SCStreamExists:
		return StreamExistsError{}
	case SCBadInvitationCode:
		return BadInvitationCodeError{}
	case SCStreamNotFound:
		return StreamNotFoundError{}
	case SCStreamWrongKind:
		return StreamWrongKindError{}
	case SCStreamEOF:
		return io.EOF
	case SCSelfNotFound:
		return SelfNotFoundError{msg: s.Desc}
	case SCDeviceNotFound:
		return NoDeviceError{Reason: s.Desc}
	case SCDecryptionKeyNotFound:
		return NoDecryptionKeyError{Msg: s.Desc}
	case SCTimeout:
		return TimeoutError{}
	case SCDeviceMismatch:
		return ReceiverDeviceError{Msg: s.Desc}
	case SCBadKexPhrase:
		return InvalidKexPhraseError{}
	case SCReloginRequired:
		return ReloginRequiredError{}
	case SCDeviceRequired:
		return DeviceRequiredError{}
	case SCMissingResult:
		return IdentifyDidNotCompleteError{}
	case SCSibkeyAlreadyExists:
		return SibkeyAlreadyExistsError{}
	case SCNoUIDelegation:
		return UIDelegationUnavailableError{}
	case SCNoUI:
		return NoUIError{Which: s.Desc}
	case SCProfileNotPublic:
		return ProfileNotPublicError{msg: s.Desc}
	case SCIdentifyFailed:
		var assertion string
		if len(s.Fields) > 0 && s.Fields[0].Key == "assertion" {
			assertion = s.Fields[0].Value
		}
		return IdentifyFailedError{Assertion: assertion, Reason: s.Desc}
	case SCIdentifySummaryError:
		ret := IdentifySummaryError{}
		for _, pair := range s.Fields {
			if pair.Key == "username" {
				ret.username = NewNormalizedUsername(pair.Value)
			} else {
				// The other keys are expected to be "problem_%d".
				ret.problems = append(ret.problems, pair.Value)
			}
		}
		return ret
	case SCTrackingBroke:
		return TrackingBrokeError{}
	case SCResolutionFailed:
		var input string
		if len(s.Fields) > 0 && s.Fields[0].Key == "input" {
			input = s.Fields[0].Value
		}
		return ResolutionError{Msg: s.Desc, Input: input}
	case SCAccountReset:
		var e keybase1.UserVersion
		var r keybase1.Seqno
		seqnoFromString := func(s string) keybase1.Seqno {
			i, _ := strconv.Atoi(s)
			return keybase1.Seqno(i)
		}
		for _, field := range s.Fields {
			switch field.Key {
			case "e_uid":
				e.Uid, _ = keybase1.UIDFromString(field.Value)
			case "e_version":
				e.EldestSeqno = seqnoFromString(field.Value)
			case "r_version":
				r = seqnoFromString(field.Value)
			}
		}
		return NewAccountResetError(e, r)
	case SCKeyNoPGPEncryption:
		ret := NoPGPEncryptionKeyError{User: s.Desc}
		for _, field := range s.Fields {
			switch field.Key {
			case "device":
				ret.HasDeviceKey = true
			}
		}
		return ret
	case SCKeyNoNaClEncryption:
		ret := NoNaClEncryptionKeyError{User: s.Desc}
		for _, field := range s.Fields {
			switch field.Key {
			case "pgp":
				ret.HasPGPKey = true
			}
		}
		return ret
	case SCWrongCryptoFormat:
		ret := WrongCryptoFormatError{Operation: s.Desc}
		for _, field := range s.Fields {
			switch field.Key {
			case "wanted":
				ret.Wanted = CryptoMessageFormat(field.Value)
			case "received":
				ret.Received = CryptoMessageFormat(field.Value)
			}
		}
		return ret
	case SCKeySyncedPGPNotFound:
		return NoSyncedPGPKeyError{}
	case SCKeyNoMatchingGPG:
		ret := NoMatchingGPGKeysError{}
		for _, field := range s.Fields {
			switch field.Key {
			case "fingerprints":
				ret.Fingerprints = strings.Split(field.Value, ",")
			case "has_active_device":
				ret.HasActiveDevice = true
			}
		}
		return ret
	case SCDevicePrevProvisioned:
		return DeviceAlreadyProvisionedError{}
	case SCDeviceProvisionViaDevice:
		return ProvisionViaDeviceRequiredError{}
	case SCDeviceNoProvision:
		return ProvisionUnavailableError{}
	case SCGPGUnavailable:
		return GPGUnavailableError{}
	case SCNotFound:
		return NotFoundError{Msg: s.Desc}
	case SCDeleted:
		return DeletedError{Msg: s.Desc}
	case SCDecryptionError:
		return DecryptionError{}
	case SCKeyRevoked:
		return KeyRevokedError{msg: s.Desc}
	case SCDeviceNameInUse:
		return DeviceNameInUseError{}
	case SCDeviceBadName:
		return DeviceBadNameError{}
	case SCGenericAPIError:
		var code int
		for _, field := range s.Fields {
			switch field.Key {
			case "code":
				var err error
				code, err = strconv.Atoi(field.Value)
				if err != nil {
					G.Log.Warning("error parsing generic API error code: %s", err)
				}
			}
		}
		return &APIError{
			Msg:  s.Desc,
			Code: code,
		}
	case SCChatInternal:
		return ChatInternalError{}
	case SCChatConvExists:
		var convID chat1.ConversationID
		for _, field := range s.Fields {
			switch field.Key {
			case "ConvID":
				bs, err := chat1.MakeConvID(field.Value)
				if err != nil {
					G.Log.Warning("error parsing ChatConvExistsError")
				}
				convID = chat1.ConversationID(bs)
			}
		}
		return ChatConvExistsError{
			ConvID: convID,
		}
	case SCChatUnknownTLFID:
		var tlfID chat1.TLFID
		for _, field := range s.Fields {
			switch field.Key {
			case "TlfID":
				var err error
				tlfID, err = chat1.MakeTLFID(field.Value)
				if err != nil {
					G.Log.Warning("error parsing chat unknown TLF ID error")
				}
			}
		}
		return ChatUnknownTLFIDError{
			TlfID: tlfID,
		}
	case SCChatNotInConv:
		var uid gregor1.UID
		for _, field := range s.Fields {
			switch field.Key {
			case "UID":
				val, err := hex.DecodeString(field.Value)
				if err != nil {
					G.Log.Warning("error parsing chat not in conv UID")
				}
				uid = gregor1.UID(val)
			}
		}
		return ChatNotInConvError{
			UID: uid,
		}
	case SCChatNotInTeam:
		var uid gregor1.UID
		for _, field := range s.Fields {
			switch field.Key {
			case "UID":
				val, err := hex.DecodeString(field.Value)
				if err != nil {
					G.Log.Warning("error parsing chat not in conv UID")
				}
				uid = gregor1.UID(val)
			}
		}
		return ChatNotInTeamError{
			UID: uid,
		}
	case SCChatTLFFinalized:
		var tlfID chat1.TLFID
		for _, field := range s.Fields {
			switch field.Key {
			case "TlfID":
				var err error
				tlfID, err = chat1.MakeTLFID(field.Value)
				if err != nil {
					G.Log.Warning("error parsing chat tlf finalized TLFID: %s", err.Error())
				}
			}
		}
		return ChatTLFFinalizedError{
			TlfID: tlfID,
		}
	case SCChatBadMsg:
		return ChatBadMsgError{Msg: s.Desc}
	case SCChatBroadcast:
		return ChatBroadcastError{Msg: s.Desc}
	case SCChatRateLimit:
		var rlimit chat1.RateLimit
		for _, field := range s.Fields {
			switch field.Key {
			case "RateLimit":
				var err error
				err = json.Unmarshal([]byte(field.Value), &rlimit)
				if err != nil {
					G.Log.Warning("error parsing chat rate limit: %s", err.Error())
				}
			}
		}
		if rlimit.Name == "" {
			G.Log.Warning("error rate limit information not found")
		}
		return ChatRateLimitError{
			RateLimit: rlimit,
			Msg:       s.Desc,
		}
	case SCChatAlreadySuperseded:
		return ChatAlreadySupersededError{Msg: s.Desc}
	case SCChatAlreadyDeleted:
		return ChatAlreadyDeletedError{Msg: s.Desc}
	case SCBadEmail:
		return BadEmailError{Msg: s.Desc}
	case SCExists:
		return ExistsError{Msg: s.Desc}
	case SCInvalidAddress:
		return InvalidAddressError{Msg: s.Desc}
	case SCChatCollision:
		return ChatCollisionError{}
	case SCChatMessageCollision:
		var headerHash string
		for _, field := range s.Fields {
			switch field.Key {
			case "HeaderHash":
				headerHash = field.Value
			}
		}
		return ChatMessageCollisionError{
			HeaderHash: headerHash,
		}
	case SCChatDuplicateMessage:
		var soutboxID string
		for _, field := range s.Fields {
			switch field.Key {
			case "OutboxID":
				soutboxID = field.Value
			}
		}
		boutboxID, _ := hex.DecodeString(soutboxID)
		return ChatDuplicateMessageError{
			OutboxID: chat1.OutboxID(boutboxID),
		}
	case SCChatClientError:
		return ChatClientError{Msg: s.Desc}
	case SCNeedSelfRekey:
		ret := NeedSelfRekeyError{Msg: s.Desc}
		for _, field := range s.Fields {
			switch field.Key {
			case "Tlf":
				ret.Tlf = field.Value
			}
		}
		return ret
	case SCNeedOtherRekey:
		ret := NeedOtherRekeyError{Msg: s.Desc}
		for _, field := range s.Fields {
			switch field.Key {
			case "Tlf":
				ret.Tlf = field.Value
			}
		}
		return ret

	default:
		ase := AppStatusError{
			Code:   s.Code,
			Name:   s.Name,
			Desc:   s.Desc,
			Fields: make(map[string]string),
		}
		for _, f := range s.Fields {
			ase.Fields[f.Key] = f.Value
		}
		return ase
	}
}

//=============================================================================

func (a AppStatusError) ToStatus() keybase1.Status {
	var fields []keybase1.StringKVPair
	for k, v := range a.Fields {
		fields = append(fields, keybase1.StringKVPair{Key: k, Value: v})
	}

	return keybase1.Status{
		Code:   a.Code,
		Name:   a.Name,
		Desc:   a.Desc,
		Fields: fields,
	}
}

//=============================================================================

func ExportTrackDiff(d TrackDiff) (res *keybase1.TrackDiff) {
	if d != nil {
		res = &keybase1.TrackDiff{
			Type:          keybase1.TrackDiffType(d.GetTrackDiffType()),
			DisplayMarkup: d.ToDisplayString(),
		}
	}
	return
}

//=============================================================================

func ImportPGPFingerprintSlice(fp []byte) (ret *PGPFingerprint) {
	if fp == nil {
		return nil
	}
	if len(fp) != PGPFingerprintLen {
		return nil
	}

	var tmp PGPFingerprint
	copy(tmp[:], fp)
	return &tmp
}

//=============================================================================

func (s TrackSummary) Export(username string) (ret keybase1.TrackSummary) {
	ret.Time = keybase1.ToTime(s.time)
	ret.IsRemote = s.isRemote
	ret.Username = username
	return
}

func ImportTrackSummary(s *keybase1.TrackSummary) *TrackSummary {
	if s == nil {
		return nil
	}

	ret := &TrackSummary{
		time:     keybase1.FromTime(s.Time),
		isRemote: s.IsRemote,
		username: s.Username,
	}
	return ret
}

func ExportTrackSummary(l *TrackLookup, username string) *keybase1.TrackSummary {
	if l == nil {
		return nil
	}

	tmp := l.ToSummary().Export(username)
	return &tmp
}

//=============================================================================

func (ir *IdentifyOutcome) Export() *keybase1.IdentifyOutcome {
	v := make([]string, len(ir.Warnings))
	for i, w := range ir.Warnings {
		v[i] = w.Warning()
	}
	del := make([]keybase1.TrackDiff, len(ir.Revoked))
	for i, d := range ir.Revoked {
		del[i] = *ExportTrackDiff(d)
	}
	ret := &keybase1.IdentifyOutcome{
		Username:          ir.Username.String(),
		Status:            ExportErrorAsStatus(ir.Error),
		Warnings:          v,
		TrackUsed:         ExportTrackSummary(ir.TrackUsed, ir.Username.String()),
		TrackStatus:       ir.TrackStatus(),
		NumTrackFailures:  ir.NumTrackFailures(),
		NumTrackChanges:   ir.NumTrackChanges(),
		NumProofFailures:  ir.NumProofFailures(),
		NumRevoked:        ir.NumRevoked(),
		NumProofSuccesses: ir.NumProofSuccesses(),
		Revoked:           del,
		TrackOptions:      ir.TrackOptions,
		Reason:            ir.Reason,
	}
	return ret
}

//=============================================================================

func DisplayTrackArg(sessionID int, stmt string) *keybase1.DisplayTrackStatementArg {
	return &keybase1.DisplayTrackStatementArg{
		SessionID: sessionID,
		Stmt:      stmt,
	}
}

//=============================================================================

func ImportWarnings(v []string) Warnings {
	w := make([]Warning, len(v))
	for i, s := range v {
		w[i] = StringWarning(s)
	}
	return Warnings{w: w}
}

//=============================================================================

func (c CryptocurrencyChainLink) Export() (ret keybase1.Cryptocurrency) {
	ret.Pkhash = c.pkhash
	ret.Address = c.address
	ret.SigID = c.GetSigID()
	ret.Type = c.typ.String()
	ret.Family = string(c.typ.ToCryptocurrencyFamily())
	return ret
}

//=============================================================================

func (c CurrentStatus) Export() (ret keybase1.GetCurrentStatusRes) {
	ret.Configured = c.Configured
	ret.Registered = c.Registered
	ret.LoggedIn = c.LoggedIn
	ret.SessionIsValid = c.SessionIsValid
	if c.User != nil {
		ret.User = c.User.Export()
	}
	// ret.ServerUri = G.Env.GetServerUri();
	return
}

//=============================================================================

func (p PassphraseError) ToStatus() (s keybase1.Status) {
	s.Code = SCBadLoginPassword
	s.Name = "BAD_LOGIN_PASSWORD"
	s.Desc = p.Msg
	return
}

func (m Markup) Export() (ret keybase1.Text) {
	ret.Data = m.data
	ret.Markup = true
	return
}

//=============================================================================

func (e LoggedInError) ToStatus() (s keybase1.Status) {
	s.Code = SCAlreadyLoggedIn
	s.Name = "ALREADY_LOGGED_IN"
	s.Desc = "Already logged in as a different user"
	return
}

//=============================================================================

func (e LoggedInWrongUserError) ToStatus() (s keybase1.Status) {
	s.Code = SCAlreadyLoggedIn
	s.Name = "ALREADY_LOGGED_IN"
	s.Desc = e.Error()
	return
}

//=============================================================================

func (e KeyGenError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyBadGen
	s.Name = "KEY_BAD_GEN"
	s.Desc = e.Msg
	return
}

//=============================================================================

func (c CanceledError) ToStatus() (s keybase1.Status) {
	s.Code = SCCanceled
	s.Name = "CANCELED"
	s.Desc = c.M
	return
}

//=============================================================================

func (e BadSessionError) ToStatus() (s keybase1.Status) {
	s.Code = SCBadSession
	s.Name = "BADSESSION"
	s.Desc = "Bad session"
	return s
}

//=============================================================================

func (e InputCanceledError) ToStatus() (s keybase1.Status) {
	s.Code = SCInputCanceled
	s.Name = "CANCELED"
	s.Desc = "Input canceled"
	return
}

//=============================================================================

func (e SkipSecretPromptError) ToStatus() (s keybase1.Status) {
	s.Code = SCInputCanceled
	s.Name = "CANCELED"
	s.Desc = "Input canceled due to skip secret prompt"
	return
}

//=============================================================================

func (c KeyCorruptedError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyCorrupted
	s.Name = "KEY_CORRUPTED"
	if c.Msg != "" {
		s.Desc = c.Msg
	}
	return
}

//=============================================================================

func (c KeyExistsError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyInUse
	s.Name = "KEY_IN_USE"
	if c.Key != nil {
		s.Desc = c.Key.String()
	}
	return
}

//=============================================================================

func (ids Identities) Export() (res []keybase1.PGPIdentity) {
	var n int
	if ids == nil {
		n = 0
	} else {
		n = len(ids)
	}
	res = make([]keybase1.PGPIdentity, n)
	for i, id := range ids {
		res[i] = id.Export()
	}
	return
}

func ImportPGPIdentities(ids []keybase1.PGPIdentity) (ret Identities) {
	ret = Identities(make([]Identity, len(ids)))
	for i, id := range ids {
		ret[i] = ImportPGPIdentity(id)
	}
	return
}

//=============================================================================

func (id Identity) Export() (ret keybase1.PGPIdentity) {
	ret.Username = id.Username
	ret.Email = id.Email
	ret.Comment = id.Comment
	return
}

func ImportPGPIdentity(arg keybase1.PGPIdentity) (ret Identity) {
	ret.Username = arg.Username
	ret.Email = arg.Email
	ret.Comment = arg.Comment
	return
}

//=============================================================================

// Interface for sorting a list of PublicKeys

type PublicKeyList []keybase1.PublicKey

func (l PublicKeyList) Len() int { return len(l) }
func (l PublicKeyList) Less(i, j int) bool {
	// Keys created first come first.
	if l[i].CTime != l[j].CTime {
		return l[i].CTime < l[j].CTime
	}
	// For keys created at the same time, if one of them's the eldest key, it comes first.
	if l[i].IsEldest != l[j].IsEldest {
		return l[i].IsEldest
	}
	// Otherwise just sort by KID.
	return l[i].KID < l[j].KID
}
func (l PublicKeyList) Swap(i, j int) { l[i], l[j] = l[j], l[i] }

func ExportPGPIdentity(identity *openpgp.Identity) keybase1.PGPIdentity {
	if identity == nil || identity.UserId == nil {
		return keybase1.PGPIdentity{}
	}
	return keybase1.PGPIdentity{
		Username: identity.UserId.Name,
		Email:    identity.UserId.Email,
		Comment:  identity.UserId.Comment,
	}
}

func (kf KeyFamily) Export() []keybase1.PublicKey {
	var res []keybase1.PublicKey
	for kid := range kf.AllKIDs {
		if pgpKeySet, isPGP := kf.PGPKeySets[kid]; isPGP {
			res = append(res, pgpKeySet.PermissivelyMergedKey.Export())
		} else {
			res = append(res, keybase1.PublicKey{KID: kid})
		}
	}
	return res
}

func (bundle *PGPKeyBundle) Export() keybase1.PublicKey {
	kid := bundle.GetKID()
	fingerprintStr := ""
	identities := []keybase1.PGPIdentity{}
	fingerprintStr = bundle.GetFingerprint().String()
	for _, identity := range bundle.Identities {
		identities = append(identities, ExportPGPIdentity(identity))
	}
	return keybase1.PublicKey{
		KID:            kid,
		PGPFingerprint: fingerprintStr,
		PGPIdentities:  identities,
	}
}

func (ckf ComputedKeyFamily) exportPublicKey(key GenericKey) (pk keybase1.PublicKey) {
	pk.KID = key.GetKID()
	if pgpBundle, isPGP := key.(*PGPKeyBundle); isPGP {
		pk.PGPFingerprint = pgpBundle.GetFingerprint().String()
		ids := make([]keybase1.PGPIdentity, len(pgpBundle.Identities))
		i := 0
		for _, identity := range pgpBundle.Identities {
			ids[i] = ExportPGPIdentity(identity)
			i++
		}
		pk.PGPIdentities = ids
		pk.IsRevoked = len(pgpBundle.Revocations)+len(pgpBundle.UnverifiedRevocations) > 0
	}
	pk.DeviceID = ckf.cki.KIDToDeviceID[pk.KID]
	device := ckf.cki.Devices[pk.DeviceID]
	if device != nil {
		if device.Description != nil {
			pk.DeviceDescription = *device.Description
		}
		pk.DeviceType = device.Type
	}
	cki, ok := ckf.cki.Infos[pk.KID]
	if ok && cki != nil {
		if cki.Parent.IsValid() {
			pk.ParentID = cki.Parent.String()
		}
		pk.IsSibkey = cki.Sibkey
		pk.IsEldest = cki.Eldest
		pk.CTime = keybase1.TimeFromSeconds(cki.CTime)
		pk.ETime = keybase1.TimeFromSeconds(cki.ETime)
	}
	return pk
}

func publicKeyV2BaseFromComputedKeyInfo(kid keybase1.KID, info ComputedKeyInfo) (base keybase1.PublicKeyV2Base) {
	base = keybase1.PublicKeyV2Base{
		Kid:      kid,
		IsSibkey: info.Sibkey,
		IsEldest: info.Eldest,
		CTime:    keybase1.TimeFromSeconds(info.CTime),
		ETime:    keybase1.TimeFromSeconds(info.ETime),
	}
	if info.DelegatedAt != nil {
		base.Provisioning = keybase1.SignatureMetadata{
			Time: keybase1.TimeFromSeconds(info.DelegatedAt.Unix),
			PrevMerkleRootSigned: keybase1.MerkleRootV2{
				HashMeta: info.DelegatedAtHashMeta,
				Seqno:    keybase1.Seqno(info.DelegatedAt.Chain),
			},
			FirstAppearedUnverified: info.FirstAppearedUnverified,
		}
		dLen := len(info.DelegationsList)
		if dLen > 0 {
			base.Provisioning.SigningKID = info.DelegationsList[dLen-1].KID
		}
	}
	base.Provisioning.SigChainLocation = info.DelegatedAtSigChainLocation
	if info.RevokedAt != nil {
		base.Revocation = &keybase1.SignatureMetadata{
			Time: keybase1.TimeFromSeconds(info.RevokedAt.Unix),
			PrevMerkleRootSigned: keybase1.MerkleRootV2{
				HashMeta: info.RevokedAtHashMeta,
				Seqno:    keybase1.Seqno(info.RevokedAt.Chain),
			},
			FirstAppearedUnverified: info.FirstAppearedUnverified,
			SigningKID:              info.RevokedBy,
		}
		if info.RevokedAtSigChainLocation != nil {
			base.Revocation.SigChainLocation = *info.RevokedAtSigChainLocation
		}
	}
	return
}

func (cki ComputedKeyInfos) exportDeviceKeyV2(kid keybase1.KID) (key keybase1.PublicKeyV2NaCl) {
	info := cki.Infos[kid]
	if info == nil {
		cki.G().Log.Errorf("Tried to export nonexistent KID: %s", kid.String())
		return
	}
	key = keybase1.PublicKeyV2NaCl{
		Base:     publicKeyV2BaseFromComputedKeyInfo(kid, *info),
		DeviceID: cki.KIDToDeviceID[kid],
	}
	if !info.Parent.IsNil() {
		key.Parent = &info.Parent
	}
	if device := cki.Devices[key.DeviceID]; device != nil {
		key.DeviceType = device.Type
		if device.Description != nil {
			key.DeviceDescription = *device.Description
		}
	}
	return
}

func (cki ComputedKeyInfos) exportPGPKeyV2(kid keybase1.KID, kf *KeyFamily) (key keybase1.PublicKeyV2PGPSummary) {
	info := cki.Infos[kid]
	if info == nil {
		cki.G().Log.Errorf("Tried to export nonexistent KID: %s", kid.String())
		return
	}
	keySet := kf.PGPKeySets[kid]
	if keySet == nil {
		cki.G().Log.Errorf("Tried to export PGP key with no key set, KID: %s", kid.String())
		return
	}
	var bundle *PGPKeyBundle
	if info.ActivePGPHash != "" {
		bundle = keySet.KeysByHash[info.ActivePGPHash]
	} else {
		bundle = keySet.PermissivelyMergedKey
	}
	if bundle == nil {
		cki.G().Log.Errorf("Tried to export PGP key with no bundle, KID: %s", kid.String())
		return
	}
	key = keybase1.PublicKeyV2PGPSummary{
		Base:        publicKeyV2BaseFromComputedKeyInfo(kid, *info),
		Fingerprint: keybase1.PGPFingerprint(bundle.GetFingerprint()),
		Identities:  bundle.Export().PGPIdentities,
	}
	return
}

// Export is used by IDRes.  It includes PGP keys.
func (ckf ComputedKeyFamily) Export() []keybase1.PublicKey {
	var exportedKeys []keybase1.PublicKey
	for _, key := range ckf.GetAllActiveSibkeys() {
		exportedKeys = append(exportedKeys, ckf.exportPublicKey(key))
	}
	for _, key := range ckf.GetAllActiveSubkeys() {
		exportedKeys = append(exportedKeys, ckf.exportPublicKey(key))
	}
	sort.Sort(PublicKeyList(exportedKeys))
	return exportedKeys
}

// ExportDeviceKeys is used by ExportToUserPlusKeys.  The key list
// only contains device keys.  It also returns the number of PGP
// keys in the key family.
func (ckf ComputedKeyFamily) ExportDeviceKeys() (exportedKeys []keybase1.PublicKey, pgpKeyCount int) {
	for _, key := range ckf.GetAllActiveSibkeys() {
		if _, isPGP := key.(*PGPKeyBundle); isPGP {
			pgpKeyCount++
			continue
		}
		exportedKeys = append(exportedKeys, ckf.exportPublicKey(key))
	}
	for _, key := range ckf.GetAllActiveSubkeys() {
		if _, isPGP := key.(*PGPKeyBundle); isPGP {
			pgpKeyCount++
			continue
		}
		exportedKeys = append(exportedKeys, ckf.exportPublicKey(key))
	}
	sort.Sort(PublicKeyList(exportedKeys))
	return exportedKeys, pgpKeyCount
}

type perUserKeyList []keybase1.PerUserKey

func (l perUserKeyList) Len() int { return len(l) }
func (l perUserKeyList) Less(i, j int) bool {
	return l[i].Gen < l[j].Gen
}
func (l perUserKeyList) Swap(i, j int) {
	l[i], l[j] = l[j], l[i]
}

// ExportPerUserKeys exports the per-user public KIDs.
func (ckf ComputedKeyFamily) ExportPerUserKeys() (ret []keybase1.PerUserKey) {

	for _, k := range ckf.cki.PerUserKeys {
		ret = append(ret, k)
	}
	sort.Sort(perUserKeyList(ret))
	return ret
}

// ExportDeletedDeviceKeys is used by ExportToUserPlusKeys.  The key list
// only contains deleted device keys.
func (ckf ComputedKeyFamily) ExportDeletedDeviceKeys() []keybase1.PublicKey {
	var keys []keybase1.PublicKey
	for _, key := range ckf.GetDeletedKeys() {
		if _, isPGP := key.(*PGPKeyBundle); isPGP {
			continue
		}
		keys = append(keys, ckf.exportPublicKey(key))
	}
	sort.Sort(PublicKeyList(keys))
	return keys
}

// ExportAllPGPKeys exports all pgp keys.
func (ckf ComputedKeyFamily) ExportAllPGPKeys() (keys []keybase1.PublicKey) {
	for _, key := range ckf.GetAllActiveSibkeys() {
		if _, isPGP := key.(*PGPKeyBundle); isPGP {
			keys = append(keys, ckf.exportPublicKey(key))
		}
	}
	for _, key := range ckf.GetAllActiveSubkeys() {
		if _, isPGP := key.(*PGPKeyBundle); isPGP {
			keys = append(keys, ckf.exportPublicKey(key))
		}
	}
	sort.Sort(PublicKeyList(keys))
	return keys
}

func (ckf ComputedKeyFamily) ExportRevokedDeviceKeys() []keybase1.RevokedKey {
	var ex []keybase1.RevokedKey
	for _, key := range ckf.GetRevokedKeys() {
		if _, isPGP := key.Key.(*PGPKeyBundle); isPGP {
			continue
		}
		rkey := keybase1.RevokedKey{
			Key: ckf.exportPublicKey(key.Key),
			Time: keybase1.KeybaseTime{
				Unix:  keybase1.TimeFromSeconds(key.RevokedAt.Unix),
				Chain: key.RevokedAt.Chain,
			},
			By: key.RevokedBy,
		}
		ex = append(ex, rkey)
	}

	return ex
}

func (u *User) Export() *keybase1.User {
	return &keybase1.User{
		Uid:      u.GetUID(),
		Username: u.GetName(),
	}
}

func (u *User) ExportToVersionVector() keybase1.UserVersionVector {
	idv, _ := u.GetIDVersion()
	return keybase1.UserVersionVector{
		Id:       idv,
		SigHints: u.GetSigHintsVersion(),
		SigChain: int64(u.GetSigChainLastKnownSeqno()),
		// CachedAt is set by the upak loader right before we write to disk.
	}
}

func (u *User) ExportToUserPlusKeys() keybase1.UserPlusKeys {
	ret := keybase1.UserPlusKeys{
		Uid:         u.GetUID(),
		Username:    u.GetName(),
		EldestSeqno: u.GetCurrentEldestSeqno(),
	}
	ckf := u.GetComputedKeyFamily()
	if ckf != nil {
		ret.DeviceKeys, ret.PGPKeyCount = ckf.ExportDeviceKeys()
		ret.RevokedDeviceKeys = ckf.ExportRevokedDeviceKeys()
		ret.DeletedDeviceKeys = ckf.ExportDeletedDeviceKeys()
		ret.PerUserKeys = ckf.ExportPerUserKeys()
	}

	ret.Uvv = u.ExportToVersionVector()
	return ret
}

func (u *User) ExportToUserPlusAllKeys() keybase1.UserPlusAllKeys {
	return keybase1.UserPlusAllKeys{
		Base:         u.ExportToUserPlusKeys(),
		PGPKeys:      u.GetComputedKeyFamily().ExportAllPGPKeys(),
		RemoteTracks: u.ExportRemoteTracks(),
	}
}

type PerUserKeysList []keybase1.PerUserKey

func (p PerUserKeysList) Len() int           { return len(p) }
func (p PerUserKeysList) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }
func (p PerUserKeysList) Less(i, j int) bool { return p[i].Gen < p[j].Gen }

func (cki *ComputedKeyInfos) exportUPKV2Incarnation(uid keybase1.UID, username string, eldestSeqno keybase1.Seqno, kf *KeyFamily) keybase1.UserPlusKeysV2 {

	var perUserKeysList PerUserKeysList
	if cki != nil {
		for _, puk := range cki.PerUserKeys {
			perUserKeysList = append(perUserKeysList, puk)
		}
		sort.Sort(perUserKeysList)
	}

	deviceKeys := make(map[keybase1.KID]keybase1.PublicKeyV2NaCl)
	pgpSummaries := make(map[keybase1.KID]keybase1.PublicKeyV2PGPSummary)
	if cki != nil {
		for kid := range cki.Infos {
			if KIDIsPGP(kid) {
				pgpSummaries[kid] = cki.exportPGPKeyV2(kid, kf)
			} else {
				deviceKeys[kid] = cki.exportDeviceKeyV2(kid)
			}
		}
	}

	return keybase1.UserPlusKeysV2{
		Uid:         uid,
		Username:    username,
		EldestSeqno: eldestSeqno,
		PerUserKeys: perUserKeysList,
		DeviceKeys:  deviceKeys,
		PGPKeys:     pgpSummaries,
		// Uvv and RemoteTracks are set later, and only for the current incarnation
	}
}

func (u *User) ExportToUPKV2AllIncarnations() (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	// The KeyFamily holds all the PGP key bundles, and it applies to all
	// generations of this user.
	kf := u.GetKeyFamily()

	uid := u.GetUID()
	name := u.GetName()

	// First assemble all the past versions of this user.
	pastIncarnations := []keybase1.UserPlusKeysV2{}
	if u.sigChain() != nil {
		for _, subchain := range u.sigChain().prevSubchains {
			if len(subchain) == 0 {
				return nil, fmt.Errorf("Tried to export empty subchain for uid %s username %s", u.GetUID(), u.GetName())
			}
			cki := subchain[len(subchain)-1].cki
			pastIncarnations = append(pastIncarnations, cki.exportUPKV2Incarnation(uid, name, subchain[0].GetSeqno(), kf))
		}
	}

	// Then assemble the current version. This one gets a couple extra fields, Uvv and RemoteTracks.
	current := u.GetComputedKeyInfos().exportUPKV2Incarnation(uid, name, u.GetCurrentEldestSeqno(), kf)
	current.RemoteTracks = make(map[keybase1.UID]keybase1.RemoteTrack)
	if u.IDTable() != nil {
		for _, track := range u.IDTable().GetTrackList() {
			current.RemoteTracks[track.whomUID] = track.Export()
		}
	}

	// Collect the link IDs (that is, the hashes of the signature inputs) from all subchains.
	linkIDs := map[keybase1.Seqno]keybase1.LinkID{}
	if u.sigChain() != nil {
		for _, link := range u.sigChain().chainLinks {
			// Assert that all the links are in order as they go in. We should
			// never fail this check, but we *really* want to know about it if
			// we do.
			if int(link.GetSeqno()) != len(linkIDs)+1 {
				return nil, fmt.Errorf("Encountered out-of-sequence chain link %d while exporting uid %s username %s", link.GetSeqno(), u.GetUID(), u.GetName())
			}
			linkIDs[link.GetSeqno()] = link.LinkID().Export()
		}
	}

	return &keybase1.UserPlusKeysV2AllIncarnations{
		Current:          current,
		PastIncarnations: pastIncarnations,
		Uvv:              u.ExportToVersionVector(),
		SeqnoLinkIDs:     linkIDs,
		MinorVersion:     UPK2MinorVersionCurrent,
	}, nil
}

// NOTE: This list *must* be in sorted order. If we ever write V3, be careful to keep it sorted!
func (u *User) ExportRemoteTracks() []keybase1.RemoteTrack {
	var ret []keybase1.RemoteTrack
	if u.IDTable() == nil {
		return ret
	}
	trackList := u.IDTable().GetTrackList()
	for _, track := range trackList {
		ret = append(ret, track.Export())
	}
	sort.Slice(ret, func(i, j int) bool { return ret[i].Username < ret[j].Username })
	return ret
}

func (i LinkID) Export() keybase1.LinkID {
	return keybase1.LinkID(i.String())
}

func (t TrackChainLink) Export() keybase1.RemoteTrack {
	return keybase1.RemoteTrack{
		Uid:      t.whomUID,
		Username: t.whomUsername.String(),
		LinkID:   t.id.Export(),
	}
}

//=============================================================================

func (a PGPGenArg) ExportTo(ret *keybase1.PGPKeyGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.CreateUids = keybase1.PGPCreateUids{Ids: a.Ids.Export()}
	return
}

//=============================================================================

func ImportKeyGenArg(a keybase1.PGPKeyGenArg) (ret PGPGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.Ids = ImportPGPIdentities(a.CreateUids.Ids)
	return
}

//=============================================================================

func (t Tracker) Export() keybase1.Tracker { return keybase1.Tracker(t) }

//=============================================================================

func (e BadInvitationCodeError) ToStatus(s keybase1.Status) {
	s.Code = SCBadInvitationCode
	s.Name = "BAD_INVITATION_CODE"
	return
}

//=============================================================================

func (e StreamExistsError) ToStatus(s keybase1.Status) {
	s.Code = SCStreamExists
	s.Name = "STREAM_EXISTS"
	return
}

func (e StreamNotFoundError) ToStatus(s keybase1.Status) {
	s.Code = SCStreamNotFound
	s.Name = "SC_STREAM_NOT_FOUND"
	return
}

func (e StreamWrongKindError) ToStatus(s keybase1.Status) {
	s.Code = SCStreamWrongKind
	s.Name = "STREAM_WRONG_KIND"
	return
}

//=============================================================================

func (u NoSecretKeyError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyNoSecret
	s.Name = "KEY_NO_SECRET"
	return
}

//=============================================================================

func (u LoginRequiredError) ToStatus() (s keybase1.Status) {
	s.Code = SCLoginRequired
	s.Name = "LOGIN_REQUIRED"
	s.Desc = u.Context
	return
}

//=============================================================================

func (u NoSessionError) ToStatus() (s keybase1.Status) {
	s.Code = SCNoSession
	s.Name = "NO_SESSION"
	return
}

//=============================================================================

func (e APINetError) ToStatus() (s keybase1.Status) {
	s.Code = SCAPINetworkError
	s.Name = "API_NETWORK_ERROR"
	s.Desc = e.Error()
	return
}

func (e ProofNotFoundForServiceError) ToStatus() (s keybase1.Status) {
	s.Code = SCProofError
	s.Name = "PROOF_ERROR"
	s.Desc = e.Error()
	return
}

func (e ProofNotFoundForUsernameError) ToStatus() (s keybase1.Status) {
	s.Code = SCProofError
	s.Name = "PROOF_ERROR"
	s.Desc = e.Error()
	return
}

func (e NoDecryptionKeyError) ToStatus() (s keybase1.Status) {
	s.Code = SCDecryptionKeyNotFound
	s.Name = "KEY_NOT_FOUND_DECRYPTION"
	s.Desc = e.Msg
	return
}

func (e NoKeyError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyNotFound
	s.Name = "KEY_NOT_FOUND"
	s.Desc = e.Msg
	return
}

func (e NoSyncedPGPKeyError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCKeySyncedPGPNotFound,
		Name: "KEY_NOT_FOUND_SYNCED_PGP",
		Desc: e.Error(),
	}
}

func (e IdentifyTimeoutError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCIdentificationExpired,
		Name: "IDENTIFICATION_EXPIRED",
		Desc: e.Error(),
	}
}

func (e SelfNotFoundError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCSelfNotFound,
		Name: "SELF_NOT_FOUND",
		Desc: e.Error(),
	}
}

func (e NoDeviceError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDeviceNotFound,
		Name: "DEVICE_NOT_FOUND",
		Desc: e.Reason,
	}
}

func (e TimeoutError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCTimeout,
		Name: "SC_TIMEOUT",
		Desc: e.Error(),
	}
}

func (e ReceiverDeviceError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDeviceMismatch,
		Name: "SC_DEVICE_MISMATCH",
		Desc: e.Error(),
	}
}

func (e InvalidKexPhraseError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCBadKexPhrase,
		Name: "SC_BAD_KEX_PHRASE",
		Desc: e.Error(),
	}
}

func (e ReloginRequiredError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCReloginRequired,
		Name: "SC_RELOGIN_REQUIRED",
		Desc: e.Error(),
	}
}

func (e DeviceRequiredError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDeviceRequired,
		Name: "SC_DEVICE_REQUIRED",
		Desc: e.Error(),
	}
}

func (e IdentifyDidNotCompleteError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCMissingResult,
		Name: "SC_MISSING_RESULT",
		Desc: e.Error(),
	}
}

func (e SibkeyAlreadyExistsError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCSibkeyAlreadyExists,
		Name: "SC_SIBKEY_ALREADY_EXISTS",
		Desc: e.Error(),
	}
}

func (e UIDelegationUnavailableError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCNoUIDelegation,
		Name: "SC_UI_DELEGATION_UNAVAILABLE",
		Desc: e.Error(),
	}
}

func (e NoUIError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCNoUI,
		Name: "SC_NO_UI",
		Desc: e.Which,
	}
}

func (e ResolutionError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCResolutionFailed,
		Name: "SC_RESOLUTION_FAILED",
		Desc: e.Msg,
		Fields: []keybase1.StringKVPair{
			{Key: "input", Value: e.Input},
		},
	}
}

func (e IdentifyFailedError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCIdentifyFailed,
		Name: "SC_IDENTIFY_FAILED",
		Desc: e.Reason,
		Fields: []keybase1.StringKVPair{
			{Key: "assertion", Value: e.Assertion},
		},
	}
}

func (e IdentifySummaryError) ToStatus() keybase1.Status {
	kvpairs := []keybase1.StringKVPair{
		keybase1.StringKVPair{Key: "username", Value: e.username.String()},
	}
	for index, problem := range e.problems {
		kvpairs = append(kvpairs, keybase1.StringKVPair{
			Key:   fmt.Sprintf("problem_%d", index),
			Value: problem,
		})
	}
	return keybase1.Status{
		Code:   SCIdentifySummaryError,
		Name:   "SC_IDENTIFY_SUMMARY_ERROR",
		Desc:   e.Error(),
		Fields: kvpairs,
	}
}

func (e ProfileNotPublicError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCProfileNotPublic,
		Name: "SC_PROFILE_NOT_PUBLIC",
		Desc: e.msg,
	}
}

func (e TrackingBrokeError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCTrackingBroke,
		Name: "SC_TRACKING_BROKE",
	}
}

func (e NoPGPEncryptionKeyError) ToStatus() keybase1.Status {
	ret := keybase1.Status{
		Code: SCKeyNoPGPEncryption,
		Name: "SC_KEY_NO_PGP_ENCRYPTION",
		Desc: e.User,
	}
	if e.HasDeviceKey {
		ret.Fields = []keybase1.StringKVPair{
			{Key: "device", Value: "1"},
		}
	}
	return ret
}

func (e NoNaClEncryptionKeyError) ToStatus() keybase1.Status {
	ret := keybase1.Status{
		Code: SCKeyNoNaClEncryption,
		Name: "SC_KEY_NO_NACL_ENCRYPTION",
		Desc: e.User,
	}
	if e.HasPGPKey {
		ret.Fields = []keybase1.StringKVPair{
			{Key: "pgp", Value: "1"},
		}
	}
	return ret
}

func (e WrongCryptoFormatError) ToStatus() keybase1.Status {
	ret := keybase1.Status{
		Code: SCWrongCryptoFormat,
		Name: "SC_WRONG_CRYPTO_FORMAT",
		Desc: e.Operation,
		Fields: []keybase1.StringKVPair{
			{Key: "wanted", Value: string(e.Wanted)},
			{Key: "received", Value: string(e.Received)},
		},
	}
	return ret
}

func (e NoMatchingGPGKeysError) ToStatus() keybase1.Status {
	s := keybase1.Status{
		Code: SCKeyNoMatchingGPG,
		Name: "SC_KEY_NO_MATCHING_GPG",
		Fields: []keybase1.StringKVPair{
			{Key: "fingerprints", Value: strings.Join(e.Fingerprints, ",")},
		},
	}
	if e.HasActiveDevice {
		s.Fields = append(s.Fields, keybase1.StringKVPair{Key: "has_active_device", Value: "1"})
	}
	return s
}

func (e DeviceAlreadyProvisionedError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDevicePrevProvisioned,
		Name: "SC_DEVICE_PREV_PROVISIONED",
		Desc: e.Error(),
	}
}

func (e ProvisionUnavailableError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDeviceNoProvision,
		Name: "SC_DEVICE_NO_PROVISION",
		Desc: e.Error(),
	}
}

func (e ProvisionViaDeviceRequiredError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDeviceProvisionViaDevice,
		Name: "SC_DEVICE_PROVISION_VIA_DEVICE",
		Desc: e.Error(),
	}
}

func ExportTrackIDComponentToRevokedProof(tidc TrackIDComponent) keybase1.RevokedProof {
	key, value := tidc.ToKeyValuePair()
	ret := keybase1.RevokedProof{
		Diff: *ExportTrackDiff(TrackDiffRevoked{tidc}),
		Proof: keybase1.RemoteProof{
			Key:           key,
			Value:         value,
			DisplayMarkup: value,
			ProofType:     tidc.GetProofType(),
		},
	}
	return ret
}

func (e GPGUnavailableError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCGPGUnavailable,
		Name: "SC_GPG_UNAVAILABLE",
		Desc: e.Error(),
	}
}

func (e NotFoundError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCNotFound,
		Name: "SC_NOT_FOUND",
		Desc: e.Error(),
	}
}

func (e DeletedError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDeleted,
		Name: "SC_DELETED",
		Desc: e.Error(),
	}
}

func (e DecryptionError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCDecryptionError,
		Name: "SC_DECRYPTION_ERROR",
		Desc: e.Error(),
	}
}

func (e NoSigChainError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCKeyNoEldest,
		Name: "SC_KEY_NO_ELDEST",
		Desc: e.Error(),
	}
}

func (e KeyRevokedError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCKeyRevoked,
		Name: "SC_KEY_REVOKED_ERROR",
		Desc: e.msg,
	}
}

func (a *APIError) ToStatus() (s keybase1.Status) {
	s.Code = SCGenericAPIError
	s.Name = "GENERIC_API_ERROR"
	s.Desc = a.Msg
	s.Fields = []keybase1.StringKVPair{
		{Key: "code", Value: fmt.Sprintf("%d", a.Code)},
	}
	return
}

func (e DeviceNameInUseError) ToStatus() (s keybase1.Status) {
	return keybase1.Status{
		Code: SCDeviceNameInUse,
		Name: "SC_DEVICE_NAME_IN_USE",
		Desc: e.Error(),
	}
}

func (e ChatInternalError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatInternal,
		Name: "SC_CHAT_INTERNAL",
		Desc: e.Error(),
	}
}

func (e ChatConvExistsError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "ConvID",
		Value: e.ConvID.String(),
	}
	return keybase1.Status{
		Code:   SCChatConvExists,
		Name:   "SC_CHAT_CONVEXISTS",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatUnknownTLFIDError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "TlfID",
		Value: e.TlfID.String(),
	}
	return keybase1.Status{
		Code:   SCChatUnknownTLFID,
		Name:   "SC_CHAT_UNKNOWN_TLFID",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatNotInConvError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "UID",
		Value: e.UID.String(),
	}
	return keybase1.Status{
		Code:   SCChatNotInConv,
		Name:   "SC_CHAT_NOT_IN_CONV",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatNotInTeamError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "UID",
		Value: e.UID.String(),
	}
	return keybase1.Status{
		Code:   SCChatNotInTeam,
		Name:   "SC_CHAT_NOT_IN_TEAM",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatBadMsgError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatBadMsg,
		Name: "SC_CHAT_BADMSG",
		Desc: e.Error(),
	}
}

func (e ChatBroadcastError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatBroadcast,
		Name: "SC_CHAT_BROADCAST",
		Desc: e.Error(),
	}
}

func (e ChatRateLimitError) ToStatus() keybase1.Status {
	b, _ := json.Marshal(e.RateLimit)
	kv := keybase1.StringKVPair{
		Key:   "RateLimit",
		Value: string(b[:]),
	}
	return keybase1.Status{
		Code:   SCChatRateLimit,
		Name:   "SC_CHAT_RATELIMIT",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatAlreadySupersededError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatAlreadySuperseded,
		Name: "SC_CHAT_ALREADY_SUPERSEDED",
		Desc: e.Error(),
	}
}

func (e ChatAlreadyDeletedError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatAlreadyDeleted,
		Name: "SC_CHAT_ALREADY_DELETED",
		Desc: e.Error(),
	}
}

func (e ChatTLFFinalizedError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "TlfID",
		Value: e.TlfID.String(),
	}
	return keybase1.Status{
		Code:   SCChatTLFFinalized,
		Name:   "SC_CHAT_TLF_FINALIZED",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatCollisionError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatCollision,
		Name: "SC_CHAT_COLLISION",
		Desc: e.Error(),
	}
}

func (e ChatMessageCollisionError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "HeaderHash",
		Value: e.HeaderHash,
	}
	return keybase1.Status{
		Code:   SCChatMessageCollision,
		Name:   "SC_CHAT_MESSAGE_COLLISION",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatDuplicateMessageError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "OutboxID",
		Value: e.OutboxID.String(),
	}
	return keybase1.Status{
		Code:   SCChatDuplicateMessage,
		Name:   "SC_CHAT_DUPLICATE_MESSAGE",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

func (e ChatClientError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCChatClientError,
		Name: "SC_CHAT_CLIENT_ERROR",
		Desc: e.Error(),
	}
}

func (e BadEmailError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCBadEmail,
		Name: "SC_BAD_EMAIL",
		Desc: e.Error(),
	}
}

func (e ExistsError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCExists,
		Name: "SC_EXISTS",
		Desc: e.Error(),
	}
}

func (e InvalidAddressError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCInvalidAddress,
		Name: "SC_INVALID_ADDRESS",
		Desc: e.Error(),
	}
}

func (e NeedSelfRekeyError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCNeedSelfRekey,
		Name: "SC_NEED_SELF_REKEY",
		Desc: e.Error(),
	}
}

func (e NeedOtherRekeyError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCNeedOtherRekey,
		Name: "SC_NEED_OTHER_REKEY",
		Desc: e.Error(),
	}
}

func ImportDbKey(k keybase1.DbKey) DbKey {
	return DbKey{
		Typ: ObjType(k.ObjType),
		Key: k.Key,
	}
}

func (e AccountResetError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCAccountReset,
		Name: "ACCOUNT_RESET",
		Desc: e.Error(),
		Fields: []keybase1.StringKVPair{
			{Key: "e_uid", Value: string(e.expected.Uid)},
			{Key: "e_version", Value: fmt.Sprintf("%d", e.expected.EldestSeqno)},
			{Key: "r_version", Value: fmt.Sprintf("%d", e.received)},
		},
	}
}
