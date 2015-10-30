## Keybase

Welcome to the Keybase client repo.  All our client apps (OSX, Windows, Linux, iOS, and Android) are being actively developed in this repository. Please, dig around.

### However, if all you want to do is run Keybase...

**[Visit our release page!](https://keybase.io/download)** 
 
We're moving fast and can't help debug your build right now. Plus, some of the things in this repo are explorations, and the app you build from source just *might not do what it says it's doing*. So, if you just want to install Keybase on your computer, you should **[get the appropriate release](https://keybase.io/download)** for OSX, Linux, or Windows.

![Sharing](https://keybase.io/images/github/repo_share.png?)

That said, we'd love you to read through our source code.

### Code Layout

* **go**: Core crypto libraries; the Keybase service; the command line client. [Learn More](go/README.md)
* **react-native**: Android and iOS apps developed with [React Native](https://facebook.github.io/react-native/).
* **desktop**: Desktop application for OSX, Linux and Windows, made with the [Electron](https://github.com/atom/electron) framework, sharing React code with react-native.
* **packaging**: Scripts for releasing packages across the various platforms.
* **protocol**: Defines the protocol for communication for clients to the Keybase services. Uses [Avro](http://avro.apache.org/docs/1.7.7/). [Learn More](protocol/README.md)
* **media**: Icons, graphics, media for Keybase apps.
* **osx**: The Mac OS X Keybase.app, development parallel to an Electron-based application above. [Learn More](osx/README.md)


### Problems?

Report any issues with client software on this GitHub [issue tracker](https://github.com/keybase/client/issues).
Internally, we track our progress using Jira, but all PRs come through GitHub for your review!

If you're having problem with our Website, try the
[keybase-issues](https://github.com/keybase/keybase-issues) issue tracker.

We check and update both frequently.

### License

Most code is released under the New BSD (3 Clause) License.  If subdirectories include
a different license, that license applies instead.
