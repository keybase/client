//
//  KBRProveType.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

NSString *KBServiceNameForProveType(KBRProofType proveType);
KBRProofType KBRProofTypeForServiceName(NSString *serviceName);
KBRProofType KBRProofTypeFromAPI(NSInteger proofType);

NSString *KBImageNameForProveType(KBRProofType proveType);
NSString *KBShortNameForProveType(KBRProofType proveType);
NSString *KBNameForProveType(KBRProofType proveType);

