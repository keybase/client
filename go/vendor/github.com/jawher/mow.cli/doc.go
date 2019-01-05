/*
Package cli provides a framework to build command line applications in Go with
most of the burden of arguments parsing and validation placed on the framework
instead of the user.



Basics

To create a new application, initialize an app with cli.App. Specify a name and
a brief description for the application:

    cp := cli.App("cp", "Copy files around")

To attach code to execute when the app is launched, assign a function to the
Action field:

    cp.Action = func() {
        fmt.Printf("Hello world\n")
    }

To assign a version to the application, use Version method and specify the flags
that will be used to invoke the version command:

    cp.Version("v version", "cp 1.2.3")

Finally, in the main func, call Run passing in the arguments for parsing:

    cp.Run(os.Args)



Options

To add one or more command line options (also known as flags), use one of the
short-form StringOpt, StringsOpt, IntOpt, IntsOpt, or BoolOpt methods on App (or
Cmd if adding flags to a command or subcommand). For example, to add a boolean
flag to the cp command that specifies recursive mode, use the following:

    recursive := cp.BoolOpt("R recursive", false, "recursively copy the src to dst")

The first argument is a space separated list of names for the option without the
dashes. Generally, both short and long forms are specified, but this is not
mandatory. Additional names (aliases) can be provide if desired, but these are
not shown in the auto-generated help. The second argument is the default value
for the option if it is not supplied by the user. And, the third argument is the
description to be shown in help messages.

There is also a second set of methods on App called String, Strings, Int, Ints,
and Bool, which accept a long-form struct of the type: cli.StringOpt,
cli.StringsOpt, cli.IntOpt, cli.IntsOpt, cli.BoolOpt. The struct describes the
option and allows the use of additional features not available in the short-form
methods described above:

    recursive = cp.Bool(cli.BoolOpt{
        Name:       "R recursive",
        Value:      false,
        Desc:       "copy src files recursively",
        EnvVar:     "VAR_RECURSIVE",
        SetByUser:  &recursiveSetByUser,
    })

Two features, EnvVar and SetByUser, can be defined in the long-form struct
method. EnvVar is a space separated list of environment variables used to
initialize the option if a value is not provided by the user. When help messages
are shown, the value of any environment variables will be displayed. SetByUser
is a pointer to a boolean variable that is set to true if the user specified the
value on the command line. This can be useful to determine if the value of the
option was explicitly set by the user or set via the default value.

The result of both short- and long-forms is a pointer to a value, which will be
populated after the command line arguments are parsed. You can only access the
values stored in the pointers in the Action func, which is invoked after
argument parsing has been completed. This precludes using the value of one
option as the default value of another.

On the command line, the following syntaxes are supported when specifying
options.

Boolean options:

    -f         single dash one letter name
    -f=false   single dash one letter name, equal sign followed by true or false
    --force    double dash for longer option names
    -it        single dash for multiple one letter names (option folding), this is equivalent to: -i -t

String and int options:

    -e=value       single dash one letter name, equal sign, followed by the value
    -e value       single dash one letter name, space followed by the value
    -Ivalue        single dash one letter name, immediately followed by the value
    --extra=value  double dash for longer option names, equal sign followed by the value
    --extra value  double dash for longer option names, space followed by the value

Slice options (StringsOpt, IntsOpt) where option is repeated to accumulate
values in a slice:

    -e PATH:/bin    -e PATH:/usr/bin     resulting slice contains ["/bin", "/usr/bin"]
    -ePATH:/bin     -ePATH:/usr/bin      resulting slice contains ["/bin", "/usr/bin"]
    -e=PATH:/bin    -e=PATH:/usr/bin     resulting slice contains ["/bin", "/usr/bin"]
    --env PATH:/bin --env PATH:/usr/bin  resulting slice contains ["/bin", "/usr/bin"]
    --env=PATH:/bin --env=PATH:/usr/bin  resulting slice contains ["/bin", "/usr/bin"]



Arguments

To add one or more command line arguments (not prefixed by dashes), use one of
the short-form StringArg, StringsArg, IntArg, IntsArg, or BoolArg methods on App
(or Cmd if adding arguments to a command or subcommand). For example, to add two
string arguments to our cp command, use the following calls:

    src := cp.StringArg("SRC", "", "the file to copy")
    dst := cp.StringArg("DST", "", "the destination")

The first argument is the name of the argument as displayed in help messages.
Argument names must be specified as all uppercase.  The second argument is the
default value for the argument if it is not supplied. And the third, argument is
the description to be shown in help messages.

There is also a second set of methods on App called String, Strings, Int, Ints,
and Bool, which accept a long-form struct of the type: cli.StringArg,
cli.StringsArg, cli.IntArg, cli.IntsArg, cli.BoolArg. The struct describes the
arguments and allows the use of additional features not available in the
short-form methods described above:

    src = cp.Strings(StringsArg{
        Name:      "SRC",
        Desc:      "The source files to copy",
        Value:     "default value",
        EnvVar:    "VAR1 VAR2",
        SetByUser: &srcSetByUser,
    })

Two features, EnvVar and SetByUser, can be defined in the long-form struct
method. EnvVar is a space separated list of environment variables used to
initialize the argument if a value is not provided by the user. When help
messages are shown, the value of any environment variables will be displayed.
SetByUser is a pointer to a boolean variable that is set to true if the user
specified the value on the command line. This can be useful to determine if the
value of the argument was explicitly set by the user or set via the default
value.

The result of both short- and long-forms is a pointer to a value which will be
populated after the command line arguments are parsed. You can only access the
values stored in the pointers in the Action func, which is invoked after
argument parsing has been completed. This precludes using the value of one
argument as the default value of another.



Operators

The -- operator marks the end of command line options. Everything that follows
will be treated as an argument, even if starts with a dash.  For example, the
standard POSIX touch command, which takes a filename as an argument (and
possibly other options that we'll ignore here), could be defined as:

    file := cp.StringArg("FILE", "", "the file to create")

If we try to create a file named "-f" via our touch command:

    $ touch -f

It will fail because the -f will be parsed as an option, not as an argument. The
fix is to insert -- after all flags have been specified, so the remaining
arguments are parsed as arguments instead of options as follows:

    $ touch -- -f

This ensures the -f is parsed as an argument instead of a flag named f.



Commands

This package supports nesting of commands and subcommands. Declare a top-level
command by calling the Command func on the top-level App struct. For example,
the following creates an application called docker that will have one command
called run:

    docker := cli.App("docker", "A self-sufficient runtime for linux containers")

    docker.Command("run", "Run a command in a new container", func(cmd *cli.Cmd) {
        // initialize the run command here
    })

The first argument is the name of the command the user will specify on the
command line to invoke this command.  The second argument is the description of
the command shown in help messages.  And, the last argument is a CmdInitializer,
which is a function that receives a pointer to a Cmd struct representing the
command.

Within this function, define the options and arguments for the command by
calling the same methods as you would with top-level App struct (BoolOpt,
StringArg, ...).  To execute code when the command is invoked, assign a function
to the Action field of the Cmd struct. Within that function, you can safely
refer to the options and arguments as command line parsing will be completed at
the time the function is invoked:

    docker.Command("run", "Run a command in a new container", func(cmd *cli.Cmd) {
        var (
            detached = cmd.BoolOpt("d detach", false, "Run container in background")
            memory   = cmd.StringOpt("m memory", "", "Set memory limit")
            image    = cmd.StringArg("IMAGE", "", "The image to run")
        )

        cmd.Action = func() {
            if *detached {
                // do something
            }
            runContainer(*image, *detached, *memory)
        }
    })

Optionally, to provide a more extensive description of the command, assign a
string to LongDesc, which is displayed when a user invokes --help. A LongDesc
can be provided for Cmds as well as the top-level App:

    cmd.LongDesc = `Run a command in a new container

    With the docker run command, an operator can add to or override the
    image defaults set by a developer. And, additionally, operators can
    override nearly all the defaults set by the Docker runtime itself.
    The operator’s ability to override image and Docker runtime defaults
    is why run has more options than any other docker command.`

Subcommands can be added by calling Command on the Cmd struct. They can by
defined to any depth if needed:

    docker.Command("job", "actions on jobs", func(job *cli.Cmd) {
        job.Command("list", "list jobs", listJobs)
        job.Command("start", "start a new job", startJob)
        job.Command("log", "log commands", func(log *cli.Cmd) {
            log.Command("show", "show logs", showLog)
            log.Command("clear", "clear logs", clearLog)
        })
    })

Command and subcommand aliases are also supported. To define one or more
aliases, specify a space-separated list of strings to the first argument of
Command:

    job.Command("start run r", "start a new job", startJob)

With the command structure defined above, users can invoke the app in a variety
of ways:

    $ docker job list
    $ docker job start
    $ docker job run   # using the alias we defined
    $ docker job r     # using the alias we defined
    $ docker job log show
    $ docker job log clear

As a convenience, to assign an Action to a func with no arguments, use
ActionCommand when defining the Command. For example, the following two
statements are equivalent:

    app.Command("list", "list all configs", cli.ActionCommand(list))

    // Exactly the same as above, just more verbose
    app.Command("list", "list all configs", func(cmd *cli.Cmd)) {
        cmd.Action = func() {
            list()
        }
    }

Please note that options, arguments, specs, and long descriptions cannot be
provided when using ActionCommand. This is intended for very simple command
invocations that take no arguments.

Finally, as a side-note, it may seem a bit weird that this package uses a
function to initialize a command instead of simply returning a command struct.
The motivation behind this API decision is scoping: as with the standard flag
package, adding an option or an argument returns a pointer to a value which will
be populated when the app is run.  Since you'll want to store these pointers in
variables, and to avoid having dozens of them in the same scope (the main func
for example or as global variables), this API was specifically tailored to take
a func parameter (called CmdInitializer), which accepts the command struct. With
this design, the command's specific variables are limited in scope to this
function.



Interceptors

Interceptors, or hooks, can be defined to be executed before and after a command
or when any of its subcommands are executed.  For example, the following app
defines multiple commands as well as a global flag which toggles verbosity:

    app := cli.App("app", "bla bla")
    verbose := app.BoolOpt("verbose v", false, "Enable debug logs")

    app.Command("command1", "...", func(cmd *cli.Cmd) {
        if (*verbose) {
            logrus.SetLevel(logrus.DebugLevel)
        }
    })

    app.Command("command2", "...", func(cmd *cli.Cmd) {
        if (*verbose) {
            logrus.SetLevel(logrus.DebugLevel)
        }
    })

Instead of duplicating the check for the verbose flag and setting the debug
level in every command (and its sub-commands), a Before interceptor can be set
on the top-level App instead:

    app.Before = func() {
        if (*verbose) {
            logrus.SetLevel(logrus.DebugLevel)
        }
    }

Whenever a valid command is called by the user, all the Before interceptors
defined on the app and the intermediate commands will be called, in order from
the root to the leaf.

Similarly, to execute a hook after a command has been called, e.g. to cleanup
resources allocated in Before interceptors, simply set the After field of the
App struct or any other Command. After interceptors will be called, in order,
from the leaf up to the root (the opposite order of the Before interceptors).

The following diagram shows when and in which order multiple Before and After
interceptors are executed:

    +------------+    success    +------------+   success   +----------------+     success
    | app.Before +---------------> cmd.Before +-------------> sub_cmd.Before +---------+
    +------------+               +-+----------+             +--+-------------+         |
                                   |                           |                     +-v-------+
                     error         |           error           |                     | sub_cmd |
           +-----------------------+   +-----------------------+                     | Action  |
           |                           |                                             +-+-------+
    +------v-----+               +-----v------+             +----------------+         |
    | app.After  <---------------+ cmd.After  <-------------+  sub_cmd.After <---------+
    +------------+    always     +------------+    always   +----------------+      always



Exiting

To exit the application, use cli.Exit function, which accepts an exit code and
exits the app with the provided code.  It is important to use cli.Exit instead
of os.Exit as the former ensures that all of the After interceptors are executed
before exiting.

    cli.Exit(1)



Spec Strings

An App or Command's invocation syntax can be customized using spec strings. This
can be useful to indicate that an argument is optional or that two options are
mutually exclusive.  The spec string is one of the key differentiators between
this package and other CLI packages as it allows the developer to express usage
in a simple, familiar, yet concise grammar.

To define option and argument usage for the top-level App, assign a spec string
to the App's Spec field:

    cp := cli.App("cp", "Copy files around")
    cp.Spec = "[-R [-H | -L | -P]]"

Likewise, to define option and argument usage for a command or subcommand,
assign a spec string to the Command's Spec field:

    docker := cli.App("docker", "A self-sufficient runtime for linux containers")
    docker.Command("run", "Run a command in a new container", func(cmd *cli.Cmd) {
        cmd.Spec = "[-d|--rm] IMAGE [COMMAND [ARG...]]"
        :
        :
    }

The spec syntax is mostly based on the conventions used in POSIX command line
applications (help messages and man pages). This syntax is described in full
below. If a user invokes the app or command with the incorrect syntax, the app
terminates with a help message showing the proper invocation. The remainder of
this section describes the many features and capabilities of the spec string
grammar.

Options can use both short and long option names in spec strings.  In the
example below, the option is mandatory and must be provided.  Any options
referenced in a spec string MUST be explicitly declared, otherwise this package
will panic. I.e. for each item in the spec string, a corresponding *Opt or *Arg
is required:

    x.Spec = "-f"  // or x.Spec = "--force"
    forceFlag := x.BoolOpt("f force", ...)

Arguments are specified with all-uppercased words.  In the example below, both
SRC and DST must be provided by the user (two arguments).  Like options, any
argument referenced in a spec string MUST be explicitly declared, otherwise this
package will panic:

    x.Spec="SRC DST"
    src := x.StringArg("SRC", ...)
    dst := x.StringArg("DST", ...)

With the exception of options, the order of the elements in a spec string is
respected and enforced when command line arguments are parsed.  In the example
below, consecutive options (-f and -g) are parsed regardless of the order they
are specified (both "-f=5 -g=6" and "-g=6 -f=5" are valid).  Order between
options and arguments is significant (-f and -g must appear before the SRC
argument). The same holds true for arguments, where SRC must appear before DST:

    x.Spec = "-f -g SRC -h DST"
    var (
        factor = x.IntOpt("f", 1, "Fun factor (1-5)")
        games  = x.IntOpt("g", 1, "# of games")
        health = x.IntOpt("h", 1, "# of hosts")
        src    = x.StringArg("SRC", ...)
        dst    = x.StringArg("DST", ...)
    )

Optionality of options and arguments is specified in a spec string by enclosing
the item in square brackets []. If the user does not provide an optional value,
the app will use the default value specified when the argument was defined. In
the example below, if -x is not provided, heapSize will default to 1024:

    x.Spec = "[-x]"
    heapSize := x.IntOpt("x", 1024, "Heap size in MB")

Choice between two or more items is specified in a spec string by separating
each choice with the | operator. Choices are mutually exclusive. In the examples
below, only a single choice can be provided by the user otherwise the app will
terminate displaying a help message on proper usage:

    x.Spec = "--rm | --daemon"
    x.Spec = "-H | -L | -P"
    x.Spec = "-t | DST"

Repetition of options and arguments is specified in a spec string with the ...
postfix operator to mark an item as repeatable. Both options and arguments
support repitition. In the example below, users may invoke the command with
multiple -e options and multiple SRC arguments:

    x.Spec = "-e... SRC..."

    // Allows parsing of the following shell command:
    //   $ app -eeeee file1 file2
    //   $ app -e -e -e -e file1 file2

Grouping of options and arguments is specified in a spec string with
parenthesis.  When combined with the choice | and repetition ... operators,
complex syntaxes can be created. The parenthesis in the example below indicate a
repeatable sequence of a -e option followed by an argument, and that is mutually
exclusive to a choice between -x and -y options.

    x.Spec = "(-e COMMAND)... | (-x|-y)"

    // Allows parsing of the following shell command:
    //   $ app -e show -e add
    //   $ app -y
    // But not the following:
    //   $ app -e show -x

Option groups, or option folding, are a shorthand method to declaring a choice
between multiple options.  I.e. any combination of the listed options in any
order with at least one option selected. The following two statements are
equivalent:

    x.Spec = "-abcd"
    x.Spec = "(-a | -b | -c | -d)..."

Option groups are typically used in conjunction with optionality [] operators.
I.e. any combination of the listed options in any order or none at all. The
following two statements are equivalent:

    x.Spec = "[-abcd]"
    x.Spec = "[-a | -b | -c | -d]..."

All of the options can be specified using a special syntax: [OPTIONS]. This is a
special token in the spec string (not optionality and not an argument called
OPTIONS). It is equivalent to an optional repeatable choice between all the
available options. For example, if an app or a command declares 4 options a, b,
c and d, then the following two statements are equivalent:

    x.Spec = "[OPTIONS]"
    x.Spec = "[-a | -b | -c | -d]..."

Inline option values are specified in the spec string with the =<some-text>
notation immediately following an option (long or short form) to provide users
with an inline description or value. The actual inline values are ignored by the
spec parser as they exist only to provide a contextual hint to the user. In the
example below, "absolute-path" and "in seconds" are ignored by the parser:

    x.Spec = "[ -a=<absolute-path> | --timeout=<in seconds> ] ARG"

The -- operator can be used to automatically treat everything following it as
arguments.  In other words, placing a -- in the spec string automatically
inserts a -- in the same position in the program call arguments. This lets you
write programs such as the POSIX time utility for example:

    x.Spec = "-lp [-- CMD [ARG...]]"

    // Allows parsing of the following shell command:
    //   $ app -p ps -aux



Spec Grammar

Below is the full EBNF grammar for the Specs language:

    spec         -> sequence
    sequence     -> choice*
    req_sequence -> choice+
    choice       -> atom ('|' atom)*
    atom         -> (shortOpt | longOpt | optSeq | allOpts | group | optional) rep?
    shortOp      -> '-' [A-Za-z]
    longOpt      -> '--' [A-Za-z][A-Za-z0-9]*
    optSeq       -> '-' [A-Za-z]+
    allOpts      -> '[OPTIONS]'
    group        -> '(' req_sequence ')'
    optional     -> '[' req_sequence ']'
    rep          -> '...'

By combining a few of these building blocks together (while respecting the
grammar above), powerful and sophisticated validation constraints can be created
in a simple and concise manner without having to define in code. This is one of
the key differentiators between this package and other CLI packages. Validation
of usage is handled entirely by the package through the spec string.

Behind the scenes, this package parses the spec string and constructs a finite
state machine used to parse the command line arguments. It also handles
backtracking, which allows it to handle tricky cases, or what I like to call
"the cp test":

    cp SRC... DST

Without backtracking, this deceptively simple spec string cannot be parsed
correctly. For instance, docopt can't handle this case, whereas this package
does.



Default Spec

By default an auto-generated spec string is created for the app and every
command unless a spec string has been set by the user.  This can simplify use of
the package even further for simple syntaxes.

The following logic is used to create an auto-generated spec string: 1) start
with an empty spec string, 2) if at least one option was declared, append
"[OPTIONS]" to the spec string, and 3) for each declared argument, append it, in
the order of declaration, to the spec string. For example, given this command
declaration:

    docker.Command("run", "Run a command in a new container", func(cmd *cli.Cmd) {
        var (
            detached = cmd.BoolOpt("d detach", false, "Run container in background")
            memory   = cmd.StringOpt("m memory", "", "Set memory limit")
            image    = cmd.StringArg("IMAGE", "", "The image to run")
            args     = cmd.StringsArg("ARG", nil, "Arguments")
        )
    })

The auto-generated spec string, which should suffice for simple cases, would be:

    [OPTIONS] IMAGE ARG

If additional constraints are required, the spec string must be set explicitly
using the grammar documented above.



Custom Types

By default, the following types are supported for options and arguments: bool,
string, int, strings (slice of strings), and ints (slice of ints).  You can,
however, extend this package to handle other types, e.g. time.Duration, float64,
or even your own struct types.

To define your own custom type, you must implement the flag.Value interface for
your custom type, and then declare the option or argument using VarOpt or VarArg
respectively if using the short-form methods. If using the long-form struct,
then use Var instead.

The following example defines a custom type for a duration. It defines a
duration argument that users will be able to invoke with strings in the form of
"1h31m42s":

    // Declare your type
    type Duration time.Duration

    // Make it implement flag.Value
    func (d *Duration) Set(v string) error {
        parsed, err := time.ParseDuration(v)
        if err != nil {
            return err
        }
        *d = Duration(parsed)
        return nil
    }

    func (d *Duration) String() string {
        duration := time.Duration(*d)
        return duration.String()
    }

    func main() {
        duration := Duration(0)
        app := App("var", "")
        app.VarArg("DURATION", &duration, "")
        app.Run([]string{"cp", "1h31m42s"})
    }

To make a custom type to behave as a boolean option, i.e. doesn't take a value,
it must implement the IsBoolFlag method that returns true:

    type BoolLike int

    func (d *BoolLike) IsBoolFlag() bool {
        return true
    }

To make a custom type behave as a multi-valued option or argument, i.e. takes
multiple values, it must implement the Clear method, which is called whenever
the values list needs to be cleared, e.g. when the value was initially populated
from an environment variable, and then explicitly set from the CLI:

    type Durations []time.Duration

    // Make it implement flag.Value
    func (d *Durations) Set(v string) error {
        parsed, err := time.ParseDuration(v)
        if err != nil {
            return err
        }
        *d = append(*d, Duration(parsed))
        return nil
    }

    func (d *Durations) String() string {
        return fmt.Sprintf("%v", *d)
    }

    // Make it multi-valued
    func (d *Durations) Clear() {
        *d = []Duration{}
    }

To hide the default value of a custom type, it must implement the IsDefault
method that returns a boolean. The help message generator will use the return
value to decide whether or not to display the default value to users:

    type Action string

    func (a *Action) IsDefault() bool {
        return (*a) == "nop"
    }


*/
package cli
