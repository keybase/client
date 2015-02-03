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

  BOOL errored = NO;
  NSColor *color = [KBLookAndFeel selectColor];
  NSString *info = nil;
  NSString *errorMessage = nil;

  if (!_proofResult.result) {
    // Loading the result
    color = [KBLookAndFeel disabledTextColor];
  } else {
    KBRTrackDiff *diff = proofResult.result.diff;
    if (diff) {
      switch (diff.type) {
        case KBRTrackDiffTypeNone:
          break;
        case KBRTrackDiffTypeError:
        case KBRTrackDiffTypeClash:
        case KBRTrackDiffTypeDeleted:
          info = diff.displayMarkup;
          color = [KBLookAndFeel errorColor];
          errored = YES;
          break;

        case KBRTrackDiffTypeUpgraded:
        case KBRTrackDiffTypeNew:
          color = [KBLookAndFeel greenColor];
          info = diff.displayMarkup;
          break;

        case KBRTrackDiffTypeRemoteFail:
        case KBRTrackDiffTypeRemoteChanged:
          info = diff.displayMarkup;
          color = [KBLookAndFeel warnColor];
          break;

        case KBRTrackDiffTypeRemoteWorking:
          info = diff.displayMarkup;
          break;
      }
    }

    if (_proofResult.result.proofStatus.status != 1) {
      color = [KBLookAndFeel errorColor];
      errored = YES;
      errorMessage = _proofResult.result.proofStatus.desc;
      info = @"status error";
    } else if (!_proofResult.result.hint.humanUrl) {
      // No link
      color = [KBLookAndFeel textColor];
    }
  }

  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:[NSFont systemFontOfSize:14]};
  NSMutableAttributedString *value = [[NSMutableAttributedString alloc] initWithString:proofResult.proof.value];
  [value setAttributes:attributes range:NSMakeRange(0, value.length)];

  if (errored) {
    [value addAttribute:NSStrikethroughStyleAttributeName value:@(YES) range:NSMakeRange(0, value.length)];
  }

  NSMutableAttributedString *result = [[NSMutableAttributedString alloc] init];
  [result appendAttributedString:value];

  if (info) {
    NSMutableAttributedString *infoStr = [[NSMutableAttributedString alloc] initWithString:info];
    [infoStr setAttributes:attributes range:NSMakeRange(0, infoStr.length)];

    [result appendAttributedString:[[NSAttributedString alloc] initWithString:@" (" attributes:attributes]];
    [result appendAttributedString:infoStr];
    [result appendAttributedString:[[NSAttributedString alloc] initWithString:@")" attributes:attributes]];
  }

  [self setAttributedTitle:result];
}

@end
