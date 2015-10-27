package engine

import (
	"encoding/base64"
	"errors"
	"net/url"
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

// Kex2Provisionee is an engine.
type Kex2Provisionee struct {
	libkb.Contextified
	device       *libkb.Device
	secret       kex2.Secret
	secretCh     chan kex2.Secret
	eddsa        libkb.NaclKeyPair
	dh           libkb.NaclKeyPair
	uid          keybase1.UID
	username     string
	sessionToken keybase1.SessionToken
	csrfToken    keybase1.CsrfToken
	pps          keybase1.PassphraseStream
	lks          *libkb.LKSec
	ctx          *Context
}

// Kex2Provisionee implements kex2.Provisionee, libkb.UserBasic,
// and libkb.SessionReader interfaces.
var _ kex2.Provisionee = (*Kex2Provisionee)(nil)
var _ libkb.UserBasic = (*Kex2Provisionee)(nil)
var _ libkb.SessionReader = (*Kex2Provisionee)(nil)

// NewKex2Provisionee creates a Kex2Provisionee engine.
func NewKex2Provisionee(g *libkb.GlobalContext, device *libkb.Device, secret kex2.Secret) *Kex2Provisionee {
	return &Kex2Provisionee{
		Contextified: libkb.NewContextified(g),
		device:       device,
		secret:       secret,
		secretCh:     make(chan kex2.Secret),
	}
}

// Name is the unique engine name.
func (e *Kex2Provisionee) Name() string {
	return "Kex2Provisionee"
}

// GetPrereqs returns the engine prereqs.
func (e *Kex2Provisionee) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Kex2Provisionee) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisionee) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Kex2Provisionee) Run(ctx *Context) error {
	e.G().Log.Debug("+ Kex2Provisionee.Run()")

	// check device struct:
	if len(e.device.Type) == 0 {
		return errors.New("provisionee device requires Type to be set")
	}
	if e.device.ID.IsNil() {
		return errors.New("provisionee device requires ID to be set")
	}

	// ctx is needed in some of the kex2 functions:
	e.ctx = ctx

	if len(e.secret) == 0 {
		panic("empty secret")
	}

	karg := kex2.KexBaseArg{
		Ctx:           context.TODO(),
		Mr:            libkb.NewKexRouter(e.G()),
		DeviceID:      e.device.ID,
		Secret:        e.secret,
		SecretChannel: e.secretCh,
		Timeout:       5 * time.Minute,
	}
	parg := kex2.ProvisioneeArg{
		KexBaseArg:  karg,
		Provisionee: e,
	}
	err := kex2.RunProvisionee(parg)
	e.G().Log.Debug("- Kex2Provisionee.Run() -> %s", libkb.ErrToOk(err))

	return err
}

// AddSecret inserts a received secret into the provisionee's
// secret channel.
func (e *Kex2Provisionee) AddSecret(s kex2.Secret) {
	e.secretCh <- s
}

// GetLogFactory implements GetLogFactory in kex2.Provisionee.
func (e *Kex2Provisionee) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

// HandleHello implements HandleHello in kex2.Provisionee.
func (e *Kex2Provisionee) HandleHello(harg keybase1.HelloArg) (res keybase1.HelloRes, err error) {
	e.G().Log.Debug("+ HandleHello()")
	defer func() { e.G().Log.Debug("- HandleHello() -> %s", libkb.ErrToOk(err)) }()

	// save parts of the hello arg for later:
	e.uid = harg.Uid
	e.sessionToken = harg.Token
	e.csrfToken = harg.Csrf
	e.pps = harg.Pps

	jw, err := jsonw.Unmarshal([]byte(harg.SigBody))
	if err != nil {
		return res, err
	}

	// need the username later:
	e.username, err = jw.AtPath("body.key.username").GetString()
	if err != nil {
		return res, err
	}

	e.eddsa, err = libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return res, err
	}

	if err = e.addDeviceSibkey(jw); err != nil {
		return res, err
	}

	if err = e.reverseSig(jw); err != nil {
		return res, err
	}

	out, err := jw.Marshal()
	if err != nil {
		return res, err
	}

	return keybase1.HelloRes(out), err
}

