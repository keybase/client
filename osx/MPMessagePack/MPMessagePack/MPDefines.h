//
//  MPDefines.h
//  MPMessagePack
//
//  Created by Gabriel on 12/13/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#undef MPErr
#define MPErr(fmt, ...) do {} while(0)

#if DEBUG
#undef MPErr
#define MPErr(fmt, ...) NSLog((@"%s:%d: " fmt), __PRETTY_FUNCTION__, __LINE__, ##__VA_ARGS__)
#endif

#define MPMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"MPMessagePack" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__]}]

#define MPIfNull(obj, val) ([obj isEqual:NSNull.null] ? val : obj)

#define MPWeakObject(o) __typeof__(o) __weak
#define MPWeakSelf MPWeakObject(self)
