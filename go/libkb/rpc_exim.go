// Export-Import for RPC stubs

package libkb

import (
	"fmt"
	"io"
	"sort"

	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/errors"
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
		ProofId:     l.position,
		ProofResult: ExportProofError(l.err),
	}
	if l.cached != nil {
		ret.Cached = l.cached.Export()
	}
	if l.diff != nil {
		ret.Diff = ExportTrackDiff(l.diff)
	}
	if l.remoteDiff != nil {
		ret.RemoteDiff = ExportTrackDiff(l.remoteDiff)
	}
	if l.hint != nil {
		ret.Hint = l.hint.Export()
	}
	return ret
}

func (cr CheckResult) Export() *keybase1.CheckResult {
	return &keybase1.CheckResult{
		ProofResult:   ExportProofError(cr.Status),
		Time:          keybase1.ToTime(cr.Time),
		DisplayMarkup: cr.ToDisplayString(),
	}
}

func ExportRemoteProof(p RemoteProofChainLink) keybase1.RemoteProof {
	k, v := p.ToKeyValuePair()
	return keybase1.RemoteProof{
		ProofType:     p.GetProofType(),
		Key:           k,
		Value:         v,
		DisplayMarkup: v,
		SigID:         p.GetSigID(),
		MTime:         keybase1.ToTime(p.GetCTime()),
	}
}

