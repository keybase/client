//
//  MPMessagePack.h
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

//! Project version number for MPMessagePack.
FOUNDATION_EXPORT double MPMessagePackVersionNumber;

//! Project version string for MPMessagePack.
FOUNDATION_EXPORT const unsigned char MPMessagePackVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <MPMessagePack/PublicHeader.h>

#import <MPMessagePack/MPDefines.h>
#import <MPMessagePack/MPMessagePackWriter.h>
#import <MPMessagePack/MPMessagePackReader.h>

#import <MPMessagePack/MPLog.h>
#import <MPMessagePack/MPMessagePackClient.h>
#import <MPMessagePack/MPMessagePackServer.h>
#import <MPMessagePack/MPRPCProtocol.h>

#import <MPMessagePack/NSDictionary+MPMessagePack.h>
#import <MPMessagePack/NSArray+MPMessagePack.h>
#import <MPMessagePack/NSData+MPMessagePack.h>

#ifdef __MAC_OS_X_VERSION_MAX_ALLOWED
#import <MPMessagePack/MPXPCProtocol.h>
#import <MPMessagePack/MPXPCService.h>
#import <MPMessagePack/MPXPCClient.h>
#endif