// HandleDidCounterSign implements HandleDidCounterSign in
// kex2.Provisionee interface.
func (e *Kex2Provisionee) HandleDidCounterSign(sig []byte) (err error) {
	e.G().Log.Debug("+ HandleDidCounterSign()")
	defer func() { e.G().Log.Debug("- HandleDidCounterSign() -> %s", libkb.ErrToOk(err)) }()

	e.G().Log.Debug("HandleDidCounterSign sig: %s", string(sig))

	// load self user (to load merkle root)
	_, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(e.G(), e.username))
	if err != nil {
		return err
	}

	// decode sig
	decSig, err := e.decodeSig(sig)
	if err != nil {
		return err
	}

	e.dh, err = libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return err
	}

	// make a keyproof for the dh key, signed w/ e.eddsa
	dhSig, dhSigID, err := e.dhKeyProof(e.dh, decSig.eldestKID, decSig.seqno, decSig.linkID)
	if err != nil {
		return err
	}

	// create the key args for eddsa, dh keys
	eddsaArgs, err := makeKeyArgs(decSig.sigID, sig, libkb.SibkeyType, e.eddsa, decSig.eldestKID, decSig.signingKID)
	if err != nil {
		return err
	}
	dhArgs, err := makeKeyArgs(dhSigID, []byte(dhSig), libkb.SubkeyType, e.dh, decSig.eldestKID, e.eddsa.GetKID())
	if err != nil {
		return err
	}

	// logged in, so save the login state
	err = e.saveLoginState()
	if err != nil {
		return err
	}

	// push the LKS server half
	err = e.pushLKSServerHalf()
	if err != nil {
		return err
	}

	// save device and keys locally
	err = e.localSave()
	if err != nil {
		return err
	}

	// post the key sigs to the api server
	err = e.postSigs(eddsaArgs, dhArgs)
	if err != nil {
		return err
	}

	return err
}

type decodedSig struct {
	sigID      keybase1.SigID
	linkID     libkb.LinkID
	seqno      int
	eldestKID  keybase1.KID
	signingKID keybase1.KID
}

func (e *Kex2Provisionee) decodeSig(sig []byte) (*decodedSig, error) {
	body, err := base64.StdEncoding.DecodeString(string(sig))
	if err != nil {
		return nil, err
	}
	packet, err := libkb.DecodePacket(body)
	if err != nil {
		return nil, err
	}
	naclSig, ok := packet.Body.(*libkb.NaclSigInfo)
	if !ok {
		return nil, libkb.UnmarshalError{T: "Nacl signature"}
	}
	jw, err := jsonw.Unmarshal(naclSig.Payload)
	if err != nil {
		return nil, err
	}
	res := decodedSig{
		sigID:  libkb.ComputeSigIDFromSigBody(body),
		linkID: libkb.ComputeLinkID(naclSig.Payload),
	}
	res.seqno, err = jw.AtKey("seqno").GetInt()
	if err != nil {
		return nil, err
	}
	seldestKID, err := jw.AtPath("body.key.eldest_kid").GetString()
	if err != nil {
		return nil, err
	}
	res.eldestKID = keybase1.KIDFromString(seldestKID)
	ssigningKID, err := jw.AtPath("body.key.kid").GetString()
	if err != nil {
		return nil, err
	}
	res.signingKID = keybase1.KIDFromString(ssigningKID)

	return &res, nil
}

// GetName implements libkb.UserBasic interface.
func (e *Kex2Provisionee) GetName() string {
	return e.username
}

// GetUID implements libkb.UserBasic interface.
func (e *Kex2Provisionee) GetUID() keybase1.UID {
	return e.uid
}

// APIArgs implements libkb.SessionReader interface.
func (e *Kex2Provisionee) APIArgs() (token, csrf string) {
	return string(e.sessionToken), string(e.csrfToken)
}

func (e *Kex2Provisionee) addDeviceSibkey(jw *jsonw.Wrapper) error {
	if e.device.Description == nil {
		// need user to get existing device names
		user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(e.G(), e.username))
		if err != nil {
			return err
		}
		existingDevices, err := user.DeviceNames()
		if err != nil {
			e.G().Log.Debug("proceeding despite error getting existing device names: %s", err)
		}

		e.G().Log.Debug("prompting for device name")
		arg := keybase1.PromptNewDeviceNameArg{
			ExistingDevices: existingDevices,
		}
		name, err := e.ctx.ProvisionUI.PromptNewDeviceName(context.TODO(), arg)
		if err != nil {
			return err
		}
		e.device.Description = &name
		e.G().Log.Debug("got device name: %q", name)
	}

	s := libkb.DeviceStatusActive
	e.device.Status = &s
	e.device.Kid = e.eddsa.GetKID()
	dw, err := e.device.Export(libkb.SibkeyType)
	if err != nil {
		return err
	}
	jw.SetValueAtPath("body.device", dw)

	if err = jw.SetValueAtPath("body.sibkey.kid", jsonw.NewString(e.eddsa.GetKID().String())); err != nil {
		return err
	}

	return nil
}

func (e *Kex2Provisionee) reverseSig(jw *jsonw.Wrapper) error {
	// need to set reverse_sig to nil before making reverse sig:
	if err := jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewNil()); err != nil {
		return err
	}

	sig, _, _, err := libkb.SignJSON(jw, e.eddsa)
	if err != nil {
		return err
	}

	// put the signature in reverse_sig
	if err := jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(sig)); err != nil {
		return err
	}

	return nil
}

