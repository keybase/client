package libkb

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"testing"
	"time"
)

var homedir string

func setup(t *testing.T) {
	os.Setenv("KEYBASE_SERVER_URI", "http://localhost:3000")
	var err error
	homedir, err = ioutil.TempDir(os.TempDir(), "setest")
	if err != nil {
		t.Fatal(err)
	}
	os.Setenv("XDG_CONFIG_HOME", homedir)
	os.Setenv("XDG_CACHE_HOME", homedir)
	os.Setenv("XDG_DATA_HOME", homedir)
	G.Init()
	if err := G.ConfigureAPI(); err != nil {
		t.Fatal(err)
	}
	if err := G.ConfigureConfig(); err != nil {
		t.Fatal(err)
	}
	if err := G.ConfigureCaches(); err != nil {
		t.Fatal(err)
	}
	if err := G.ConfigureMerkleClient(); err != nil {
		t.Fatal(err)
	}
	G.UI = &nullui{}
	if err := G.UI.Configure(); err != nil {
		t.Fatal(err)
	}
	if err := G.ConfigureKeyring(Usage{KbKeyring: true}); err != nil {
		t.Fatal(err)
	}
	rand.Seed(time.Now().UnixNano())
}

func cleanup() {
	if len(homedir) > 0 {
		os.RemoveAll(homedir)
	}
}

func fakeUser(prefix string) (username, email string) {
	n := rand.Intn(100000)
	username = fmt.Sprintf("%s_%d", prefix, n)
	email = fmt.Sprintf("%s@email.com", username)
	return username, email
}

func TestSignupEngine(t *testing.T) {
	setup(t)
	defer cleanup()
	s := NewSignupEngine()
	username, email := fakeUser("se")
	arg := SignupEngineRunArg{username, email, "202020202020202020202020", "passphrase passphrase", "my device"}
	err := s.Run(arg)
	if err != nil {
		t.Fatal(err)
	}
}

// XXX move this somewhere reusable?
type nullui struct{}

func (n *nullui) GetIdentifyUI(username string) IdentifyUI {
	return nil
}
func (n *nullui) GetIdentifySelfUI() IdentifyUI {
	return nil
}
func (n *nullui) GetIdentifyTrackUI(username string, strict bool) IdentifyUI {
	return nil
}
func (n *nullui) GetLoginUI() LoginUI {
	return nil
}
func (n *nullui) GetSecretUI() SecretUI {
	return nil
}
func (n *nullui) GetProveUI() ProveUI {
	return nil
}
func (n *nullui) GetLogUI() LogUI {
	return G.Log
}
func (n *nullui) Prompt(string, bool, Checker) (string, error) {
	return "", nil
}
func (n *nullui) GetIdentifyLubaUI(username string) IdentifyUI {
	return nil
}
func (n *nullui) Configure() error {
	return nil
}
func (n *nullui) Shutdown() error {
	return nil
}
