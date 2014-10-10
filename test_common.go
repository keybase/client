package libkb

import (
	"io/ioutil"
	"os"
	"testing"
)

// TestConfig tracks libkb config during a test
type TestConfig struct {
	configFileName string
}

func (c *TestConfig) InitTest(t *testing.T, initConfig string) {
	G.Init()
	var f *os.File
	var err error
	if f, err = ioutil.TempFile("/tmp/", "testconfig"); err != nil {
		t.Fatal("couldn't create temp file: %s", err)
	}
	c.configFileName = f.Name()
	if _, err = f.WriteString(initConfig); err != nil {
		t.Fatal("couldn't write config file: %s", err)
	}
	f.Close()
	// XXX: Using the environment variable is not a great idea if we'll be
	// running tests in parallel, but the global G prevents us from doing that
	// already, so...
	if err = os.Setenv("KEYBASE_CONFIG_FILE", c.configFileName); err != nil {
		t.Fatal("couldn't set env filename: %s", err)
	}

	if err = G.ConfigureConfig(); err != nil {
		t.Fatal("couldn't configure the config: %s", err)
	}
}

func (c *TestConfig) CleanTest() {
	if c.configFileName != "" {
		os.Remove(c.configFileName)
	}
}

// TestOutput is a mock interface for capturing and testing output
type TestOutput struct {
	expected string
	t        *testing.T
	called   *bool
}

func (to TestOutput) Write(p []byte) (n int, err error) {
	output := string(p)
	if to.expected != output {
		to.t.Errorf("Expected output %s, got %s", to.expected, output)
	}
	*to.called = true
	return len(p), nil
}
