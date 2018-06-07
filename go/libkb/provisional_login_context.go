package libkb

import (
	"encoding/hex"
	"errors"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ProvisionalLoginContext struct {
	MetaContextified
	username     NormalizedUsername
	uid          keybase1.UID
	salt         []byte
	streamCache  *PassphraseStreamCache
	localSession *Session
	loginSession *LoginSession
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

func newProvisionalLoginContextWithUIDAndUsername(m MetaContext, uid keybase1.UID, un NormalizedUsername) *ProvisionalLoginContext {
	ret := newProvisionalLoginContext(m)
	ret.uid = uid
	ret.username = un
	return ret
}

func (p *ProvisionalLoginContext) Dump(m MetaContext, prefix string) {
	m.CDebugf("%sUsername: %s", prefix, p.username)
	m.CDebugf("%sUID: %s", prefix, p.uid)
	if p.salt != nil {
		m.CDebugf("%sSalt: %s", prefix, hex.EncodeToString(p.salt))
	}
	m.CDebugf("%sPassphraseCache: %v", prefix, (p.streamCache != nil))
	m.CDebugf("%sLocalSession: %v", prefix, (p.localSession != nil))
	m.CDebugf("%sLoginSession: %v", prefix, (p.loginSession != nil))
}

func (p *ProvisionalLoginContext) LoggedInLoad() (bool, error) {
	if p.localSession != nil {
		return p.localSession.IsLoggedIn(), nil
	}
	return false, nil
}
func (p *ProvisionalLoginContext) CreateStreamCache(tsec Triplesec, pps *PassphraseStream) {
	p.streamCache = NewPassphraseStreamCache(tsec, pps)
}
func (p *ProvisionalLoginContext) SetStreamCache(c *PassphraseStreamCache) {
	p.streamCache = c
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
	if p.PassphraseStreamCache() == nil {
		return nil
	}
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
func (p *ProvisionalLoginContext) LoadLoginSession(username string) error {
	nun := NewNormalizedUsername(username)
	if !p.username.Eq(nun) {
		return LoggedInWrongUserError{p.username, nun}
	}
	if p.loginSession == nil {
		return LoginSessionNotFound{}
	}
	return nil
}
func (p *ProvisionalLoginContext) LoginSession() *LoginSession {
	return p.loginSession
}
func (p *ProvisionalLoginContext) SetLoginSession(l *LoginSession) {
	p.loginSession = l
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

func (p *ProvisionalLoginContext) SetUsernameUID(username NormalizedUsername, uid keybase1.UID) error {
	if err := p.assertNotReused(username, uid); err != nil {
		return err
	}
	p.username = username
	p.uid = uid
	return nil
}

func (p *ProvisionalLoginContext) assertNotReused(un NormalizedUsername, uid keybase1.UID) error {
	if !(p.uid.IsNil() || p.uid.Equal(uid)) || !(p.username.IsNil() || p.username.Eq(un)) {
		return errors.New("can't reuse a ProvisionalLoginContext!")
	}
	return nil
}

func (p *ProvisionalLoginContext) SaveState(sessionID, csrf string, username NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) (err error) {
	defer p.M().CTrace("ProvisionalLoginContext#SaveState", func() error { return err })()
	if err := p.assertNotReused(username, uid); err != nil {
		return err
	}
	p.uid = uid
	p.username = username
	return p.localSession.SetLoggedIn(sessionID, csrf, username, uid, deviceID)
}

func (p *ProvisionalLoginContext) Keyring(m MetaContext) (ret *SKBKeyringFile, err error) {
	defer m.CTrace("ProvisionalLoginContext#Keyring", func() error { return err })()
	if p.skbKeyring != nil {
		return p.skbKeyring, nil
	}
	if p.username.IsNil() {
		p.M().CInfof("ProvisionalLoginContext#Keyring: no username set")
		return nil, NewNoUsernameError()
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
func (p *ProvisionalLoginContext) SecretSyncer() *SecretSyncer {
	return p.secretSyncer
}
func (p *ProvisionalLoginContext) RunSecretSyncer(m MetaContext, uid keybase1.UID) error {
	if uid.IsNil() {
		uid = p.GetUID()
	}
	return RunSyncer(m, p.secretSyncer, uid, (p.localSession != nil), p.localSession)
}
func (p *ProvisionalLoginContext) GetUnlockedPaperEncKey() GenericKey {
	return nil
}
func (p *ProvisionalLoginContext) GetUnlockedPaperSigKey() GenericKey {
	return nil
}
func (p *ProvisionalLoginContext) Salt() []byte {
	if len(p.salt) > 0 {
		return p.salt
	}
	if p.loginSession == nil {
		return nil
	}
	return p.loginSession.salt
}
