package main

/*
import (
	"github.com/keybase/go/libkb"
	"io/ioutil"
	"testing"
)

func TestLocation(t *testing.T) {
	config := &libkb.TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	var called bool
	c := CmdConfig{}
	c.location = true
	c.writer = libkb.TestOutput{config.configFileName + "\n", t, &called}
	c.Run()
	if !called {
		t.Errorf("Did not read %s", c.key)
	}
}

func TestReset(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": true }`)
	defer config.CleanTest()

	var called bool
	c := CmdConfig{}
	c.reset = true
	// no output for this test
	c.writer = TestOutput{"", t, &called}
	c.Run()

	// Now the file should be empty
	if p, err := ioutil.ReadFile(config.configFileName); err == nil {
		s := string(p)
		if s != "{}" {
			t.Errorf("After resetting the file, got contents: %s", s)
		}
	} else {
		t.Fatalf("Couldn't read file %s", config.configFileName)
	}

	// should be no output
	if called {
		t.Errorf("Did not read %s", c.key)
	}
}

func checkRead(t *testing.T, key string, expected string) {
	var called bool
	c := CmdConfig{}
	c.key = key
	c.writer = TestOutput{expected, t, &called}
	c.Run()
	if !called {
		t.Errorf("Did not read %s", c.key)
	}
}

func TestReadBool(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": true }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: true\n")
}

func TestReadInt(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": 1 }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: 1\n")
}

func TestReadString(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": "blah" }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: blah\n")
}

func TestReadLongPath(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "aaa": { "bbb": { "ccc": "blah" } } }`)
	defer config.CleanTest()

	checkRead(t, "aaa.bbb.ccc", "aaa.bbb.ccc: blah\n")
}

func TestReadNull(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": null }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: null\n")
}

func TestReadEmptyString(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": "" }`)
	defer config.CleanTest()

	checkRead(t, "a", "a: \n")
}

func TestReadMissingVar(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "")
	defer config.CleanTest()

	var called bool
	c := CmdConfig{}
	c.key = "a"
	c.writer = TestOutput{"", t, &called}
	c.Run()
	if called {
		t.Errorf("Expected nothing, but read %s", c.key)
	}
}

func setAndCheck(t *testing.T, config *TestConfig, key string, value string,
	checker func(JsonConfigFile, string)) {
	var called bool
	c := CmdConfig{}
	c.key = key
	c.value = value
	c.valueSet = true
	// should be no output
	c.writer = TestOutput{"", t, &called}
	c.Run()

	// check the file by reading it in
	cf := NewJsonConfigFile(config.configFileName)
	if err := cf.Load(false); err != nil {
		t.Fatalf("Couldn't load config file %s", config.configFileName)
	}
	checker(*cf, key)

	// should be no output
	if called {
		t.Errorf("Did not read %s", c.key)
	}
}

func TestSetBool(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetBoolAtPath(key); !is_set || ret != true {
			t.Errorf("Couldn't read boolean after setting; ret=%t, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a", "true", checker)
}

func TestSetInt(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetIntAtPath(key); !is_set || ret != 1 {
			t.Errorf("Couldn't read int after setting; ret=%d, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a", "1", checker)
}

func TestSetString(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a", "blah", checker)
}

func TestSetStringAtLongPath(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "aaa.bbb.ccc", "blah", checker)
}

func TestSetStringInExisting(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "aaa": { "xxx": "yyy"} }`)
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "aaa.bbb.ccc", "blah", checker)
	// and make sure the existing key is still there
	cf := NewJsonConfigFile(config.configFileName)
	if err := cf.Load(false); err != nil {
		t.Fatalf("Couldn't load config file %s", config.configFileName)
	}
	if ret, is_set := cf.GetStringAtPath("aaa.xxx"); !is_set || ret != "yyy" {
		t.Errorf("Couldn't read old string after setting; ret=%s, is_set=%t",
			ret, is_set)
	}
}

func TestSetStringOverwrite(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": "b" }`)
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a", "blah", checker)
}

func TestSetStringLongOverwrite(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": "b" }`)
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a.c.d", "blah", checker)
}

func TestSetStringShortOverwrite(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "aaa": { "xxx": "yyy"} }`)
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "aaa", "blah", checker)
}

func TestSetNull(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if is_set := cf.GetNullAtPath(key); !is_set {
			t.Errorf("Couldn't read null after setting")
		}
	}

	setAndCheck(t, config, "a", "null", checker)
}

func TestSetEmptyString(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, "{}")
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a", "", checker)
}

func TestOverwriteNull(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": null }`)
	defer config.CleanTest()

	checker := func(cf JsonConfigFile, key string) {
		if ret, is_set := cf.GetStringAtPath(key); !is_set || ret != "blah" {
			t.Errorf("Couldn't read string after setting; ret=%s, is_set=%t",
				ret, is_set)
		}
	}

	setAndCheck(t, config, "a", "blah", checker)
}

func TestClear(t *testing.T) {
	config := &TestConfig{}
	config.InitTest(t, `{ "a": "b", "c": "d" }`)
	defer config.CleanTest()

	// clear it
	var called bool
	c := CmdConfig{}
	c.clear = true
	c.key = "c"
	// should be no output
	c.writer = TestOutput{"", t, &called}
	c.Run()
	if called {
		t.Errorf("Read output for cleared key %s", c.key)
	}

	// make sure it's really done
	cf := NewJsonConfigFile(config.configFileName)
	if err := cf.Load(false); err != nil {
		t.Fatalf("Couldn't load config file %s", config.configFileName)
	}
	if ret, is_set := cf.GetStringAtPath("c"); is_set {
		t.Errorf("Read string after clearing; ret=%s, is_set=%t", ret, is_set)
	}
	// a should still be there
	if ret, is_set := cf.GetStringAtPath("a"); !is_set {
		t.Errorf("Couldn't read string after clearing other string; "+
			"ret=%s, is_set=%t", ret, is_set)
	}
}
*/
