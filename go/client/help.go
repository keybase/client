package client

import (
	"github.com/keybase/cli"
)

func GetHelpTopics() []cli.HelpTopic {
	return []cli.HelpTopic{
		advancedHT,
	}
}

var advancedHT = cli.HelpTopic{
	Name:  "advanced",
	Usage: "description of advanced global options",
	Body: `Keybase commands can run with various command line flags to
configure global options.  To use, add the flags before the command name:

   {{ .Name }} [global options] command [command options]

GLOBAL OPTIONS:
   {{range .Flags}}{{ . }}
   {{end}}
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
   {{range .Commands}}{{join .Names ", "}}{{ "\t" }}{{.Usage}}
   {{end}}{{end}}{{if .HelpTopics}}
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
   {{range .Subcommands}}{{join .Names ", "}}{{ "\t" }}{{.Usage}}
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