func (ir IdentifyOutcome) ExportToUncheckedIdentity() *keybase1.Identity {
	tmp := keybase1.Identity{
		Status: ExportErrorAsStatus(ir.Error),
	}
	if ir.TrackUsed != nil {
		tmp.WhenLastTracked = int(ir.TrackUsed.GetCTime().Unix())
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
	}
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

	if e == errors.ErrKeyIncorrect {
		return &keybase1.Status{
			Code: SCKeyNoActive,
			Name: "SC_KEY_NO_ACTIVE",
			Desc: "No PGP key found",
		}
	}

	if e == ErrTimeout {
		return &keybase1.Status{
			Code: SCTimeout,
			Name: "SC_TIMEOUT",
			Desc: e.Error(),
		}
	}

	if ee, ok := e.(ExportableError); ok {
		tmp := ee.ToStatus()
		return &tmp
	}

	G.Log.Warning("not exportable error: %v (%T)", e, e)

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

func UnwrapError(nxt rpc2.DecodeNext) (app error, dispatch error) {
	var s *keybase1.Status
	if dispatch = nxt(&s); dispatch == nil {
		app = ImportStatusAsError(s)
	}
	return
}

//=============================================================================

func ImportStatusAsError(s *keybase1.Status) error {
	if s == nil {
		return nil
	}
	switch s.Code {
	case SCOk:
		return nil
	case SCGeneric:
		return fmt.Errorf(s.Desc)
	case SCBadLoginPassword:
		return PassphraseError{s.Desc}
	case SCKeyBadGen:
		return KeyGenError{s.Desc}
	case SCAlreadyLoggedIn:
		return LoggedInError{}
	case SCCanceled:
		return CanceledError{s.Desc}
	case SCKeyNoSecret:
		return NoSecretKeyError{}
	case SCLoginRequired:
		return LoginRequiredError{s.Desc}
	case SCKeyInUse:
		var fp *PGPFingerprint
		if len(s.Desc) > 0 {
			fp, _ = PGPFingerprintFromHex(s.Desc)
		}
		return KeyExistsError{fp}
	case SCStreamExists:
		return StreamExistsError{}
	case SCStreamNotFound:
		return StreamNotFoundError{}
	case SCStreamWrongKind:
		return StreamWrongKindError{}
	case SCStreamEOF:
		return io.EOF
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

	return &TrackSummary{
		time:     keybase1.FromTime(s.Time),
		isRemote: s.IsRemote,
		username: s.Username,
	}
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
		Username:          ir.Username,
		Status:            ExportErrorAsStatus(ir.Error),
		Warnings:          v,
		TrackUsed:         ExportTrackSummary(ir.TrackUsed, ir.Username),
		TrackStatus:       ir.TrackStatus(),
		NumTrackFailures:  ir.NumTrackFailures(),
		NumTrackChanges:   ir.NumTrackChanges(),
		NumProofFailures:  ir.NumProofFailures(),
		NumRevoked:        ir.NumRevoked(),
		NumProofSuccesses: ir.NumProofSuccesses(),
		Revoked:           del,
		TrackOptions:      ir.TrackOptions,
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
	return Warnings{w}
}

//=============================================================================

func (c CryptocurrencyChainLink) Export() (ret keybase1.Cryptocurrency) {
	ret.Pkhash = c.pkhash
	ret.Address = c.address
	return
}

//=============================================================================

func (c CurrentStatus) Export() (ret keybase1.GetCurrentStatusRes) {
	ret.Configured = c.Configured
	ret.Registered = c.Registered
	ret.LoggedIn = c.LoggedIn
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

func (c KeyExistsError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyInUse
	s.Name = "KEY_IN_USE"
	if c.Key != nil {
		s.Desc = c.Key.String()
	}
	return
}

//=============================================================================

func (c NoActiveKeyError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyNoActive
	s.Name = "KEY_NO_ACTIVE"
	s.Desc = c.Error()
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

func (ckf ComputedKeyFamily) Export() []keybase1.PublicKey {
	exportedKeys := []keybase1.PublicKey{}
	addKey := func(key GenericKey) {
		kid := key.GetKID()
		fingerprintStr := ""
		identities := []keybase1.PGPIdentity{}
		if pgpBundle, isPGP := key.(*PGPKeyBundle); isPGP {
			fingerprintStr = pgpBundle.GetFingerprint().String()
			for _, identity := range pgpBundle.Identities {
				identities = append(identities, ExportPGPIdentity(identity))
			}
		}
		cki := ckf.cki.Infos[kid]
		deviceID := ckf.cki.KIDToDeviceID[kid]
		device := ckf.cki.Devices[deviceID]
		deviceDescription := ""
		if device != nil {
			if device.Description != nil {
				deviceDescription = *device.Description
			}
		}
		parentID := ""
		if cki.Parent.IsValid() {
			parentID = cki.Parent.String()
		}
		exportedKeys = append(exportedKeys, keybase1.PublicKey{
			KID:               kid,
			PGPFingerprint:    fingerprintStr,
			PGPIdentities:     identities,
			IsSibkey:          cki.Sibkey,
			IsEldest:          cki.Eldest,
			IsWeb:             (device != nil && device.ID == ckf.cki.WebDeviceID),
			ParentID:          parentID,
			DeviceID:          deviceID,
			DeviceDescription: deviceDescription,
			CTime:             keybase1.TimeFromSeconds(cki.CTime),
			ETime:             keybase1.TimeFromSeconds(cki.ETime),
		})
	}
	for _, sibkey := range ckf.GetAllActiveSibkeys() {
		addKey(sibkey)
	}
	for _, subkey := range ckf.GetAllActiveSubkeys() {
		addKey(subkey)
	}
	sort.Sort(PublicKeyList(exportedKeys))
	return exportedKeys
}

func (u *User) Export() *keybase1.User {
	publicKeys := []keybase1.PublicKey{}
	if u.GetComputedKeyFamily() != nil {
		publicKeys = u.GetComputedKeyFamily().Export()
	}
	return &keybase1.User{
		Uid:        u.GetUID(),
		Username:   u.GetName(),
		PublicKeys: publicKeys,
	}
}

//=============================================================================

func (a PGPGenArg) ExportTo(ret *keybase1.PGPKeyGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.CreateUids = keybase1.PGPCreateUids{UseDefault: !a.NoDefPGPUid, Ids: a.Ids.Export()}
	return
}

//=============================================================================

func ImportKeyGenArg(a keybase1.PGPKeyGenArg) (ret PGPGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.NoDefPGPUid = !a.CreateUids.UseDefault
	ret.Ids = ImportPGPIdentities(a.CreateUids.Ids)
	return
}

//=============================================================================

func (t Tracker) Export() keybase1.Tracker { return keybase1.Tracker(t) }

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

func (e PGPDecError) ToStatus() (s keybase1.Status) {
	s.Code = SCKeyNotFound
	s.Name = "KEY_NOT_FOUND"
	s.Desc = e.Msg
	return
}

func (e IdentifyTimeoutError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Code: SCIdentificationExpired,
		Name: "IDENTIFICATION_EXPIRED",
		Desc: e.Error(),
	}
}
