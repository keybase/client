//
//  KBProveType.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBProveType) {
  KBProveTypeUnknown,
  KBProveTypeTwitter,
  KBProveTypeGithub,
  KBProveTypeReddit,
  KBProveTypeCoinbase,
  KBProveTypeHackernews,
  KBProveTypeHTTPS,
  KBProveTypeDNS,
};
NSString *KBServiceNameForProveType(KBProveType proveType);
KBProveType KBProveTypeForServiceName(NSString *serviceName);
KBProveType KBProveTypeFromAPI(NSInteger proofType);

NSString *KBImageNameForProveType(KBProveType proveType);
NSString *KBShortNameForProveType(KBProveType proveType);
NSString *KBNameForProveType(KBProveType proveType);

