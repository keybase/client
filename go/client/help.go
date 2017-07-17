// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
)

func GetHelpTopics() []cli.HelpTopic {
	return []cli.HelpTopic{
		advancedHT,
		gpgHT,
		keyringHT,
		torHT,
	}
}

var advancedHT = cli.HelpTopic{
	Name:  "advanced",
	Usage: "Description of advanced global options",
	Body: `Keybase commands can run with various command line flags to configure global
options. To use, add the flags before the command name:

   {{ .Name }} [global options] command [command options]

GLOBAL OPTIONS:
   {{range .Flags}}{{ . }}
   {{end}}
	`,
}

var gpgHT = cli.HelpTopic{
	Name:  "gpg",
	Usage: "Description of how keybase interacts with GPG",
	Body: `Keybase + GnuPG

The Keybase client makes selective use of a local installation
of GnuPG (gpg) if it can find one. We realize that access to local gpg is
sensitive, so we try to tread lightly and only access the local gpg keyrings
in a few special cases.

On Device Provisioning - If you've previously set up a keybase account and host
  your secret key via gpg locally, the keybase app will need a signature signed with
  that key to delegate authority to a new local device key. That device key will then
  do all of the non-PGP work for this machine going forward (e.g., signing follower
  statements, provisioning new devices, etc.)

On signup - When you signup, you can also "select" a PGP key for use with keybase
  from your local GPG keyring. See "keybase pgp select" below.

'keybase pgp gen' - Running "gen" will generate a new PGP key via the Go libraries.
  keybase will save the secret key locally, and will push the public half to the
  server, after it's been signed and provisioned with your local device key.
  Additionally, this command will export the secret and public keys to your local
  GPG keyring.

'keybase pgp pull' - All PGP keys pulled as a result of 'keybase pgp pull' are
  exported as public keys to your local gpg keyring.

'keybase pgp update' - Public PGP keys are exported from your local GPG keyring and
  sent to the keybase server, where they will supersede PGP keys that have been
  previously updated. This feature is for updating PGP subkeys, identities, and
  signatures, but cannot be used to change PGP primary keys.

'keybase pgp select' - Pull a PGP key out of your GPG keyring, and "select" it
  for use on keybase. This will: (1) sign it into your signature chain with your
  local device key; (2) push this signature and the public PGP key half to the
  server; (3) copy a version of secret key to your local keybase keychain;
  and (4) encrypt this copy with your keybase passphrase via local-key security
  (see "keybase help keyring"). Keybase takes steps (3) and (4) so that subsequent
  PGP operations (like sign and decrypt) don't need to access your GPG keyring again.
  Once running this command, you wind up in state similar to that following
  "keybase pgp gen" above. The difference is that you've used gpg to generate
  the key rather than keybase.

'keybase pgp sign/encrypt/verify/decrypt' - These commands don't access your local
  GPG keyring, they only access the local keybase keyring as described in "select".

'keybase pgp import' - Doesn't access the GPG keyring at all, only works with
  keys passed in via standard input or files. A secret key is required for this
  operation, since a signature for the key is needed in the import process.

'keybase pgp export' - Doesn't access the GPG keyring at all, just outputs
  your currently provisioned PGP keys to standard output (or a file).

'keybase pgp drop' - Disassociates this PGP key from your account, but doesn't
  access the GPG keyring, and doesn't perform a traditional PGP revocation.
`,
}

var keyringHT = cli.HelpTopic{
	Name:  "keyring",
	Usage: "Description of how keybase stores secret keys locally",
	Body: `Keybase's Local Keyring

Keybase keeps a local per-user keyring to store secret keys. Keyrings can
be found:

   * On Linux: $XDG_CONFIG_HOME/.config/keybase/secretkeys.$USER.mpack
   * On OSX: $HOME/Library/Application\ Support/Keybase/secretkeys.$USER.mpack

Secret keys are packed in the Msgpack format, and are then Base64-encoded.
The input object is an array of objects, each containing a secret key
along with associated metadata.

Secret keys are locally encrypted using Keybase's "Local Key Security" (LKS)
system. In LKS, the symmetric secret key is an XOR of: (1) bytes [288:320] of
the scrypt of the user's passphrase; and (2) a random 32-byte mask synced with
the Keybase remote server (the "server mask"). This secret key is then used as
the symmetric secret key in NaCl's SecretBox function, which is then used to
encrypt locally stored asymmetric secret keys.

The three types of keys currently stored in Keybase's keyring are: (1) per-device
EdDSA keys; (2) per-device Curve25519 DH keys; and (3) any PGP private keys
that are "selected", "imported" or "generated" into Keybase (see "keybase help gpg").
Keys of the first two varieties never leave the device. Keys of the third variety
can leave the device if the user explicitly requests a passphrase-encrypted
synchronization with the Keybase server. All three varieties of keys are protected
with LKS encryption as described above.

When a user on OSX clicks "remember my passphrase" in a dialog box, the
symmetric LKS secret key is written to the OS keychain. The encrypted asymmetric
secret key stays locally stored on the file system, and is never moved into the
OS's keychain.

Keybase has a passphrase update protocol: if a passphrase is changed
on any device, the service mask described above is changed accordingly, so that
the user can immediately use her new passphrase across all devices. However,
the server cannot decrypt an LKS-protected secret key unless it also
has access to the user's passphrase (or can crack it). More details
are available on keybase.io in the docs section.
`,
}

