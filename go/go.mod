module github.com/keybase/client/go

go 1.22.1

toolchain go1.23.4

require (
	bazil.org/fuse v0.0.0-20200424023519-3c101025617f
	camlistore.org v0.0.0-20161205184337-c55c8602d3ce
	github.com/PuerkitoBio/goquery v1.5.1
	github.com/akavel/rsrc v0.2.1-0.20151103204339-ba14da1f8271
	github.com/araddon/dateparse v0.0.0-20180729174819-cfd92a431d0e
	github.com/blang/semver v3.5.1+incompatible
	// NOTE: if bleve is updated, consider removing the `replace` directive
	// for bbolt at the bottom of this go.mod
	github.com/blevesearch/bleve v0.8.2-0.20191030071327-189ee421f71e
	github.com/btcsuite/btcutil v0.0.0-20180706230648-ab6388e0c60a
	github.com/buger/jsonparser v1.1.1
	github.com/coreos/go-systemd v0.0.0-20190620071333-e64a0ec8b42a
	github.com/davecgh/go-spew v1.1.1
	github.com/deckarep/golang-set v1.7.2-0.20180927150649-699df6a3acf6
	github.com/docopt/docopt-go v0.0.0-20160216232012-784ddc588536
	github.com/dustin/go-humanize v1.0.0
	github.com/eapache/channels v1.1.0
	github.com/gammazero/workerpool v0.0.0-20181230203049-86a96b5d5d92
	github.com/go-errors/errors v1.4.2
	github.com/go-sql-driver/mysql v1.8.1
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da
	github.com/golang/mock v1.6.0
	github.com/golangci/golangci-lint v1.63.4
	github.com/hashicorp/golang-lru v0.5.4
	github.com/josephspurrier/goversioninfo v0.0.0-20160622020813-53f6213da3d7
	github.com/keybase/backoff v1.0.1-0.20160517061000-726b63b835ec
	github.com/keybase/cli v1.2.1-0.20191217150554-9323fd7ddfab
	github.com/keybase/clockwork v0.1.1-0.20161209210251-976f45f4a979
	github.com/keybase/go-codec v0.0.0-20180928230036-164397562123
	github.com/keybase/go-crypto v0.0.0-20200123153347-de78d2cb44f4
	github.com/keybase/go-framed-msgpack-rpc v0.0.0-20250106204556-4fc0f5189438
	github.com/keybase/go-jsonw v0.0.0-20200325173637-df90f282c233
	github.com/keybase/go-kext v0.0.0-20250106202153-9105fd1e4e98
	github.com/keybase/go-keychain v0.0.0-20250107162724-3747e5bfbb71
	github.com/keybase/go-logging v0.0.0-20250106191441-8771804dc638
	github.com/keybase/go-merkle-tree v0.0.0-20250107161224-3d8f9f2c4761
	github.com/keybase/go-porterstemmer v1.0.2-0.20181016185745-521f1ed5c3f7
	github.com/keybase/go-ps v0.0.0-20190827175125-91aafc93ba19
	github.com/keybase/go-triplesec v0.0.0-20250106205321-7dc0668e81f5
	github.com/keybase/go-triplesec-insecure v0.0.0-20250106205311-6a8afabf7cd9
	github.com/keybase/go-winio v0.4.12-0.20180913221037-b1d96ab97b58
	github.com/keybase/golang-ico v0.0.0-20181117022008-819cbeb217c9
	github.com/keybase/gomounts v0.0.0-20180302000443-349507f4d353
	github.com/keybase/keybase-test-vectors v1.0.12-0.20200309162119-ea1e58fecd5d
	github.com/keybase/pipeliner v0.0.0-20250106213516-c2d0059e9b94
	github.com/keybase/saltpack v0.0.0-20250107151705-422170014712
	github.com/keybase/stellarnet v0.0.0-20200311180805-6c05850f9050
	github.com/kr/text v0.2.0
	github.com/kyokomi/emoji v2.2.2+incompatible
	github.com/mattn/go-isatty v0.0.20
	github.com/miekg/dns v1.1.57
	github.com/nfnt/resize v0.0.0-20160724205520-891127d8d1b5
	github.com/pkg/errors v0.9.1
	github.com/pkg/xattr v0.2.2
	github.com/qrtz/nativemessaging v0.0.0-20161221035708-f4769a80e040
	github.com/rcrowley/go-metrics v0.0.0-20161128210544-1f30fe9094a5
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3
	github.com/shirou/gopsutil v2.18.13-0.20181231150826-db425313bfa8+incompatible
	github.com/stathat/go v1.0.0
	// NOTE: if stellar/go is updated, consider removing the `replace` directive
	// for goautoneg at the bottom of this go.mod
	github.com/stellar/go v0.0.0-20221209134558-b4ba6f8e67f2
	github.com/stretchr/testify v1.10.0
	github.com/syndtr/goleveldb v1.0.0
	github.com/urfave/cli v1.22.1
	github.com/vividcortex/ewma v1.1.2-0.20170804035156-43880d236f69
	go.uber.org/zap v1.24.0
	golang.org/x/crypto v0.32.0
	golang.org/x/image v0.23.0
	golang.org/x/mobile v0.0.0-20250106192035-c31d5b91ecc3
	golang.org/x/net v0.34.0
	golang.org/x/sync v0.10.0
	golang.org/x/sys v0.29.0
	golang.org/x/text v0.21.0
	golang.org/x/time v0.9.0
	gopkg.in/src-d/go-billy.v4 v4.3.2
	gopkg.in/src-d/go-git.v4 v4.13.1
	mvdan.cc/xurls/v2 v2.0.0-00010101000000-000000000000
	rsc.io/qr v0.2.0
	stathat.com/c/ramcache v1.0.0
)

