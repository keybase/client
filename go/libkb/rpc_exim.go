// Export-Import for RPC stubs

package libkb

import (
	"fmt"
	"io"
	"sort"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/errors"
)

func (sh SigHint) Export() *keybase1.SigHint {
	return &keybase1.SigHint{
		RemoteId:  sh.remoteId,
		ApiUrl:    sh.apiUrl,
		HumanUrl:  sh.humanUrl,
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
		Timestamp:     int(cr.Time.Unix()),
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
		Mtime:         int(p.GetCTime().Unix()),
	}
}

type ByMtime []keybase1.IdentifyRow

func (x ByMtime) Len() int {
	return len(x)
}

func (x ByMtime) Less(a, b int) bool {
	return x[a].Proof.Mtime < x[b].Proof.Mtime
}

func (x ByMtime) Swap(a, b int) {
	x[a], x[b] = x[b], x[a]
}

func (ir IdentifyOutcome) ExportToUncheckedIdentity() *keybase1.Identity {
	tmp := keybase1.Identity{
		Status: ExportErrorAsStatus(ir.Error),
	}
	if ir.TrackUsed != nil {
		tmp.WhenLastTracked = int(ir.TrackUsed.GetCTime().Unix())
	}
	tmp.Proofs = make([]keybase1.IdentifyRow, len(ir.ProofChecks))
	for j, p := range ir.ProofChecks {
		tmp.Proofs[j] = p.ExportToIdentifyRow(j)
	}
	sort.Sort(ByMtime(tmp.Proofs))
	tmp.Deleted = make([]keybase1.TrackDiff, len(ir.Deleted))
	for j, d := range ir.Deleted {
		// Should have all non-nil elements...
		tmp.Deleted[j] = *ExportTrackDiff(d)
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
			Code: SC_STREAM_EOF,
			Name: "STREAM_EOF",
		}
	}

	if e == errors.ErrKeyIncorrect {
		return &keybase1.Status{
			Code: SC_KEY_NO_ACTIVE,
			Name: "SC_KEY_NO_ACTIVE",
			Desc: "No PGP key found",
		}
	}

	if ee, ok := e.(ExportableError); ok {
		tmp := ee.ToStatus()
		return &tmp
	}

	G.Log.Warning("not exportable error: %v (%T)", e, e)

	return &keybase1.Status{
		Name: "GENERIC",
		Code: SC_GENERIC,
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
	case SC_OK:
		return nil
	case SC_GENERIC:
		return fmt.Errorf(s.Desc)
	case SC_BAD_LOGIN_PASSWORD:
		return PassphraseError{s.Desc}
	case SC_KEY_BAD_GEN:
		return KeyGenError{s.Desc}
	case SC_ALREADY_LOGGED_IN:
		return LoggedInError{}
	case SC_CANCELED:
		return CanceledError{s.Desc}
	case SC_KEY_NO_SECRET:
		return NoSecretKeyError{}
	case SC_LOGIN_REQUIRED:
		return LoginRequiredError{s.Desc}
	case SC_KEY_IN_USE:
		var fp *PgpFingerprint
		if len(s.Desc) > 0 {
			fp, _ = PgpFingerprintFromHex(s.Desc)
		}
		return KeyExistsError{fp}
	case SC_STREAM_EXISTS:
		return StreamExistsError{}
	case SC_STREAM_NOT_FOUND:
		return StreamNotFoundError{}
	case SC_STREAM_WRONG_KIND:
		return StreamWrongKindError{}
	case SC_STREAM_EOF:
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

func ImportPgpFingerprint(f keybase1.FOKID) (ret *PgpFingerprint) {
	if f.PgpFingerprint != nil && len(*f.PgpFingerprint) == PGP_FINGERPRINT_LEN {
		var tmp PgpFingerprint
		copy(tmp[:], (*f.PgpFingerprint)[:])
		ret = &tmp
	}
	return
}

func (f *PgpFingerprint) ExportToFOKID() (ret keybase1.FOKID) {
	slc := (*f)[:]
	ret.PgpFingerprint = &slc
	return
}

//=============================================================================

func (f *FOKID) Export() (ret keybase1.FOKID) {
	if f != nil && f.Fp != nil {
		slc := (*f.Fp)[:]
		ret.PgpFingerprint = &slc
	}
	if f != nil && f.Kid != nil {
		tmp := []byte(f.Kid)
		ret.Kid = &tmp
	}
	return
}

//=============================================================================

func (s TrackSummary) Export(username string) (ret keybase1.TrackSummary) {
	ret.Time = int(s.time.Unix())
	ret.IsRemote = s.isRemote
	ret.Username = username
	return
}

func ImportTrackSummary(s *keybase1.TrackSummary) *TrackSummary {
	if s == nil {
		return nil
	}

	return &TrackSummary{
		time:     time.Unix(int64(s.Time), 0),
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
	del := make([]keybase1.TrackDiff, 0, len(ir.Deleted))
	for i, d := range ir.Deleted {
		del[i] = *ExportTrackDiff(d)
	}
	ret := &keybase1.IdentifyOutcome{
		Username:          ir.Username,
		Status:            ExportErrorAsStatus(ir.Error),
		Warnings:          v,
		TrackUsed:         ExportTrackSummary(ir.TrackUsed, ir.Username),
		NumTrackFailures:  ir.NumTrackFailures(),
		NumTrackChanges:   ir.NumTrackChanges(),
		NumProofFailures:  ir.NumProofFailures(),
		NumDeleted:        ir.NumDeleted(),
		NumProofSuccesses: ir.NumProofSuccesses(),
		Deleted:           del,
		LocalOnly:         ir.LocalOnly,
		ApproveRemote:     ir.ApproveRemote,
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

func ImportFinishAndPromptRes(f keybase1.FinishAndPromptRes) (ti TrackInstructions) {
	ti.Local = f.TrackLocal
	ti.Remote = f.TrackRemote
	return
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
	s.Code = SC_BAD_LOGIN_PASSWORD
	s.Name = "BAD_LOGIN_PASSWORD"
	s.Desc = p.msg
	return
}

func (m Markup) Export() (ret keybase1.Text) {
	ret.Data = m.data
	ret.Markup = true
	return
}

//=============================================================================

func (e LoggedInError) ToStatus() (s keybase1.Status) {
	s.Code = SC_ALREADY_LOGGED_IN
	s.Name = "ALREADY_LOGGED_IN"
	s.Desc = "Already logged in as a different user"
	return
}

//=============================================================================

func (e KeyGenError) ToStatus() (s keybase1.Status) {
	s.Code = SC_KEY_BAD_GEN
	s.Name = "KEY_BAD_GEN"
	s.Desc = e.Msg
	return
}

//=============================================================================

func (c CanceledError) ToStatus() (s keybase1.Status) {
	s.Code = SC_CANCELED
	s.Name = "CANCELED"
	s.Desc = c.M
	return
}

//=============================================================================

func (c KeyExistsError) ToStatus() (s keybase1.Status) {
	s.Code = SC_KEY_IN_USE
	s.Name = "KEY_IN_USE"
	if c.Key != nil {
		s.Desc = c.Key.String()
	}
	return
}

//=============================================================================

func (c NoActiveKeyError) ToStatus() (s keybase1.Status) {
	s.Code = SC_KEY_NO_ACTIVE
	s.Name = "KEY_NO_ACTIVE"
	s.Desc = c.Error()
	return
}

//=============================================================================

func (ids Identities) Export() (res []keybase1.PgpIdentity) {
	var n int
	if ids == nil {
		n = 0
	} else {
		n = len(ids)
	}
	res = make([]keybase1.PgpIdentity, n)
	for i, id := range ids {
		res[i] = id.Export()
	}
	return
}

func ImportPgpIdentities(ids []keybase1.PgpIdentity) (ret Identities) {
	ret = Identities(make([]Identity, len(ids)))
	for i, id := range ids {
		ret[i] = ImportPgpIdentity(id)
	}
	return
}

//=============================================================================

func (id Identity) Export() (ret keybase1.PgpIdentity) {
	ret.Username = id.Username
	ret.Email = id.Email
	ret.Comment = id.Comment
	return
}

func ImportPgpIdentity(arg keybase1.PgpIdentity) (ret Identity) {
	ret.Username = arg.Username
	ret.Email = arg.Email
	ret.Comment = arg.Comment
	return
}

//=============================================================================

func (u *UID) Export() keybase1.UID {
	return keybase1.UID(*u)
}

func (v UIDs) Export() []keybase1.UID {
	ret := make([]keybase1.UID, len(v))
	for i, el := range v {
		ret[i] = el.Export()
	}
	return ret
}

func ImportUID(u keybase1.UID) UID {
	return UID(u)
}

func ImportUIDs(v []keybase1.UID) UIDs {
	ret := make(UIDs, len(v))
	for i, el := range v {
		ret[i] = ImportUID(el)
	}
	return ret
}

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

func ExportPgpIdentity(identity *openpgp.Identity) keybase1.PgpIdentity {
	if identity == nil || identity.UserId == nil {
		return keybase1.PgpIdentity{}
	}
	return keybase1.PgpIdentity{
		Username: identity.UserId.Name,
		Email:    identity.UserId.Email,
		Comment:  identity.UserId.Comment,
	}
}

func (bundle *PgpKeyBundle) Export() keybase1.PublicKey {
	kid := bundle.GetKid().String()
	fingerprintStr := ""
	identities := []keybase1.PgpIdentity{}
	fingerprintStr = bundle.GetFingerprint().String()
	for _, identity := range bundle.Identities {
		identities = append(identities, ExportPgpIdentity(identity))
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
		kid := key.GetKid()
		fingerprintStr := ""
		identities := []keybase1.PgpIdentity{}
		if pgpBundle, isPGP := key.(*PgpKeyBundle); isPGP {
			fingerprintStr = pgpBundle.GetFingerprint().String()
			for _, identity := range pgpBundle.Identities {
				identities = append(identities, ExportPgpIdentity(identity))
			}
		}
		cki := ckf.cki.Infos[kid.ToFOKIDMapKey()]
		deviceID := ckf.cki.KidToDeviceId[kid.ToMapKey()]
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
			KID:               kid.String(),
			PGPFingerprint:    fingerprintStr,
			PGPIdentities:     identities,
			IsSibkey:          cki.Sibkey,
			IsEldest:          cki.Eldest,
			IsWeb:             (device != nil && device.Id == ckf.cki.WebDeviceID),
			ParentID:          parentID,
			DeviceID:          deviceID,
			DeviceDescription: deviceDescription,
			CTime:             cki.CTime,
			ETime:             cki.ETime,
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
		Uid:        u.GetUID().P().Export(),
		Username:   u.GetName(),
		Image:      u.Image,
		PublicKeys: publicKeys,
	}
}

//=============================================================================

func (a PGPGenArg) ExportTo(ret *keybase1.PgpKeyGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.CreateUids = keybase1.PgpCreateUids{UseDefault: !a.NoDefPGPUid, Ids: a.Ids.Export()}
	return
}

//=============================================================================

func ImportKeyGenArg(a keybase1.PgpKeyGenArg) (ret PGPGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.NoDefPGPUid = !a.CreateUids.UseDefault
	ret.Ids = ImportPgpIdentities(a.CreateUids.Ids)
	return
}

//=============================================================================

func (t Tracker) Export() keybase1.Tracker { return keybase1.Tracker(t) }

//=============================================================================

func (e StreamExistsError) ToStatus(s keybase1.Status) {
	s.Code = SC_STREAM_EXISTS
	s.Name = "STREAM_EXISTS"
	return
}

func (e StreamNotFoundError) ToStatus(s keybase1.Status) {
	s.Code = SC_STREAM_NOT_FOUND
	s.Name = "SC_STREAM_NOT_FOUND"
	return
}

func (e StreamWrongKindError) ToStatus(s keybase1.Status) {
	s.Code = SC_STREAM_WRONG_KIND
	s.Name = "STREAM_WRONG_KIND"
	return
}

//=============================================================================

func (u NoSecretKeyError) ToStatus() (s keybase1.Status) {
	s.Code = SC_KEY_NO_SECRET
	s.Name = "KEY_NO_SECRET"
	return
}

//=============================================================================

func (u LoginRequiredError) ToStatus() (s keybase1.Status) {
	s.Code = SC_LOGIN_REQUIRED
	s.Name = "LOGIN_REQUIRED"
	s.Desc = u.Context
	return
}

//=============================================================================

func (e APINetError) ToStatus() (s keybase1.Status) {
	s.Code = SC_API_NETWORK_ERROR
	s.Name = "API_NETWORK_ERROR"
	s.Desc = e.Error()
	return
}

func (e ProofNotFoundForServiceError) ToStatus() (s keybase1.Status) {
	s.Code = SC_PROOF_ERROR
	s.Name = "PROOF_ERROR"
	s.Desc = e.Error()
	return
}

func (e ProofNotFoundForUsernameError) ToStatus() (s keybase1.Status) {
	s.Code = SC_PROOF_ERROR
	s.Name = "PROOF_ERROR"
	s.Desc = e.Error()
	return
}

func (e PGPDecError) ToStatus() (s keybase1.Status) {
	s.Code = SC_KEY_NOT_FOUND
	s.Name = "KEY_NOT_FOUND"
	s.Desc = e.Msg
	return
}