var torHT = cli.HelpTopic{
	Name:  "tor",
	Usage: "Description of how keybase works with Tor",
	Body: `Keybase + Tor

Using the --tor-mode flag, you can enable either "strict" mode or "leaky" mode.

In either mode, we print warnings any time you identify another user with HTTP
or DNS proofs, because your Tor exit node will be able to spoof these.

In leaky mode, all server requests are made over Tor to the Keybase onion URL
(http://fncuwbiisyh6ak3i.onion), but the client still sends your session ID and
other authentication info as part of its requests. Features that require you to
be logged in, like "keybase prove", still work as usual.

In strict mode, the client tries to avoid identifying you even to the Keybase
server. We strip all headers from API requests. Any commands that require
authentication will fail.

As usual with anonymity tools, there is a big list of caveats and warnings that
apply. Our strict mode isn't audited, so it's possible that identifying
information will creep in. A better guarantee would be to run the client inside
of a Tails VM (https://tails.boum.org), with no identifying information
available to the client at all. Even still, it's possible for your own behavior
to identify you, like if you fetch the PGP keys of all of your friends.
`,
}

// Custom help templates for cli package

func init() {
	cli.AppHelpTemplate = AppHelpTemplate
	cli.CommandHelpTemplate = CommandHelpTemplate
	cli.SubcommandHelpTemplate = SubcommandHelpTemplate
}

// AppHelpTemplate is used for `keybase help` or `keybase -h`.
var AppHelpTemplate = `NAME:
   {{.Name}} - {{.Usage}}

USAGE:
   {{.Name}} {{if .Flags}}[global options]{{end}}{{if .Commands}} command [command options]{{end}} [arguments...]
   {{if .Version}}
VERSION:
   {{.Version}}
   {{end}}{{if .Commands}}
COMMANDS:
{{range .Commands}}{{ if .Usage }}   {{join .Names ", "}}{{ "\t" }}{{.Usage}}{{ "\n" }}{{ end }}{{end}}{{end}}{{if .HelpTopics}}
ADDITIONAL HELP TOPICS:
   {{range .HelpTopics}}{{.Name}}{{ "\t\t" }}{{.Usage}}
   {{end}}{{end}}{{if .Copyright }}
COPYRIGHT:
   {{.Copyright}}
   {{end}}
`

// CommandHelpTemplate is used for `keybase help cmd` or
// `keybase cmd help subcmd`.
var CommandHelpTemplate = `NAME:
   keybase {{.FullName}} - {{.Usage}}

USAGE:
   keybase {{.FullName}}{{ if .Subcommands }} <command>{{ end }}{{if .Flags}} [command options]{{end}} {{ .ArgumentHelp }}{{if .Description}}

DESCRIPTION:
   {{.Description}}{{end}}{{ if .Subcommands }}

COMMANDS:
   {{range .Subcommands}}{{if .Usage }}{{join .Names ", "}}{{ "\t" }}{{.Usage}}{{ end }}
   {{end}}{{end}}{{if .Flags}}

OPTIONS:
   {{range .Flags}}{{.}}
   {{end}}{{ end }}
`

// SubcommandHelpTemplate is used for `keybase cmd` with no
// other arguments when `cmd` has subcommands.
// Or for `keybase cmd help` when `cmd` has subcommands.
var SubcommandHelpTemplate = `NAME:
   {{.Name}} - {{.Usage}}

USAGE:
   {{.Name}} <command> [arguments...]

COMMANDS:
   {{range .Commands}}{{join .Names ", "}}{{ "\t" }}{{.Usage}}
   {{end}}
`
