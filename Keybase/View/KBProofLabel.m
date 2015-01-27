//
//  KBProofLabel.m
//  Keybase
//
//  Created by Gabriel on 1/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProofLabel.h"

@implementation KBProofLabel

+ (KBProofLabel *)labelWithProofResult:(KBProofResult *)proofResult {
  KBProofLabel *button = [[KBProofLabel alloc] init];
  button.proofResult = proofResult;
  return button;
}

- (void)setProofResult:(KBProofResult *)proofResult {
  _proofResult = proofResult;
  self.bordered = NO;

  NSColor *color = [KBLookAndFeel disabledTextColor];
  if (_proofResult.result) {
    if (_proofResult.result.proofStatus.status == 1) {
      color = [KBLookAndFeel selectColor];
    } else {
      color = [KBLookAndFeel warnColor];
    }
  }

  [self setText:proofResult.proof.value font:[NSFont systemFontOfSize:20] color:color alignment:NSLeftTextAlignment];
}

@end
