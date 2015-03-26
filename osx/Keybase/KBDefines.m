//
//  KBDefines.m
//  Keybase
//
//  Created by Gabriel on 1/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDefines.h"

NSString *const KBTrackingListDidChangeNotification = @"KBTrackingListDidChangeNotification";

NSString *KBHexString(NSData *data) {
  if ([data length] == 0) return nil;
  NSMutableString *hexString = [NSMutableString stringWithCapacity:[data length] * 2];
  for (NSUInteger i = 0; i < [data length]; ++i) {
    [hexString appendFormat:@"%02X", *((uint8_t *)[data bytes] + i)];
  }
  return [hexString lowercaseString];
}

NSString *KBDisplayURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"keybase.io/%@", username);
}

NSString *KBURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"https://keybase.io/%@", username);
}
