//
//  KBKitDefines.m
//  Keybase
//
//  Created by Gabriel on 1/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

@import Foundation;
#import <ObjectiveSugar/ObjectiveSugar.h>

#import "KBFormatter.h"

NSString *KBDescriptionForKID(NSData *kid) {
  if (!kid) return nil;
  if ([kid length] < 16) return [KBHexString(kid, @"") uppercaseString];
  return [KBHexString([kid subdataWithRange:NSMakeRange(kid.length-16, 16)], @"") uppercaseString];
}

NSString *KBPGPKeyIdFromFingerprint(NSString *fingerprint) {
  if (!fingerprint) return nil;
  if ([fingerprint length] < 16) return fingerprint;
  return [[fingerprint substringFromIndex:[fingerprint length] - 16] lowercaseString];
}

NSString *KBDescriptionForFingerprint(NSString *fingerprint, NSInteger indexForLineBreak) {
  NSMutableString *s = [[NSMutableString alloc] init];
  for (NSInteger i = 1; i <= fingerprint.length; i++) {
    [s appendString:[NSString stringWithFormat:@"%c", [fingerprint characterAtIndex:i-1]]];
    if (indexForLineBreak == i) {
      [s appendString:@"\n"];
    } else {
      if (i % 4 == 0) [s appendString:@" "];
    }
  }
  return [s uppercaseString];
}

NSString *KBDisplayURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"keybase.io/%@", username);
}

NSString *KBURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"https://keybase.io/%@", username);
}


