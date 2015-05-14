//
//  KBRUtils.m
//  Keybase
//
//  Created by Gabriel on 1/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRUtils.h"

#import "KBAppDefines.h"

@implementation KBRUtils

+ (KBRUID *)UIDFromHexString:(NSString *)hexString {
  return (KBRUID *)KBHexData(hexString);
}

@end
