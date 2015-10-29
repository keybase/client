//
//  KBDefines.m
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDefines.h"
#import "KBFormatter.h"

NSNumber *KBNumberFromString(NSString *s) {
  NSInteger n = [s integerValue];
  NSString *s2 = [NSString stringWithFormat:@"%@", @(n)];
  if ([s2 isEqualToString:[s stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]]) return [NSNumber numberWithInteger:n];
  return nil;
}

NSString *KBNSStringWithFormat(NSString *formatString, ...) {
  va_list args;
  va_start(args, formatString);
  NSString *string = [[NSString alloc] initWithFormat:formatString arguments:args];
  va_end(args);
  return string;
}

BOOL KBIsErrorName(NSError *error, NSString *name) {
  return [error.userInfo[@"MPErrorInfoKey"][@"name"] isEqualTo:name];
}

NSString *KBNSStringByStrippingHTML(NSString *str) {
  if (!str) return nil;
  NSRange r;
  while ((r = [str rangeOfString:@"<[^>]+>" options:NSRegularExpressionSearch]).location != NSNotFound)
    str = [str stringByReplacingCharactersInRange:r withString:@""];
  return str;
}




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
  return KBNSStringWithFormat(@"keybase.io/%@", username);
}

NSString *KBURLStringForUsername(NSString *username) {
  return KBNSStringWithFormat(@"https://keybase.io/%@", username);
}


NSString *KBShortNameForServiceName(NSString *serviceName) {
  if ([serviceName isEqualTo:@"hackernews"]) return @"HN";
  else if ([serviceName isEqualTo:@"dns"]) return @"DNS";
  else if ([serviceName isEqualTo:@"https"]) return @"HTTPS";
  else if ([serviceName isEqualTo:@"http"]) return @"HTTP";
  else return KBNameForServiceName(serviceName);
}

NSString *KBNameForServiceName(NSString *serviceName) {
  if ([serviceName isEqualTo:@"twitter"]) return @"Twitter";
  else if ([serviceName isEqualTo:@"github"]) return @"Github";
  else if ([serviceName isEqualTo:@"reddit"]) return @"Reddit";
  else if ([serviceName isEqualTo:@"coinbase"]) return @"Coinbase";
  else if ([serviceName isEqualTo:@"hackernews"]) return @"HackerNews";
  else if ([serviceName isEqualTo:@"dns"]) return @"Domain";
  else if ([serviceName isEqualTo:@"http"]) return @"Website";
  else if ([serviceName isEqualTo:@"https"]) return @"Website";
  else if ([serviceName isEqualTo:@"keybase"]) return @"Keybase";
  else if ([serviceName isEqualTo:@"rooter"]) return @"Rooter";
  else return @"";
}
