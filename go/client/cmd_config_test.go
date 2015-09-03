package client

import (
	"io/ioutil"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestLocation(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	var called bool
	c := CmdConfigInfo{}
	c.writer = libkb.NewTestOutput(config.GetConfigFileName()+"\n", t, &called)
	c.Run()
	if !called {
		t.Errorf("Did not output location")
	}
}

func TestReset(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": true }`)
	defer config.CleanTest()

	var called bool
	c := CmdConfigReset{}
	// no output for this test
	c.writer = libkb.NewTestOutput("", t, &called)
	c.Run()

	// Now the file should be empty
	if p, err := ioutil.ReadFile(config.GetConfigFileName()); err == nil {
		s := string(p)
		if s != "{}" {
			t.Errorf("After resetting the file, got contents: %s", s)
		}
	} else {
		t.Fatalf("Couldn't read file %s", config.GetConfigFileName())
	}

	// should be no output
	if called {
		t.Errorf("Did not reset")
	}
}

func checkRead(t *testing.T, key string, expected string) {
	var called bool
	c := CmdConfigGet{}
	c.key = key
	c.writer = libkb.NewTestOutput(expected, t, &called)
	c.Run()
	if !called {
		t.Errorf("Did not read %s", c.key)
	}
}

func TestReadBool(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": true }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: true\n")
}

func TestReadInt(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": 1 }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: 1\n")
}

func TestReadString(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": "blah" }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: blah\n")
}

func TestReadLongPath(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "aaa": { "bbb": { "ccc": "blah" } } }`)
	defer config.CleanTest()

	checkRead(t, "aaa.bbb.ccc", "aaa.bbb.ccc: blah\n")
}

func TestReadNull(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": null }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: null\n")
}

func TestReadEmptyString(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": "" }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: \n")
}

func TestReadMissingVar(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "")
	defer config.CleanTest()

	var called bool
	c := CmdConfigGet{}
	c.key = "a"
	c.writer = libkb.NewTestOutput("", t, &called)
	c.Run()
	if called {
		t.Errorf("Expected nothing, but read %s", c.key)
	}
}

func setAndCheck(t *testing.T, config *libkb.TestConfig, key string, value string,
	checker func(libkb.JSONConfigFile, string)) {
	var called bool
	c := CmdConfigSet{}
	c.key = key
	c.value = value
	// should be no output
	c.writer = libkb.NewTestOutput("", t, &called)
	c.Run()

	// check the file by reading it in
	cf := libkb.NewJSONConfigFile(config.GetConfigFileName())
	if err := cf.Load(false); err != nil {
		t.Fatalf("Couldn't load config file %s", config.GetConfigFileName())
	}
	checker(*cf, key)

	// should be no output
	if called {
		t.Errorf("Did not read %s", c.key)
	}
}

func TestSetBool(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetBoolAtPath(key); !isSet || ret != true {
			t.Errorf("Couldn't read boolean after setting; ret=%t, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a", "true", checker)
}

func TestSetInt(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetIntAtPath(key); !isSet || ret != 1 {
			t.Errorf("Couldn't read int after setting; ret=%d, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a", "1", checker)
}

func TestSetString(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a", "blah", checker)
}

func TestSetStringAtLongPath(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "aaa.bbb.ccc", "blah", checker)
}

func TestSetStringInExisting(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "aaa": { "xxx": "yyy"} }`)
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "aaa.bbb.ccc", "blah", checker)
	// and make sure the existing key is still there
	cf := libkb.NewJSONConfigFile(config.GetConfigFileName())
	if err := cf.Load(false); err != nil {
		t.Fatalf("Couldn't load config file %s", config.GetConfigFileName())
	}
	if ret, isSet := cf.GetStringAtPath("aaa.xxx"); !isSet || ret != "yyy" {
		t.Errorf("Couldn't read old string after setting; ret=%s, isSet=%t",
			ret, isSet)
	}
}

func TestSetStringOverwrite(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": "b" }`)
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a", "blah", checker)
}

func TestSetStringLongOverwrite(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": "b" }`)
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a.c.d", "blah", checker)
}

func TestSetStringShortOverwrite(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "aaa": { "xxx": "yyy"} }`)
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "aaa", "blah", checker)
}

func TestSetNull(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if isSet := cf.GetNullAtPath(key); !isSet {
			t.Errorf("Couldn't read null after setting")
		}
	}

	setAndCheck(t, config, "a", "null", checker)
}

func TestSetEmptyString(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); isSet {
			t.Errorf("Read string after clearing; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a", "", checker)
}

func TestOverwriteNull(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": null }`)
	defer config.CleanTest()

	checker := func(cf libkb.JSONConfigFile, key string) {
		if ret, isSet := cf.GetStringAtPath(key); !isSet || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, isSet=%t",
				ret, isSet)
		}
	}

	setAndCheck(t, config, "a", "blah", checker)
}

func TestClear(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, `{ "a": "b", "c": "d" }`)
	defer config.CleanTest()

	// clear it
	var called bool
	c := CmdConfigSet{}
	c.key = "c"
	// should be no output
	c.writer = libkb.NewTestOutput("", t, &called)
	c.Run()
	if called {
		t.Errorf("Read output for cleared key %s", c.key)
	}

	// make sure it's really done
	fn := config.GetConfigFileName()
	cf := libkb.NewJSONConfigFile(fn)
	if err := cf.Load(false); err != nil {
		t.Fatalf("Couldn't load config file %s", fn)
	}
	if ret, isSet := cf.GetStringAtPath("c"); isSet {
		t.Errorf("Read string after clearing; ret=%s, isSet=%t", ret, isSet)
	}
	// a should still be there
	if ret, isSet := cf.GetStringAtPath("a"); !isSet {
		t.Errorf("Couldn't read string after clearing other string; "+
			"ret=%s, isSet=%t", ret, isSet)
	}
}
