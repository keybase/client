package common

import (
	"fmt"
	"strings"
	"time"
)

type Runmode string

func (r Runmode) String() string {
	return string(r)
}

const RunmodeProd = Runmode("prod")
const RunmodeStaging = Runmode("staging")
const RunmodeDevel = Runmode("devel")

type Serverset string

func (s Serverset) String() string {
	return string(s)
}

type Appname string

func (a Appname) String() string {
	return string(a)
}

type App struct {
	Name              Appname
	IsWebServerApp    bool
	WebServerPort     *int
	IsExpectedRestart func(time.Time) bool
}

type Servername string

func (s Servername) String() string {
	return string(s)
}

type ExpectedRestart struct {
	Name Appname
	Min  time.Time
	Max  time.Time
}
type Server struct {
	Name            Servername
	Runmode         Runmode
	EC2InstanceName *string
	LoadBalancers   []string
	IsWebServer     bool
	Apps            map[Appname]App
	InServersets    []Serverset
}

func (s Server) OkHitThreshold() int {
	if s.Runmode != RunmodeProd {
		return 3
	}
	if s.IsWebServer {
		return 25
	}
	return 10
}

type Config struct {
	Servers        map[Servername]Server
	DefaultRunmode Runmode
	DeployResolver func(runmode Runmode, arg string) (Deployschedule, error)
	Serversets     []Serverset
}

func (c Config) ParseServername(x string) (Servername, error) {
	if _, ok := c.Servers[Servername(x)]; ok {
		return Servername(x), nil
	}
	return "", fmt.Errorf("unknown servername %s", x)
}

func (c Config) ParseServerset(x string) (Serverset, error) {
	for _, serverset := range c.Serversets {
		if serverset.String() == x {
			return serverset, nil
		}
	}
	return "", fmt.Errorf("unknown serverset %s", x)
}

func (c Config) ParseRunmode(x string) (Runmode, error) {
	switch Runmode(x) {
	case RunmodeProd, RunmodeDevel, RunmodeStaging:
		return Runmode(x), nil
	default:
		return "", fmt.Errorf("unknown runmode %s", x)
	}
}

func (c Config) ServernamesForServerset(runmode Runmode, target Serverset) (ret []Servername) {
	for _, server := range c.Servers {
		if server.Runmode != runmode {
			continue
		}
		for _, serverset := range server.InServersets {
			if serverset == target {
				ret = append(ret, server.Name)
			}
		}
	}
	return ret
}

func (c Config) ServernamesForRunmode(runmode Runmode) (ret []Servername) {
	for _, server := range c.Servers {
		if server.Runmode == runmode {
			ret = append(ret, server.Name)
		}
	}
	return ret
}

func (c Config) ParseAppname(servername Servername, arg string) (Appname, error) {
	if app, ok := c.Servers[servername].Apps[Appname(arg)]; ok {
		return app.Name, nil
	}
	return "", fmt.Errorf("unknown appname %s for servername %s", arg, servername)
}

const nWebservers = 6
const appsPerWebServer = 17

