//
//  KBProofsView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBUser.h"

typedef void (^KBProofSelectBlock)(KBProofType proofType, KBProof *proof);

@interface KBProofsView : KBView

- (void)setUser:(KBUser *)user editableTypes:(NSSet *)editableTypes;

+ (NSArray *)labelsForUser:(KBUser *)user editableTypes:(NSSet *)editableTypes targetBlock:(KBProofSelectBlock)targetBlock;

@end