require (
	github.com/alecthomas/template v0.0.0-20190718012654-fb15b899a751
	github.com/aws/aws-sdk-go v1.49.13
	github.com/gocolly/colly/v2 v2.1.1-0.20231020184023-3c987f1982ed
	github.com/kardianos/osext v0.0.0-20190222173326-2bc1f35cddc0
	github.com/keybase/dbus v0.0.0-20220506165403-5aa21ea2c23a
	gopkg.in/alecthomas/kingpin.v2 v2.2.6
)

require (
	4d63.com/gocheckcompilerdirectives v1.2.1 // indirect
	4d63.com/gochecknoglobals v0.2.1 // indirect
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/4meepo/tagalign v1.4.1 // indirect
	github.com/Abirdcfly/dupword v0.1.3 // indirect
	github.com/Antonboom/errname v1.0.0 // indirect
	github.com/Antonboom/nilnil v1.0.1 // indirect
	github.com/Antonboom/testifylint v1.5.2 // indirect
	github.com/BurntSushi/toml v1.4.1-0.20240526193622-a339e1f7089c // indirect
	github.com/Crocmagnon/fatcontext v0.5.3 // indirect
	github.com/Djarvur/go-err113 v0.0.0-20210108212216-aea10b59be24 // indirect
	github.com/GaijinEntertainment/go-exhaustruct/v3 v3.3.0 // indirect
	github.com/Masterminds/semver/v3 v3.3.0 // indirect
	github.com/OpenPeeDeeP/depguard/v2 v2.2.0 // indirect
	github.com/RoaringBitmap/roaring v0.4.22-0.20191112221735-4d53b29a8f7d // indirect
	github.com/StackExchange/wmi v1.2.1 // indirect
	github.com/alcortesm/tgz v0.0.0-20161220082320-9c5fe88206d7 // indirect
	github.com/alecthomas/go-check-sumtype v0.3.1 // indirect
	github.com/alecthomas/units v0.0.0-20231202071711-9a357b53e9c9 // indirect
	github.com/alexkohler/nakedret/v2 v2.0.5 // indirect
	github.com/alexkohler/prealloc v1.0.0 // indirect
	github.com/alingse/asasalint v0.0.11 // indirect
	github.com/alingse/nilnesserr v0.1.1 // indirect
	github.com/andybalholm/cascadia v1.3.1 // indirect
	github.com/anmitsu/go-shlex v0.0.0-20161002113705-648efa622239 // indirect
	github.com/antchfx/htmlquery v1.2.3 // indirect
	github.com/antchfx/xmlquery v1.3.4 // indirect
	github.com/antchfx/xpath v1.1.10 // indirect
	github.com/asaskevich/govalidator v0.0.0-20180319081651-7d2e70ef918f // indirect
	github.com/ashanbrown/forbidigo v1.6.0 // indirect
	github.com/ashanbrown/makezero v1.2.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.2.2-0.20220111210104-dfa3e347c392 // indirect
	github.com/bkielbasa/cyclop v1.2.3 // indirect
	github.com/blevesearch/blevex v0.0.0-20190916190636-152f0fe5c040 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/segment v0.8.0 // indirect
	github.com/blizzy78/varnamelen v0.8.0 // indirect
	github.com/bombsimon/wsl/v4 v4.5.0 // indirect
	github.com/breml/bidichk v0.3.2 // indirect
	github.com/breml/errchkjson v0.4.0 // indirect
	github.com/butuzov/ireturn v0.3.1 // indirect
	github.com/butuzov/mirror v1.3.0 // indirect
	github.com/catenacyber/perfsprint v0.7.1 // indirect
	github.com/ccojocar/zxcvbn-go v1.0.2 // indirect
	github.com/cespare/xxhash/v2 v2.1.2 // indirect
	github.com/charithe/durationcheck v0.0.10 // indirect
	github.com/chavacava/garif v0.1.0 // indirect
	github.com/ckaznocha/intrange v0.3.0 // indirect
	github.com/coreos/pkg v0.0.0-20180928190104-399ea9e2e55f // indirect
	github.com/couchbase/vellum v1.0.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.4 // indirect
	github.com/curioswitch/go-reassign v0.3.0 // indirect
	github.com/cznic/b v0.0.0-20181122101859-a26611c4d92d // indirect
	github.com/daixiang0/gci v0.13.5 // indirect
	github.com/denis-tingaikin/go-header v0.5.0 // indirect
	github.com/eapache/queue v1.1.1-0.20180227141424-093482f3f8ce // indirect
	github.com/edsrzf/mmap-go v1.0.1-0.20190108065903-904c4ced31cd // indirect
	github.com/emirpasic/gods v1.12.1-0.20181020102604-7c131f671417 // indirect
	github.com/etcd-io/bbolt v1.3.3 // indirect
	github.com/ettle/strcase v0.2.0 // indirect
	github.com/fatih/color v1.18.0 // indirect
	github.com/fatih/structtag v1.2.0 // indirect
	github.com/firefart/nonamedreturns v1.0.5 // indirect
	github.com/fsnotify/fsnotify v1.5.4 // indirect
	github.com/fzipp/gocyclo v0.6.0 // indirect
	github.com/gammazero/deque v0.0.0-20180920172122-f6adf94963e4 // indirect
	github.com/ghostiam/protogetter v0.3.8 // indirect
	github.com/gliderlabs/ssh v0.3.0 // indirect
	github.com/glycerine/go-unsnap-stream v0.0.0-20181221182339-f9677308dec2 // indirect
	github.com/go-critic/go-critic v0.11.5 // indirect
	github.com/go-ole/go-ole v1.2.6 // indirect
	github.com/go-toolsmith/astcast v1.1.0 // indirect
	github.com/go-toolsmith/astcopy v1.1.0 // indirect
	github.com/go-toolsmith/astequal v1.2.0 // indirect
	github.com/go-toolsmith/astfmt v1.1.0 // indirect
	github.com/go-toolsmith/astp v1.1.0 // indirect
	github.com/go-toolsmith/strparse v1.1.0 // indirect
	github.com/go-toolsmith/typep v1.1.0 // indirect
	github.com/go-viper/mapstructure/v2 v2.2.1 // indirect
	github.com/go-xmlfmt/xmlfmt v1.1.3 // indirect
	github.com/gobwas/glob v0.2.4-0.20181002190808-e7a84e9525fe // indirect
	github.com/gofrs/flock v0.12.1 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/golang/snappy v0.0.4 // indirect
	github.com/golangci/dupl v0.0.0-20180902072040-3e9179ac440a // indirect
	github.com/golangci/go-printf-func-name v0.1.0 // indirect
	github.com/golangci/gofmt v0.0.0-20241223200906-057b0627d9b9 // indirect
	github.com/golangci/misspell v0.6.0 // indirect
	github.com/golangci/plugin-module-register v0.1.1 // indirect
	github.com/golangci/revgrep v0.5.3 // indirect
	github.com/golangci/unconvert v0.0.0-20240309020433-c5143eacb3ed // indirect
	github.com/google/go-cmp v0.6.0 // indirect
	github.com/gordonklaus/ineffassign v0.1.0 // indirect
	github.com/gostaticanalysis/analysisutil v0.7.1 // indirect
	github.com/gostaticanalysis/comment v1.4.2 // indirect
	github.com/gostaticanalysis/forcetypeassert v0.1.0 // indirect
	github.com/gostaticanalysis/nilerr v0.1.1 // indirect
	github.com/hashicorp/go-immutable-radix/v2 v2.1.0 // indirect
	github.com/hashicorp/go-version v1.7.0 // indirect
	github.com/hashicorp/golang-lru/v2 v2.0.7 // indirect
	github.com/hashicorp/hcl v1.0.0 // indirect
	github.com/hexops/gotextdiff v1.0.3 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
	github.com/jgautheron/goconst v1.7.1 // indirect
	github.com/jingyugao/rowserrcheck v1.1.1 // indirect
	github.com/jjti/go-spancheck v0.6.4 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/jmhodges/levigo v1.0.0 // indirect
	github.com/julz/importas v0.2.0 // indirect
	github.com/karamaru-alpha/copyloopvar v1.1.0 // indirect
	github.com/kennygrant/sanitize v1.2.4 // indirect
	github.com/kevinburke/ssh_config v0.0.0-20180830205328-81db2a75821e // indirect
	github.com/keybase/msgpackzip v0.0.0-20250106200500-93bf3a4c34cf // indirect
	github.com/keybase/vcr v0.0.0-20191017153547-a32d93056205 // indirect
	github.com/kisielk/errcheck v1.8.0 // indirect
	github.com/kkHAIKE/contextcheck v1.1.5 // indirect
	github.com/kulti/thelper v0.6.3 // indirect
	github.com/kunwardeep/paralleltest v1.0.10 // indirect
	github.com/kyoh86/exportloopref v0.1.11 // indirect
	github.com/lasiar/canonicalheader v1.1.2 // indirect
	github.com/ldez/exptostd v0.3.1 // indirect
	github.com/ldez/gomoddirectives v0.6.0 // indirect
	github.com/ldez/grignotin v0.7.0 // indirect
	github.com/ldez/tagliatelle v0.7.1 // indirect
	github.com/ldez/usetesting v0.4.2 // indirect
	github.com/leonklingele/grouper v1.1.2 // indirect
	github.com/lib/pq v1.10.9 // indirect
	github.com/macabu/inamedparam v0.1.3 // indirect
	github.com/magiconair/properties v1.8.6 // indirect
	github.com/manucorporat/sse v0.0.0-20160126180136-ee05b128a739 // indirect
	github.com/maratori/testableexamples v1.0.0 // indirect
	github.com/maratori/testpackage v1.1.1 // indirect
	github.com/matoous/godox v0.0.0-20230222163458-006bad1f9d26 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-runewidth v0.0.16 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.1 // indirect
	github.com/mgechev/revive v1.5.1 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/moricho/tparallel v0.3.2 // indirect
	github.com/mschoch/smat v0.0.0-20160514031455-90eadee771ae // indirect
	github.com/nakabonne/nestif v0.3.1 // indirect
	github.com/nf/cr2 v0.0.0-20140528043846-05d46fef4f2f // indirect
	github.com/nishanths/exhaustive v0.12.0 // indirect
	github.com/nishanths/predeclared v0.2.2 // indirect
	github.com/nlnwa/whatwg-url v0.1.2 // indirect
	github.com/nunnatsa/ginkgolinter v0.18.4 // indirect
	github.com/olekukonko/tablewriter v0.0.5 // indirect
	github.com/pelletier/go-buffruneio v0.3.0 // indirect
	github.com/pelletier/go-toml v1.9.5 // indirect
	github.com/pelletier/go-toml/v2 v2.2.3 // indirect
	github.com/philhofer/fwd v1.0.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/polyfloyd/go-errorlint v1.7.0 // indirect
	github.com/prometheus/client_golang v1.12.1 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.32.1 // indirect
	github.com/prometheus/procfs v0.7.3 // indirect
	github.com/quasilyte/go-ruleguard v0.4.3-0.20240823090925-0fe6f58b47b1 // indirect
	github.com/quasilyte/go-ruleguard/dsl v0.3.22 // indirect
	github.com/quasilyte/gogrep v0.5.0 // indirect
	github.com/quasilyte/regex/syntax v0.0.0-20210819130434-b3f0c404a727 // indirect
	github.com/quasilyte/stdinfo v0.0.0-20220114132959-f7386bf02567 // indirect
	github.com/raeperd/recvcheck v0.2.0 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/rogpeppe/go-internal v1.13.1 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/rwcarlsen/goexif v0.0.0-20150520140647-709fab3d192d // indirect
	github.com/ryancurrah/gomodguard v1.3.5 // indirect
	github.com/ryanrolds/sqlclosecheck v0.5.1 // indirect
	github.com/saintfish/chardet v0.0.0-20120816061221-3af4cd4741ca // indirect
	github.com/sanposhiho/wastedassign/v2 v2.1.0 // indirect
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.1 // indirect
	github.com/sashamelentyev/interfacebloat v1.1.0 // indirect
	github.com/sashamelentyev/usestdlibvars v1.28.0 // indirect
	github.com/securego/gosec/v2 v2.21.4 // indirect
	github.com/segmentio/go-loggly v0.5.1-0.20171222203950-eb91657e62b2 // indirect
	github.com/shazow/go-diff v0.0.0-20160112020656-b6b7b6733b8c // indirect
	github.com/shopspring/decimal v1.3.1 // indirect
	github.com/simplereach/timeutils v1.2.0 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/sivchari/containedctx v1.0.3 // indirect
	github.com/sivchari/tenv v1.12.1 // indirect
	github.com/sonatard/noctx v0.1.0 // indirect
	github.com/sourcegraph/go-diff v0.7.0 // indirect
	github.com/spf13/afero v1.11.0 // indirect
	github.com/spf13/cast v1.5.0 // indirect
	github.com/spf13/cobra v1.8.1 // indirect
	github.com/spf13/jwalterweatherman v1.1.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/spf13/viper v1.13.0 // indirect
	github.com/src-d/gcfg v1.3.0 // indirect
	github.com/ssgreg/nlreturn/v2 v2.2.1 // indirect
	github.com/stbenjam/no-sprintf-host-port v0.2.0 // indirect
	github.com/stellar/go-xdr v0.0.0-20211103144802-8017fc4bdfee // indirect
	github.com/steveyen/gtreap v0.0.0-20150807155958-0abe01ef9be2 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/strib/gomounts v0.0.0-20180215003523-d9ea4eaa52ca // indirect
	github.com/subosito/gotenv v1.4.1 // indirect
	github.com/tdakkota/asciicheck v0.3.0 // indirect
	github.com/tecbot/gorocksdb v0.0.0-20191217155057-f0fad39f321c // indirect
	github.com/temoto/robotstxt v1.1.1 // indirect
	github.com/tetafro/godot v1.4.20 // indirect
	github.com/timakin/bodyclose v0.0.0-20241017074812-ed6a65f985e3 // indirect
	github.com/timonwong/loggercheck v0.10.1 // indirect
	github.com/tinylib/msgp v1.1.0 // indirect
	github.com/tomarrell/wrapcheck/v2 v2.10.0 // indirect
	github.com/tommy-muehle/go-mnd/v2 v2.5.1 // indirect
	github.com/ultraware/funlen v0.2.0 // indirect
	github.com/ultraware/whitespace v0.2.0 // indirect
	github.com/uudashr/gocognit v1.2.0 // indirect
	github.com/uudashr/iface v1.3.0 // indirect
	github.com/willf/bitset v1.1.11-0.20190404145324-77892cd8d53f // indirect
	github.com/xanzy/ssh-agent v0.2.0 // indirect
	github.com/xen0n/gosmopolitan v1.2.2 // indirect
	github.com/yagipy/maintidx v1.0.0 // indirect
	github.com/yeya24/promlinter v0.3.0 // indirect
	github.com/ykadowak/zerologlint v0.1.5 // indirect
	gitlab.com/bosi/decorder v0.4.2 // indirect
	go-simpler.org/musttag v0.13.0 // indirect
	go-simpler.org/sloglint v0.7.2 // indirect
	go.etcd.io/bbolt v1.3.6 // indirect
	go.uber.org/atomic v1.7.0 // indirect
	go.uber.org/automaxprocs v1.6.0 // indirect
	go.uber.org/multierr v1.6.0 // indirect
	go4.org v0.0.0-20161118210015-09d86de304dc // indirect
	golang.org/x/exp v0.0.0-20240909161429-701f63a606c0 // indirect
	golang.org/x/exp/typeparams v0.0.0-20241108190413-2d47ceb2692f // indirect
	golang.org/x/mod v0.22.0 // indirect
	golang.org/x/tools v0.29.0 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/protobuf v1.34.2 // indirect
	gopkg.in/ini.v1 v1.67.0 // indirect
	gopkg.in/mgo.v2 v2.0.0-20190816093944-a6b53ec6cb22 // indirect
	gopkg.in/src-d/go-git-fixtures.v3 v3.5.0 // indirect
	gopkg.in/warnings.v0 v0.1.2 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	honnef.co/go/tools v0.5.1 // indirect
	mvdan.cc/gofumpt v0.7.0 // indirect
	mvdan.cc/unparam v0.0.0-20240528143540-8a5130ca722f // indirect
)