func GetConfig() Config {
	ws := Serverset("ws")
	static := Serverset("static")

	var serversSlice []Server

	webappName := func(idx int) Appname {
		return Appname(fmt.Sprintf("app%d", idx))
	}
	webServerApp := func(name Appname, port int) App {
		return App{Name: name, IsWebServerApp: true, WebServerPort: &port}
	}
	webserverLoadBalancers := []string{"prod-api", "prod-api-2", "prod-www"}
	webServerApps := make(map[Appname]App)
	for i := 0; i < appsPerWebServer; i++ {
		app := webServerApp(webappName(i), 3000+i)
		webServerApps[app.Name] = app
	}
	for i := 0; i < nWebservers; i++ {
		ec2InstanceName := fmt.Sprintf("ws-%d.prod", i)
		server := Server{
			Name:            Servername(fmt.Sprintf("ws%d", i)),
			Runmode:         "prod",
			EC2InstanceName: &ec2InstanceName,
			LoadBalancers:   webserverLoadBalancers,
			IsWebServer:     true,
			Apps:            webServerApps,
			InServersets:    []Serverset{ws, static},
		}
		serversSlice = append(serversSlice, server)
	}

	rpcsrvApp := func(name string) App {
		return App{Name: Appname(name), IsWebServerApp: false}
	}

	services0Apps := make(map[Appname]App)
	for _, name := range []string{"emaild", "brewd", "pubsubd", "textsearchd",
		"minimized", "nudged", "imaged", "watchdogd", "maintenanced", "logdumpd",
		"socialgraphd", "statd", "statmond", "quotad", "kex2d", "authd", "rekeyd",
		"keybasepubd", "emailrenderd", "credauthd", "team_rekeyd", "dbupdated",
		"dbstatsd", "kbfstlfd", "spammerd", "autoresetd", "usersearchd"} {
		app := rpcsrvApp(name)
		// from `crontab -e` on svc0
		if name == "imaged" || name == "watchdogd" || name == "socialgraphd" {
			app.IsExpectedRestart = func(t time.Time) bool {
				return ((t.Hour() == 2 && t.Minute() >= 58) || (t.Hour() == 3 && t.Minute() <= 02))
			}
		}
		services0Apps[app.Name] = app
	}
	appsToMap := func(apps ...App) map[Appname]App {
		ret := make(map[Appname]App)
		for _, app := range apps {
			ret[app.Name] = app
		}
		return ret
	}
	serversSlice = append(serversSlice,
		Server{
			Name:         Servername("services0"),
			Runmode:      RunmodeProd,
			Apps:         services0Apps,
			InServersets: []Serverset{static},
		},
		Server{
			Name:    Servername("merkled0"),
			Runmode: RunmodeProd,
			Apps:    appsToMap(rpcsrvApp("merkle_determinatord"), rpcsrvApp("merkle_upsertd"), rpcsrvApp("merkle_commitd")),
		},
		Server{
			Name:    Servername("proofd0"),
			Runmode: RunmodeProd,
			Apps:    appsToMap(rpcsrvApp("proofd")),
		},
		Server{
			Name:         Servername("stage0"),
			Runmode:      RunmodeStaging,
			IsWebServer:  true,
			Apps:         appsToMap(webServerApp("app", 3000), rpcsrvApp("proofd"), rpcsrvApp("imaged")),
			InServersets: []Serverset{ws, static},
		},
		Server{
			Name:         Servername("localhost"),
			Runmode:      RunmodeDevel,
			IsWebServer:  true,
			Apps:         appsToMap(webServerApp("app", 3000), rpcsrvApp("proofd"), rpcsrvApp("imaged"), rpcsrvApp("usersearchd")),
			InServersets: []Serverset{ws, static},
		},
	)

	serversToMap := func(servers ...Server) map[Servername]Server {
		ret := make(map[Servername]Server)
		for _, server := range servers {
			ret[server.Name] = server
		}
		return ret
	}

	servers := serversToMap(serversSlice...)

	resolver := func(runmode Runmode, arg string) (Deployschedule, error) {
		// Special cases
		switch runmode {
		case RunmodeProd:
			switch arg {
			case "app", "mikeapp":
				var ret Deployschedule
				ret = append(ret, Deployset{DeploytaskGitPull{"services0"}})
				for _, server := range servers {
					if server.Runmode != runmode || !server.IsWebServer {
						continue
					}

					ret = append(ret, Deployset{DeploytaskLoadBalanceDown{server.Name}})
					ret = append(ret, Deployset{DeploytaskGitPull{server.Name}})

					var set Deployset
					for appname := range server.Apps {
						set = append(set, NewDeploytaskRestartQuick(server.Name, appname))
					}
					ret = append(ret, set)

					ret = append(ret, Deployset{DeploytaskLoadBalanceUp{server.Name}})

					var waitSet Deployset
					for appname := range server.Apps {
						waitSet = append(waitSet, DeploytaskWait{server.Name, appname, false})
					}
					ret = append(ret, waitSet)
				}
				return ret, nil
			case "sequentialapp":
				var ret Deployschedule

				gitPullSet := Deployset{DeploytaskGitPull{"services0"}}
				for _, server := range servers {
					if server.Runmode != runmode || !server.IsWebServer {
						continue
					}
					gitPullSet = append(gitPullSet, DeploytaskGitPull{server.Name})
				}

				ret = append(ret, gitPullSet)

				for idx := 0; idx < appsPerWebServer; idx++ {
					var restartA Deployset
					var restartB Deployset
					for jdx, server := range serversSlice {
						if server.Runmode != runmode || !server.IsWebServer {
							continue
						}

						task := NewDeploytaskRestart(server.Name, webappName(idx))
						if jdx%2 == 0 {
							restartA = append(restartA, task)
						} else {
							restartB = append(restartB, task)
						}
					}

					ret = append(ret, restartA, restartB)
				}

				return ret, nil
			}

			if server, ok := servers[Servername(arg)]; ok {
				if server.IsWebServer {
					var ret Deployschedule
					ret = append(ret, Deployset{DeploytaskLoadBalanceDown{server.Name}})
					ret = append(ret, Deployset{DeploytaskGitPull{server.Name}})

					var set Deployset
					for appname := range server.Apps {
						set = append(set, NewDeploytaskRestartQuick(server.Name, appname))
					}
					ret = append(ret, set)

					ret = append(ret, Deployset{DeploytaskLoadBalanceUp{server.Name}})

					var waitSet Deployset
					for appname := range server.Apps {
						waitSet = append(waitSet, DeploytaskWait{server.Name, appname, false})
					}
					ret = append(ret, waitSet)
					return ret, nil
				}
			}
		case RunmodeDevel:
			switch arg {
			case "multidevelrestart":
				return Deployschedule{
					Deployset{NewDeploytaskRestart("localhost", "app"), NewDeploytaskRestart("localhost", "proofd")},
					Deployset{NewDeploytaskRestart("localhost", "proofd"), NewDeploytaskRestart("localhost", "imaged")},
				}, nil
			}
		default:
			return nil, fmt.Errorf("unknown runmode %s", runmode)
		}

		// Specific app on a specific server, to handle ambiguous appnames
		spl := strings.Split(arg, "/")
		if len(spl) == 2 {
			if server, servernameOk := servers[Servername(spl[0])]; servernameOk {
				if app, appnameOk := server.Apps[Appname(spl[1])]; appnameOk {
					return Deployschedule{
						Deployset{DeploytaskGitPull{server.Name}},
						Deployset{NewDeploytaskRestart(server.Name, app.Name)},
					}, nil
				}
			}
		}

		// Specific servers or unambiguous appnames
		resolvedAsAppname := false
		var servername Servername
		var appname Appname
		for _, server := range servers {
			if runmode != server.Runmode {
				continue
			}
			// Servernames are not ambiguous, so if we get a match, deploy each app in there sequentially.
			if Servername(arg) == server.Name {
				ret := Deployschedule{Deployset{DeploytaskGitPull{server.Name}}}
				for appname := range server.Apps {
					ret = append(ret, Deployset{NewDeploytaskRestart(server.Name, appname)})
				}
				return ret, nil
			}
			// Appnames can be ambiguous across servers (e.g. app0), so make sure it isn't claimed
			// by more than one server in the specified runmode.
			for _, app := range server.Apps {
				if Appname(arg) == app.Name {
					if resolvedAsAppname {
						return nil, fmt.Errorf("ambiguous argument %s for runmode %s; try specifing 'servername/appname'", arg, runmode)
					}
					resolvedAsAppname = true
					servername = server.Name
					appname = app.Name
				}
			}
		}
		if resolvedAsAppname {
			return Deployschedule{
				Deployset{DeploytaskGitPull{servername}},
				Deployset{NewDeploytaskRestart(servername, appname)},
			}, nil
		}

		return nil, fmt.Errorf("failed to resolve argument %s for runmode %s", arg, runmode)
	}

	return Config{
		Servers:        servers,
		DefaultRunmode: RunmodeProd,
		DeployResolver: resolver,
		Serversets:     []Serverset{ws, static},
	}
}
