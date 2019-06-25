package libkb

import (
	"encoding/hex"
	"errors"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ProvisionalLoginContext struct {
	MetaContextified
	username     NormalizedUsername
	uv           keybase1.UserVersion
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

func newProvisionalLoginContextWithUserVersionAndUsername(m MetaContext, uv keybase1.UserVersion, un NormalizedUsername) *ProvisionalLoginContext {
	ret := newProvisionalLoginContext(m)
	ret.uv = uv
	ret.username = un
	return ret
}

func (p *ProvisionalLoginContext) Dump(m MetaContext, prefix string) {
	m.Debug("%sUsername: %s", prefix, p.username)
	m.Debug("%sUserVersion: %v", prefix, p.uv)
	if p.salt != nil {
		m.Debug("%sSalt: %s", prefix, hex.EncodeToString(p.salt))
	}
	m.Debug("%sPassphraseCache: %v", prefix, (p.streamCache != nil))
	m.Debug("%sLocalSession: %v", prefix, (p.localSession != nil))
	m.Debug("%sLoginSession: %v", prefix, (p.loginSession != nil))
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
func (p *ProvisionalLoginContext) PassphraseStream() *PassphraseStream {
	if p.PassphraseStreamCache() == nil {
		return nil
	}
	return p.PassphraseStreamCache().PassphraseStream()
}
func (p *ProvisionalLoginContext) CreateLoginSessionWithSalt(emailOrUsername string, salt []byte) error {
	if salt != nil {
		p.salt = append([]byte{}, salt...)
	}
	return nil
}
func (p *ProvisionalLoginContext) LoginSession() *LoginSession {
	return p.loginSession
}
func (p *ProvisionalLoginContext) SetLoginSession(l *LoginSession) {
	p.loginSession = l
}
func (p *ProvisionalLoginContext) LocalSession() *Session {
	return p.localSession.Clone()
}
func (p *ProvisionalLoginContext) GetUID() keybase1.UID {
	return p.uv.Uid
}
func (p *ProvisionalLoginContext) GetUserVersion() keybase1.UserVersion {
	return p.uv
}
func (p *ProvisionalLoginContext) GetUsername() NormalizedUsername {
	return p.username
}

func (p *ProvisionalLoginContext) SetUsernameUserVersion(username NormalizedUsername, uv keybase1.UserVersion) error {
	if err := p.assertNotReused(username, uv); err != nil {
		return err
	}
	p.username = username
	p.uv = uv
	return nil
}

func (p *ProvisionalLoginContext) assertNotReused(un NormalizedUsername, uv keybase1.UserVersion) error {
	if !(p.uv.IsNil() || p.uv.Eq(uv)) || !(p.username.IsNil() || p.username.Eq(un)) {
		return errors.New("can't reuse a ProvisionalLoginContext!")
	}
	return nil
}

func (p *ProvisionalLoginContext) SaveState(sessionID, csrf string, username NormalizedUsername, uv keybase1.UserVersion, deviceID keybase1.DeviceID) (err error) {
	defer p.M().Trace("ProvisionalLoginContext#SaveState", func() error { return err })()
	if err := p.assertNotReused(username, uv); err != nil {
		return err
	}
	p.uv = uv
	p.username = username
	return p.localSession.SetLoggedIn(sessionID, csrf, username, uv.Uid, deviceID)
}

func (p *ProvisionalLoginContext) Keyring(m MetaContext) (ret *SKBKeyringFile, err error) {
	defer m.Trace("ProvisionalLoginContext#Keyring", func() error { return err })()
	if p.skbKeyring != nil {
		return p.skbKeyring, nil
	}
	if p.username.IsNil() {
		p.M().Info("ProvisionalLoginContext#Keyring: no username set")
		return nil, NewNoUsernameError()
	}
	p.M().Debug("Account: loading keyring for %s", p.username)
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
	m = m.WithLoginContext(p)
	return RunSyncer(m, p.secretSyncer, uid, (p.localSession != nil), false /* forceReload */)
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
