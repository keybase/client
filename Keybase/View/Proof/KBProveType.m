//
//  KBProveType.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveType.h"


KBProveType KBProveTypeForServiceName(NSString *serviceName) {
  if ([serviceName isEqualTo:@"twitter"]) return KBProveTypeTwitter;
  if ([serviceName isEqualTo:@"github"]) return KBProveTypeGithub;
  if ([serviceName isEqualTo:@"reddit"]) return KBProveTypeReddit;
  if ([serviceName isEqualTo:@"coinbase"]) return KBProveTypeCoinbase;
  if ([serviceName isEqualTo:@"hackernews"]) return KBProveTypeHackernews;
  if ([serviceName isEqualTo:@"dns"]) return KBProveTypeDNS;
  if ([serviceName isEqualTo:@"https"]) return KBProveTypeHTTPS;
  return KBProveTypeUnknown;
}

NSString *KBServiceNameForProveType(KBProveType proveType) {
  switch (proveType) {
    case KBProveTypeUnknown: return nil;
    case KBProveTypeTwitter: return @"twitter";
    case KBProveTypeGithub: return @"github";
    case KBProveTypeReddit: return @"reddit";
    case KBProveTypeCoinbase: return @"coinbase";
    case KBProveTypeHackernews: return @"hackernews";
    case KBProveTypeDNS: return @"dns";
    case KBProveTypeHTTPS: return @"https";
  }
}

NSString *KBImageNameForProveType(KBProveType proveType) {
  switch (proveType) {
    case KBProveTypeTwitter: return @"Social networks-Outline-Twitter-25";
    case KBProveTypeGithub: return @"Social networks-Outline-Github-25";
    case KBProveTypeReddit: return @"Social networks-Outline-Reddit-25";
    default:
      return nil;
  }
}

NSString *KBNameForProveType(KBProveType proveType) {
  switch (proveType) {
    case KBProveTypeUnknown: return nil;
    case KBProveTypeTwitter: return @"Twitter";
    case KBProveTypeGithub: return @"Github";
    case KBProveTypeReddit: return @"Reddit";
    case KBProveTypeCoinbase: return @"Coinbase";
    case KBProveTypeHackernews: return @"HN";
    case KBProveTypeDNS: return @"DNS";
    case KBProveTypeHTTPS: return @"HTTPS";
  }
}

KBProveType KBProveTypeFromAPI(NSInteger proofType) {
  if (proofType == 2) return KBProveTypeTwitter;
  else if (proofType == 3) return KBProveTypeGithub;
  else if (proofType == 1000) return KBProveTypeHTTPS;
  else if (proofType == 1001) return KBProveTypeDNS;
  else if (proofType == 4) return KBProveTypeReddit;
  else if (proofType == 5) return KBProveTypeCoinbase;
  else if (proofType == 6) return KBProveTypeHackernews;
  return KBProveTypeUnknown;
}

