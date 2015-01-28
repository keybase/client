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
	G.Init()
	if err := G.ConfigureAPI(); err != nil {
		t.Fatal(err)
	}
	if err := G.ConfigureConfig(); err != nil {
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