// keybase maintained forks
replace (
	bazil.org/fuse => github.com/keybase/fuse v0.0.0-20210104232444-d36009698767
	github.com/stellar/go => github.com/keybase/stellar-org v0.0.0-20191010205648-0fc3bfe3dfa7
	github.com/syndtr/goleveldb => github.com/keybase/goleveldb v1.0.1-0.20221007195407-9881c0c26e65
	gopkg.in/src-d/go-billy.v4 => github.com/keybase/go-billy v3.1.1-0.20180828145748-b5a7b7bc2074+incompatible
	gopkg.in/src-d/go-git.v4 => github.com/keybase/go-git v4.0.0-rc9.0.20190209005256-3a78daa8ce8e+incompatible
	mvdan.cc/xurls/v2 => github.com/keybase/xurls/v2 v2.0.1-0.20190725180013-1e015cacd06c
)

// temporary workaround for https://github.com/blevesearch/bleve/issues/1360
// should be removed if bleve is updated to a commit past https://github.com/blevesearch/bleve/commit/a9895fdf9c72cfaa202128a963697d9a98765369
replace github.com/etcd-io/bbolt => go.etcd.io/bbolt v1.3.4-0.20191122203157-7f8bb47fcaf8

// temporary workaround for https://github.com/stellar/go/issues/2039
// should be removed if stellar/go is updated to a commit past https://github.com/stellar/go/commit/f686b01b140bb57abcb8643240c3b6a134dad3ff
replace bitbucket.org/ww/goautoneg => github.com/adjust/goautoneg v0.0.0-20150426214442-d788f35a0315

replace os/exec => golang.org/x/sys/execabs v0.0.0-20211117180635-dee7805ff2e1

replace camlistore.org v0.0.0-20161205184337-c55c8602d3ce => perkeep.org v0.0.0-20161205184337-c55c8602d3ce
