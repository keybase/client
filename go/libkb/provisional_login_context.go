package libkb

import (
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type ProvisionalLoginContext struct {
	MetaContextified
	username     NormalizedUsername
	uid          keybase1.UID
	salt         []byte
	streamCache  *PassphraseStreamCache
	localSession *Session
	skbKeyring   *SKBKeyringFile
	secretSyncer *SecretSyncer
}

var _ LoginContext = (*ProvisionalLoginContext)(nil)

func newProvisionalLoginContext(m MetaContext) *ProvisionalLoginContext {
	return &ProvisionalLoginContext{
		MetaContextified: NewMetaContextified(m),
		localSession:     newSession(m.G()),
		secretSyncer:     NewSecretSyncer(m.G()),
	}
}

func plcErr(s string) error {
	return fmt.Errorf("ProvisionalLoginContext#%s not implemented", s)
}

func (p *ProvisionalLoginContext) LoggedInLoad() (bool, error) {
	return false, plcErr("LoggedInLoad")
}
func (p *ProvisionalLoginContext) LoggedInProvisioned(context.Context) (bool, error) {
	return false, plcErr("LoggedInProvisioned")

}
func (p *ProvisionalLoginContext) Logout() error {
	return plcErr("Logout")
}
func (p *ProvisionalLoginContext) CreateStreamCache(tsec Triplesec, pps *PassphraseStream) {
	p.streamCache = NewPassphraseStreamCache(tsec, pps)
}

func (p *ProvisionalLoginContext) CreateStreamCacheViaStretch(passphrase string) error {
	return plcErr("CreateStreamCacheViaStretch")
}
func (p *ProvisionalLoginContext) PassphraseStreamCache() *PassphraseStreamCache {
	return p.streamCache
}
func (p *ProvisionalLoginContext) ClearStreamCache() {
	if p.streamCache != nil {
		p.streamCache.Clear()
	}
}
func (p *ProvisionalLoginContext) SetStreamGeneration(gen PassphraseGeneration, nilPPStreamOK bool) {
	found := p.PassphraseStreamCache().MutatePassphraseStream(func(ps *PassphraseStream) {
		ps.SetGeneration(gen)
	})
	if !found && !nilPPStreamOK {
		p.M().CWarningf("Passphrase stream was nil; unexpected")
	}
}
func (p *ProvisionalLoginContext) PassphraseStream() *PassphraseStream {
	return p.PassphraseStreamCache().PassphraseStream()
}
func (p *ProvisionalLoginContext) GetStreamGeneration() (ret PassphraseGeneration) {
	if ps := p.PassphraseStream(); ps != nil {
		ret = ps.Generation()
	}
	return ret
}
func (p *ProvisionalLoginContext) CreateLoginSessionWithSalt(emailOrUsername string, salt []byte) error {
	if salt != nil {
		p.salt = append([]byte{}, salt...)
	}
	return nil
}
func (p *ProvisionalLoginContext) LoadLoginSession(emailOrUsername string) error {
	return plcErr("LoadLoginSession")
}
func (p *ProvisionalLoginContext) LoginSession() *LoginSession {
	return nil
}
func (p *ProvisionalLoginContext) ClearLoginSession() {
}
func (p *ProvisionalLoginContext) LocalSession() *Session {
	return p.localSession.Clone()
}
func (p *ProvisionalLoginContext) GetUID() keybase1.UID {
	return p.uid
}
func (p *ProvisionalLoginContext) GetUsername() NormalizedUsername {
	return p.username
}
func (p *ProvisionalLoginContext) EnsureUsername(username NormalizedUsername) {
}

func (p *ProvisionalLoginContext) SaveState(sessionID, csrf string, username NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) error {

	if wasSaved := !p.uid.IsNil(); wasSaved {
		return errors.New("can't reuse a ProvisionalLoginContext!")
	}
	p.uid = uid
	p.username = username
	return p.localSession.SetLoggedIn(sessionID, csrf, username, uid, deviceID)
}

func (p *ProvisionalLoginContext) Keyring() (ret *SKBKeyringFile, err error) {
	if p.skbKeyring != nil {
		return p.skbKeyring, nil
	}
	if p.username.IsNil() {
		return nil, NoUsernameError{}
	}
	p.M().CDebugf("Account: loading keyring for %s", p.username)
	ret, err = LoadSKBKeyring(p.username, p.M().G())
	if err != nil {
		return nil, err
	}
	p.skbKeyring = ret
	return ret, nil
}
func (p *ProvisionalLoginContext) ClearKeyring() {
	p.skbKeyring = nil
}
func (p *ProvisionalLoginContext) LockedLocalSecretKey(ska SecretKeyArg) (*SKB, error) {
	return nil, plcErr("LockedLocalSecretKey")
}
func (p *ProvisionalLoginContext) SecretSyncer() *SecretSyncer {
	return p.secretSyncer
}
func (p *ProvisionalLoginContext) RunSecretSyncer(uid keybase1.UID) error {
	return RunSyncer(p.secretSyncer, uid, (p.localSession != nil), p.localSession)
}
func (p *ProvisionalLoginContext) SetCachedSecretKey(ska SecretKeyArg, key GenericKey, device *Device) error {
	return plcErr("SetCachedSecretKey")
}
func (p *ProvisionalLoginContext) SetUnlockedPaperKey(sig GenericKey, enc GenericKey) error {
	return plcErr("SetUnlockedPaperKey")
}
func (p *ProvisionalLoginContext) GetUnlockedPaperEncKey() GenericKey {
	return nil
}
func (p *ProvisionalLoginContext) GetUnlockedPaperSigKey() GenericKey {
	return nil
}
