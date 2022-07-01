# MPMessagePack

[MessagePack](http://msgpack.org/) framework.

MessagePack is an efficient binary serialization format. It lets you exchange data among multiple languages like JSON. But it's faster and smaller.

# Podfile

```ruby
pod "MPMessagePack"
```

# Cartfile

```
github "gabriel/MPMessagePack"
```

# MPMessagePack

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

If you need to use an ordered dictionary.

```objc
MPOrderedDictionary *dict = [[MPOrderedDictionary alloc] init];
[dict addEntriesFromDictionary:@{@"c": @(1), @"b": @(2), @"a": @(3)}];
[dict sortKeysUsingSelector:@selector(localizedCaseInsensitiveCompare:)];
NSData *data = [dict mp_messagePack];
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

# RPC

See [msgpack-rpc](https://github.com/msgpack-rpc/msgpack-rpc). 

It also supports a framing option where it will prefix the rpc message with the number of bytes (as a msgpack'ed number).

## Client

Request with completion block:

```objc
MPMessagePackClient *client = [[MPMessagePackClient alloc] init];
[client openWithHost:@"localhost" port:93434 completion:^(NSError *error) {
  // If error we failed
  [client sendRequestWithMethod:@"test" params:@[@{@"arg": @(1)}] completion:^(NSError *error, id result) {
    // If error we failed
    // Otherwise the result
  }];
}];
```

You can also request synchronously:

```objc
NSError *error = nil;
id result = [client sendRequestWithMethod:@"test" params:@[@{@"arg": @(1)}] messageId:3 timeout:5.0 error:&error];
// error.code == MPRPCErrorRequestTimeout on timeout
```

And cancel in progress requests:

```objc
BOOL cancelled = [client cancelRequestWithMessageId:3];
// cancelled == YES, if the request was in progress and we cancelled it
```

## Server

```objc
MPMessagePackServer *server = [[MPMessagePackServer alloc] initWithOptions:MPMessagePackOptionsFramed];

server.requestHandler = ^(NSString *method, id params, MPRequestCompletion completion) {
  if ([method isEqualToString:@"echo"]) {
    completion(nil, params);
  } else {
    completion(@{@"error": {@"description": @"Method not found"}}, nil);
  }
};

NSError *error = nil;
if (![server openWithPort:93434 error:&error]) {
  // Failed to open
}
```

## Mantle Encoding

If you are using Mantle to encode objects to JSON (and then msgpack), you can specify a coder for the MPMessagePackClient:

```objc
@interface KBMantleCoder : NSObject <MPMessagePackCoder>
@end

@implementation KBMantleCoder
- (NSDictionary *)encodeModel:(id)obj {
  return [obj conformsToProtocol:@protocol(MTLJSONSerializing)] ? [MTLJSONAdapter JSONDictionaryFromModel:obj] : obj;
}
@end
```

Then in the client:

```objc
MPMessagePackClient *client = [[MPMessagePackClient alloc] init];
client.coder = [[KBMantleCoder alloc] init];
```

## XPC

There is an experimental, but functional msgpack-rpc over XPC (see XPC directory). More details soon.
