# MPMessagePack

[MessagePack](http://msgpack.org/) framework.

MessagePack is an efficient binary serialization format. It lets you exchange data among multiple languages like JSON. But it's faster and smaller.

This is a trimmed copy of [gabriel/MPMessagePack](https://github.com/gabriel/MPMessagePack) used by the Keybase installer and helper tool (`osx/Installer`, `osx/Helper`). Only the reader/writer and the msgpack-rpc over XPC pieces are kept.

## Writing

```objc
#import <MPMessagePack/MPMessagePack.h>

NSDictionary *dict =
  @{
    @"n": @(32134123),
    @"bool": @(YES),
    @"array": @[@(1.1f), @(2.1)],
    @"body": [NSData data],
  };

NSData *data = [dict mp_messagePack];
```

Or via ```MPMessagePackWriter```.

```objc
NSError *error = nil;
NSData *data = [MPMessagePackWriter writeObject:dict error:&error];
```

## Reading

```objc
id obj = [MPMessagePackReader readData:data error:&error];
```

```objc
MPMessagePackReader *reader = [[MPMessagePackReader alloc] initWithData:data];
id obj1 = [reader read:&error]; // Read an object
id obj2 = [reader read:&error]; // Read another object
```

# XPC

msgpack-rpc ([spec](https://github.com/msgpack-rpc/msgpack-rpc)) over XPC: `MPXPCService` on the privileged helper side, `MPXPCClient` on the installer side (see the XPC directory).
