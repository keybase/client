//
//  KBProveType.h
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

NSString *KBServiceNameForProofType(KBRProofType proofType);
KBRProofType KBRProofTypeForServiceName(NSString *serviceName);

NSString *KBImageNameForProofType(KBRProofType proofType);
NSString *KBShortNameForProofType(KBRProofType proofType);
NSString *KBNameForProofType(KBRProofType proofType);

