//
//  KBProveType.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveType.h"

NSString *KBImageNameForServiceName(NSString *serviceName) {
  if ([serviceName isEqualTo:@"twitter"]) return @"Social networks-Outline-Twitter-25";
  else if ([serviceName isEqualTo:@"github"]) return @"Social networks-Outline-Github-25";
  else if ([serviceName isEqualTo:@"reddit"]) return @"Social networks-Outline-Reddit-25";
  else return nil;
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
