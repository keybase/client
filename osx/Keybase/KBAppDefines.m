//
//  KBAppDefines.m
//  Keybase
//
//  Created by Gabriel on 1/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppDefines.h"
#import <Mantle/Mantle.h>

NSString *const KBTrackingListDidChangeNotification = @"KBTrackingListDidChangeNotification";
NSString *const KBStatusDidChangeNotification = @"KBStatusDidChangeNotification";

NSString *KBDescriptionForKID(NSData *kid) {
  if (!kid) return nil;
  if ([kid length] < 16) return [KBHexString(kid) uppercaseString];
  return [KBHexString([kid subdataWithRange:NSMakeRange(kid.length-16, 16)]) uppercaseString];
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

NSString *KBDescription(id obj) {
  if ([obj isKindOfClass:NSNull.class]) {
    return @"null";
  } else if ([obj isKindOfClass:NSArray.class]) {
    return KBArrayDescription(obj);
  } else if ([obj isKindOfClass:NSDictionary.class]) {
    return KBDictionaryDescription(obj);
  } else if ([obj conformsToProtocol:@protocol(MTLJSONSerializing)]) {
    NSDictionary *properties = [MTLJSONAdapter JSONDictionaryFromModel:obj error:nil]; // TODO: Handle error
    return properties ? KBDictionaryDescription(properties) : [obj description];
  } else {
    return [obj description];
  }
}

NSString *KBArrayDescription(NSArray *a) {
  if ([a count] == 0) return @"[]";
  return NSStringWithFormat(@"[%@]", [[a map:^(id obj) { return KBDescription(obj); }] join:@", "]);
}

NSString *KBDictionaryDescription(NSDictionary *d) {
  return NSStringWithFormat(@"{%@}", [[d map:^id(id key, id value) {
    return NSStringWithFormat(@"%@: %@", key, KBDescription(value));
  }] join:@", "]);
}

NSString *KBDisplayURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"keybase.io/%@", username);
}

NSString *KBURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"https://keybase.io/%@", username);
}
