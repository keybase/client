//
//  KBRUtils.h
//  Keybase
//
//  Created by Gabriel on 1/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

@interface KBRUtils : NSObject

+ (KBRUID *)UIDFromHexString:(NSString *)hexString;

@end
