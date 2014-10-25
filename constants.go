package libkb

import (
	"os"
	"runtime"
)

var SERVER_URL = "https://api.keybase.io:443"
var CONFIG_FILE = "config.json"
var SESSION_FILE = "session.json"
var DB_FILE = "keybase.leveldb"
var API_VERSION = "1.0"
var API_URI_PATH_PREFIX = "/_/api/" + API_VERSION
var CLIENT_VERSION = "1.0.0"

var IDENTIFY_AS = "keybase.io go client v" + CLIENT_VERSION + " " + runtime.GOOS
var USER_AGENT = ("Keybase-CLI/" + CLIENT_VERSION +
	" (" + runtime.Version() + " on " + runtime.GOOS + ")")

var PERM_FILE os.FileMode = 0600
var PERM_DIR os.FileMode = 0700

var USER_CACHE_SIZE = 0x1000
var PROOF_CACHE_SIZE = 0x10000
var PGP_FINGERPRINT_HEX_LEN = 40

var SIG_SHORT_ID_BYTES = 27

var MERKLE_PROD_KEY = "03E146CDAF8136680AD566912A32340CEC8C9492"
var MERKLE_TEST_KEY = "A05161510EE696601BA0EC7B3FD53B4871528CEF"

const (
	MERKLE_TREE_NODE = 1
	MERKLE_TREE_LEAF = 2
)
