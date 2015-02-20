//
//  KBProofLabel.m
//  Keybase
//
//  Created by Gabriel on 1/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProofLabel.h"

@implementation KBProofLabel

+ (KBProofLabel *)labelWithProofResult:(KBProofResult *)proofResult editable:(BOOL)editable {
  KBProofLabel *button = [[KBProofLabel alloc] init];
  button.proofResult = proofResult;
  button.editable = editable;
  return button;
}

- (void)setProofResult:(KBProofResult *)proofResult {
  _proofResult = proofResult;

  BOOL errored = NO;
  NSColor *color = [KBAppearance.currentAppearance selectColor];
  NSString *info = nil;
  NSString *errorMessage = nil;

  if (!_proofResult.result) {
    // Loading the result
    color = [KBAppearance.currentAppearance disabledTextColor];
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
          color = [KBAppearance.currentAppearance errorColor];
          errored = YES;
          break;

        case KBRTrackDiffTypeUpgraded:
        case KBRTrackDiffTypeNew:
          color = [KBAppearance.currentAppearance greenColor];
          info = diff.displayMarkup;
          break;

        case KBRTrackDiffTypeRemoteFail:
        case KBRTrackDiffTypeRemoteChanged:
          info = diff.displayMarkup;
          color = [KBAppearance.currentAppearance warnColor];
          break;

        case KBRTrackDiffTypeRemoteWorking:
          info = diff.displayMarkup;
          break;
      }
    }

    if (_proofResult.result.proofStatus.status != 1) {
      color = [KBAppearance.currentAppearance errorColor];
      errored = YES;
      errorMessage = _proofResult.result.proofStatus.desc;
      info = NSStringWithFormat(@"error: %@", @(_proofResult.result.proofStatus.status));
    } else if (!_proofResult.result.hint.humanUrl) {
      // No link
      color = [KBAppearance.currentAppearance textColor];
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

  [self setAttributedTitle:result style:KBButtonStyleText];
}

@end
