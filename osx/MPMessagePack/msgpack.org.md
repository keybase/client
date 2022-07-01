
# Install

```
pod "MPMessagePack"
```

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
[dict mp_messagePack];
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

