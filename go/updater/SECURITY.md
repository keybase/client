## Security

In the future, we will be looking to integrate with [TUF](https://theupdateframework.github.io/)
in order to make updates more secure. In the meantime, this document describes
what the updater (in the context of the Keybase application) protects against.

The updater may not protect against certain attacks.

- Rollback attacks: The updater doesn't prevent an earlier update from being applied
- Indefinite freeze attacks: An attacker could reply with old metadata
- Endless data attacks: An attacker could cause the client to download endless data
- Slow retrieval attacks: An attacker could prevent an update by being slow
- Extraneous dependencies attacks: The updater doesn't know about dependencies and will only download and apply a single asset
- Mix-and-match attacks: An attacker could mix metadata (use an old asset with new update)

The Keybase updater does do the following (to prevent basic attacks):

- Uses TLS with a pinned certificate for api-0.core.keybaseapi.com (update source) for metadata
- Uses TLS to download asset
- Verifies asset digest (SHA256)
- Verifies asset saltpack signature (key IDs are pinned)