// postSigs takes the HTTP args for the signing key and encrypt
// key and posts them to the api server.
func (e *Kex2Provisionee) postSigs(signingArgs, encryptArgs *libkb.HTTPArgs) error {
	payload := make(libkb.JSONPayload)
	payload["sigs"] = []map[string]string{firstValues(signingArgs.ToValues()), firstValues(encryptArgs.ToValues())}

	arg := libkb.APIArg{
		Endpoint:     "key/multi",
		NeedSession:  true,
		JSONPayload:  payload,
		SessionR:     e,
		Contextified: libkb.NewContextified(e.G()),
	}

	_, err := e.G().API.PostJSON(arg)
	return err
}

func makeKeyArgs(sigID keybase1.SigID, sig []byte, delType libkb.DelegationType, key libkb.GenericKey, eldestKID, signingKID keybase1.KID) (*libkb.HTTPArgs, error) {
	pub, err := key.Encode()
	if err != nil {
		return nil, err
	}
	args := libkb.HTTPArgs{
		"sig_id_base":     libkb.S{Val: sigID.ToString(false)},
		"sig_id_short":    libkb.S{Val: sigID.ToShortID()},
		"sig":             libkb.S{Val: string(sig)},
		"type":            libkb.S{Val: string(delType)},
		"is_remote_proof": libkb.B{Val: false},
		"public_key":      libkb.S{Val: pub},
		"eldest_kid":      libkb.S{Val: eldestKID.String()},
		"signing_kid":     libkb.S{Val: signingKID.String()},
	}
	return &args, nil
}

func (e *Kex2Provisionee) dhKeyProof(dh libkb.GenericKey, eldestKID keybase1.KID, seqno int, linkID libkb.LinkID) (sig string, sigID keybase1.SigID, err error) {
	delg := libkb.Delegator{
		ExistingKey:    e.eddsa,
		NewKey:         dh,
		DelegationType: libkb.SubkeyType,
		Expire:         libkb.NaclDHExpireIn,
		EldestKID:      eldestKID,
		Device:         e.device,
		LastSeqno:      libkb.Seqno(seqno),
		PrevLinkID:     linkID,
		SigningUser:    e,
		Contextified:   libkb.NewContextified(e.G()),
	}

	jw, err := libkb.KeyProof(delg)
	if err != nil {
		return "", "", err
	}

	e.G().Log.Debug("dh key proof: %s", jw.MarshalPretty())

	dhSig, dhSigID, _, err := libkb.SignJSON(jw, e.eddsa)
	if err != nil {
		return "", "", err
	}

	return dhSig, dhSigID, nil

}

func (e *Kex2Provisionee) pushLKSServerHalf() error {
	// make new lks
	ppstream := libkb.NewPassphraseStream(e.pps.PassphraseStream)
	ppstream.SetGeneration(libkb.PassphraseGeneration(e.pps.Generation))
	e.lks = libkb.NewLKSec(ppstream, e.uid, e.G())
	e.lks.GenerateServerHalf()

	// make client half recovery
	chrKID := e.dh.GetKID()
	chrText, err := e.lks.EncryptClientHalfRecovery(e.dh)
	if err != nil {
		return err
	}

	err = libkb.PostDeviceLKS(e, e.device.ID, e.device.Type, e.lks.GetServerHalf(), e.lks.Generation(), chrText, chrKID)
	if err != nil {
		return err
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	/*
		err = e.G().LoginState().RunSecretSyncer(e.uid)
		if err != nil {
			return err
		}
	*/

	return nil
}

func (e *Kex2Provisionee) localSave() error {
	if err := e.saveConfig(); err != nil {
		return err
	}
	if err := e.saveKeys(); err != nil {
		return err
	}
	return nil
}

func (e *Kex2Provisionee) saveLoginState() error {
	var err error
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		err = a.LoadLoginSession(e.username)
		if err != nil {
			return
		}
		err = a.SaveState(string(e.sessionToken), string(e.csrfToken), libkb.NewNormalizedUsername(e.username), e.uid)
		if err != nil {
			return
		}
	}, "Kex2Provisionee - saveLoginState()")
	if aerr != nil {
		return aerr
	}
	if err != nil {
		return err
	}
	return nil
}

func (e *Kex2Provisionee) saveConfig() error {
	wr := e.G().Env.GetConfigWriter()
	if wr == nil {
		return errors.New("couldn't get config writer")
	}

	if err := wr.SetDeviceID(e.device.ID); err != nil {
		return err
	}

	if err := wr.Write(); err != nil {
		return err
	}

	e.G().Log.Debug("Set Device ID to %s in config file", e.device.ID)
	return nil
}

func (e *Kex2Provisionee) saveKeys() error {
	_, err := libkb.WriteLksSKBToKeyring(e.eddsa, e.lks, nil)
	if err != nil {
		return err
	}
	_, err = libkb.WriteLksSKBToKeyring(e.dh, e.lks, nil)
	if err != nil {
		return err
	}
	return nil
}

func firstValues(vals url.Values) map[string]string {
	res := make(map[string]string)
	for k, v := range vals {
		res[k] = v[0]
	}
	return res
}
