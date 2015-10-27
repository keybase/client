## Keybase

Welcome to the Keybase client repository! You'll find here everything from our core
crypto libraries to the last-mile UX used to power our mobile and desktop clients. What
we have here is still very much a work-in-progress, with some code more mature than others.


### Code Layout

* **go**: Core crypto libraries; the Keybase service and command line client. [Learn More](go/README.md)
* **electron**: Desktop application for OSX, Linux and Windows, made via the [electron framework](https://github.com/atom/electron) framework
* **packaging**: Scripts for releasing packages across the various platforms.
* **protocol**: Defines the protocol for communication for clients to the Keybase services. Uses [Avro](http://avro.apache.org/docs/1.7.7/). [Learn More](protocol/README.md)
* **react-native**: Android and iOS apps developed via the [react-native framework](https://facebook.github.io/react-native/).
* **media**: Icons, graphics, media for Keybase apps.
* **osx**: The Mac OS X Keybase.app; development parallel to an Electron-based application above. [Learn More](osx/README.md)


### Problems?

Report any issues with client software on this GitHub [issue tracker](https://github.com/keybase/client/issues).
Internally, we track our progress using Jira, but all PRs come through GitHub for your review!

If you're having problem with our Website, try the
[keybase-issues](https://github.com/keybase/keybase-issues) issue tracker.

We check and update both frequently.

### License

Most code is released under the New BSD (3 Clause) License.  If subdirectories include
a different license, that license applies instead.
