// Export-Import for RPC stubs

package libkb

import (
	"fmt"
	"sort"
	"time"

	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func (sh SigHint) Export() *keybase_1.SigHint {
	return &keybase_1.SigHint{
		RemoteId:  sh.remoteId,
		ApiUrl:    sh.apiUrl,
		HumanUrl:  sh.humanUrl,
		CheckText: sh.checkText,
	}
}

func (l LinkCheckResult) ExportToIdentifyRow(i int) keybase_1.IdentifyRow {
	return keybase_1.IdentifyRow{
		RowId:     i,
		Proof:     ExportRemoteProof(l.link),
		TrackDiff: ExportTrackDiff(l.diff),
	}
}

func (l LinkCheckResult) Export() keybase_1.LinkCheckResult {
	ret := keybase_1.LinkCheckResult{
		ProofId:     l.position,
		ProofStatus: ExportProofError(l.err),
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

func (cr CheckResult) Export() *keybase_1.CheckResult {
	return &keybase_1.CheckResult{
		ProofStatus:   ExportProofError(cr.Status),
		Timestamp:     int(cr.Time.Unix()),
		DisplayMarkup: cr.ToDisplayString(),
	}
}

func ExportRemoteProof(p RemoteProofChainLink) keybase_1.RemoteProof {
	k, v := p.ToKeyValuePair()
	return keybase_1.RemoteProof{
		ProofType:     p.GetIntType(),
		Key:           k,
		Value:         v,
		DisplayMarkup: v,
		SigId:         keybase_1.SIGID(p.GetSigId()),
		Mtime:         int(p.GetCTime().Unix()),
	}
}

type ByMtime []keybase_1.IdentifyRow

func (x ByMtime) Len() int {
	return len(x)
}

func (x ByMtime) Less(a, b int) bool {
	return x[a].Proof.Mtime < x[b].Proof.Mtime
}

func (x ByMtime) Swap(a, b int) {
	x[a], x[b] = x[b], x[a]
}

func (ir IdentifyOutcome) ExportToUncheckedIdentity() *keybase_1.Identity {
	tmp := keybase_1.Identity{
		Status: ExportErrorAsStatus(ir.Error),
	}
	if ir.TrackUsed != nil {
		tmp.WhenLastTracked = int(ir.TrackUsed.GetCTime().Unix())
	}
	tmp.Proofs = make([]keybase_1.IdentifyRow, len(ir.ProofChecks))
	for j, p := range ir.ProofChecks {
		tmp.Proofs[j] = p.ExportToIdentifyRow(j)
	}
	sort.Sort(ByMtime(tmp.Proofs))
	tmp.Deleted = make([]keybase_1.TrackDiff, len(ir.Deleted))
	for j, d := range ir.Deleted {
		// Should have all non-nil elements...
		tmp.Deleted[j] = *ExportTrackDiff(d)
	}
	return &tmp
}

type ExportableError interface {
	error
	ToStatus() keybase_1.Status
}

func ExportProofError(pe ProofError) (ret keybase_1.ProofStatus) {
	if pe == nil {
		ret.State = PROOF_STATE_OK
		ret.Status = PROOF_OK
	} else {
		ret.Status = int(pe.GetStatus())
		ret.State = ProofErrorToState(pe)
		ret.Desc = pe.GetDesc()
	}
	return
}

func ImportProofError(e keybase_1.ProofStatus) ProofError {
	ps := ProofStatus(e.Status)
	if ps == PROOF_STATE_OK {
		return nil
	}
	return NewProofError(ps, e.Desc)
}

func ExportErrorAsStatus(e error) (ret *keybase_1.Status) {
	if e == nil {
	} else if ee, ok := e.(ExportableError); ok {
		tmp := ee.ToStatus()
		ret = &tmp
	} else {
		ret = &keybase_1.Status{
			Name: "GENERIC",
			Code: SC_GENERIC,
			Desc: e.Error(),
		}
	}
	return
}

//=============================================================================

func WrapError(e error) interface{} {
	return ExportErrorAsStatus(e)
}

func UnwrapError(nxt rpc2.DecodeNext) (app error, dispatch error) {
	var s *keybase_1.Status
	if dispatch = nxt(&s); dispatch == nil {
		app = ImportStatusAsError(s)
	}
	return
}

//=============================================================================

func ImportStatusAsError(s *keybase_1.Status) error {
	if s == nil {
		return nil
	} else {
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
			return CanceledError{}
		case SC_KEY_IN_USE:
			var fp *PgpFingerprint
			if len(s.Desc) > 0 {
				fp, _ = PgpFingerprintFromHex(s.Desc)
			}
			return KeyExistsError{fp}
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
}

//=============================================================================

func (a AppStatusError) ToStatus() keybase_1.Status {
	var fields []keybase_1.StringKVPair
	for k, v := range a.Fields {
		fields = append(fields, keybase_1.StringKVPair{Key: k, Value: v})
	}

	return keybase_1.Status{
		Code:   a.Code,
		Name:   a.Name,
		Desc:   a.Desc,
		Fields: fields,
	}
}

//=============================================================================

func ExportTrackDiff(d TrackDiff) (res *keybase_1.TrackDiff) {
	if d != nil {
		res = &keybase_1.TrackDiff{
			Type:          keybase_1.TrackDiffType(d.GetTrackDiffType()),
			DisplayMarkup: d.ToDisplayString(),
		}
	}
	return
}

//=============================================================================

func ImportPgpFingerprint(f keybase_1.FOKID) (ret *PgpFingerprint) {
	if f.PgpFingerprint != nil && len(*f.PgpFingerprint) == PGP_FINGERPRINT_LEN {
		var tmp PgpFingerprint
		copy(tmp[:], (*f.PgpFingerprint)[:])
		ret = &tmp
	}
	return
}

func (f *PgpFingerprint) ExportToFOKID() (ret keybase_1.FOKID) {
	slc := (*f)[:]
	ret.PgpFingerprint = &slc
	return
}

//=============================================================================

func (f *FOKID) Export() (ret keybase_1.FOKID) {
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

func (s TrackSummary) Export() (ret keybase_1.TrackSummary) {
	ret.Time = int(s.time.Unix())
	ret.IsRemote = s.isRemote
	return
}

func ImportTrackSummary(s *keybase_1.TrackSummary) *TrackSummary {
	if s == nil {
		return nil
	}

	return &TrackSummary{
		time:     time.Unix(int64(s.Time), 0),
		isRemote: s.IsRemote,
	}
}

func ExportTrackSummary(l *TrackLookup) *keybase_1.TrackSummary {
	if l == nil {
		return nil
	}

	tmp := l.ToSummary().Export()
	return &tmp
}

//=============================================================================

func (ir *IdentifyOutcome) Export() *keybase_1.IdentifyOutcome {
	v := make([]string, len(ir.Warnings))
	for i, w := range ir.Warnings {
		v[i] = w.Warning()
	}
	del := make([]keybase_1.TrackDiff, 0, len(ir.Deleted))
	for i, d := range ir.Deleted {
		del[i] = *ExportTrackDiff(d)
	}
	ret := &keybase_1.IdentifyOutcome{
		Status:            ExportErrorAsStatus(ir.Error),
		Warnings:          v,
		TrackUsed:         ExportTrackSummary(ir.TrackUsed),
		NumTrackFailures:  ir.NumTrackFailures(),
		NumTrackChanges:   ir.NumTrackChanges(),
		NumProofFailures:  ir.NumProofFailures(),
		NumDeleted:        ir.NumDeleted(),
		NumProofSuccesses: ir.NumProofSuccesses(),
		Deleted:           del,
	}
	return ret
}

//=============================================================================

func DisplayTrackArg(sessionID int, stmt string) *keybase_1.DisplayTrackStatementArg {
	return &keybase_1.DisplayTrackStatementArg{
		SessionID: sessionID,
		Stmt:      stmt,
	}
}

//=============================================================================

func ImportFinishAndPromptRes(f keybase_1.FinishAndPromptRes) (ti TrackInstructions) {
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

func (c CryptocurrencyChainLink) Export() (ret keybase_1.Cryptocurrency) {
	ret.Pkhash = c.pkhash
	ret.Address = c.address
	return
}

//=============================================================================

func (c CurrentStatus) Export() (ret keybase_1.GetCurrentStatusRes) {
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

func (p PassphraseError) ToStatus() (s keybase_1.Status) {
	s.Code = SC_BAD_LOGIN_PASSWORD
	s.Name = "BAD_LOGIN_PASSWORD"
	s.Desc = p.msg
	return
}

func (m Markup) Export() (ret keybase_1.Text) {
	ret.Data = m.data
	ret.Markup = true
	return
}

//=============================================================================

func (e LoggedInError) ToStatus() (s keybase_1.Status) {
	s.Code = SC_ALREADY_LOGGED_IN
	s.Name = "ALREADY_LOGGED_IN"
	s.Desc = "Already logged in as a different user"
	return
}

//=============================================================================

func (e KeyGenError) ToStatus() (s keybase_1.Status) {
	s.Code = SC_KEY_BAD_GEN
	s.Name = "KEY_BAD_GEN"
	s.Desc = e.Msg
	return
}

//=============================================================================

func (c CanceledError) ToStatus() (s keybase_1.Status) {
	s.Code = SC_CANCELED
	s.Name = "CANCELED"
	s.Desc = c.m
	return
}

//=============================================================================

func (c KeyExistsError) ToStatus() (s keybase_1.Status) {
	s.Code = SC_KEY_IN_USE
	s.Name = "KEY_IN_USE"
	if c.Key != nil {
		s.Desc = c.Key.String()
	}
	return
}

//=============================================================================

func (ids Identities) Export() (res []keybase_1.PgpIdentity) {
	var n int
	if ids == nil {
		n = 0
	} else {
		n = len(ids)
	}
	res = make([]keybase_1.PgpIdentity, n)
	for i, id := range ids {
		res[i] = id.Export()
	}
	return
}

func ImportPgpIdentities(ids []keybase_1.PgpIdentity) (ret Identities) {
	ret = Identities(make([]Identity, len(ids)))
	for i, id := range ids {
		ret[i] = ImportPgpIdentity(id)
	}
	return
}

//=============================================================================

func (id Identity) Export() (ret keybase_1.PgpIdentity) {
	ret.Username = id.Username
	ret.Email = id.Email
	ret.Comment = id.Comment
	return
}

func ImportPgpIdentity(arg keybase_1.PgpIdentity) (ret Identity) {
	ret.Username = arg.Username
	ret.Email = arg.Email
	ret.Comment = arg.Comment
	return
}

//=============================================================================

func (u *UID) Export() keybase_1.UID {
	return keybase_1.UID(*u)
}

func ImportUID(u keybase_1.UID) UID {
	return UID(u)
}

func (u *User) Export() *keybase_1.User {
	return &keybase_1.User{
		Uid:      keybase_1.UID(u.GetUid()),
		Username: u.GetName(),
		Image:    u.Image,
	}
}

//=============================================================================

func (a PGPGenArg) ExportTo(ret *keybase_1.KeyGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.CreateUids = keybase_1.PgpCreateUids{UseDefault: !a.NoDefPGPUid, Ids: a.Ids.Export()}
	return
}

//=============================================================================

func ImportKeyGenArg(a keybase_1.KeyGenArg) (ret PGPGenArg) {
	ret.PrimaryBits = a.PrimaryBits
	ret.SubkeyBits = a.SubkeyBits
	ret.NoDefPGPUid = !a.CreateUids.UseDefault
	ret.Ids = ImportPgpIdentities(a.CreateUids.Ids)
	return
}

//=============================================================================
