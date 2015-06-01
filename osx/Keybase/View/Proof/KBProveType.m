//
//  KBProveType.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveType.h"


KBRProofType KBRProofTypeForServiceName(NSString *serviceName) {
  if ([serviceName isEqualTo:@"twitter"]) return KBRProofTypeTwitter;
  if ([serviceName isEqualTo:@"github"]) return KBRProofTypeGithub;
  if ([serviceName isEqualTo:@"reddit"]) return KBRProofTypeReddit;
  if ([serviceName isEqualTo:@"coinbase"]) return KBRProofTypeCoinbase;
  if ([serviceName isEqualTo:@"hackernews"]) return KBRProofTypeHackernews;
  if ([serviceName isEqualTo:@"dns"]) return KBRProofTypeDns;
  if ([serviceName isEqualTo:@"https"]) return KBRProofTypeGenericWebSite;
  if ([serviceName isEqualTo:@"rooter"]) return KBRProofTypeRooter;
  return KBRProofTypeNone;
}

NSString *KBServiceNameForProofType(KBRProofType proofType) {
  switch (proofType) {
    case KBRProofTypeNone: return nil;
    case KBRProofTypeTwitter: return @"twitter";
    case KBRProofTypeGithub: return @"github";
    case KBRProofTypeReddit: return @"reddit";
    case KBRProofTypeCoinbase: return @"coinbase";
    case KBRProofTypeHackernews: return @"hackernews";
    case KBRProofTypeDns: return @"dns";
    case KBRProofTypeGenericWebSite: return @"https";
    case KBRProofTypeKeybase: return @"keybase";
    case KBRProofTypeRooter: return @"rooter";
  }
}

NSString *KBImageNameForProofType(KBRProofType proofType) {
  switch (proofType) {
    case KBRProofTypeTwitter: return @"Social networks-Outline-Twitter-25";
    case KBRProofTypeGithub: return @"Social networks-Outline-Github-25";
    case KBRProofTypeReddit: return @"Social networks-Outline-Reddit-25";
    default:
      return nil;
  }
}

NSString *KBShortNameForProofType(KBRProofType proofType) {
  switch (proofType) {
    case KBRProofTypeHackernews: return @"HN";
    case KBRProofTypeDns: return @"DNS";
    case KBRProofTypeGenericWebSite: return @"HTTPS";
    default:
      return KBNameForProofType(proofType);
  }
}

NSString *KBNameForProofType(KBRProofType proofType) {
  switch (proofType) {
    case KBRProofTypeNone: return nil;
    case KBRProofTypeTwitter: return @"Twitter";
    case KBRProofTypeGithub: return @"Github";
    case KBRProofTypeReddit: return @"Reddit";
    case KBRProofTypeCoinbase: return @"Coinbase";
    case KBRProofTypeHackernews: return @"HackerNews";
    case KBRProofTypeDns: return @"Domain";
    case KBRProofTypeGenericWebSite: return @"Website";
    case KBRProofTypeKeybase: return @"Keybase";
    case KBRProofTypeRooter: return @"Rooter";
  }
}

