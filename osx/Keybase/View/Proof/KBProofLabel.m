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

  BOOL erroredHard = NO;
  BOOL erroredTrack = NO;

  NSColor *color = (self.editable ? KBAppearance.currentAppearance.selectColor : KBAppearance.currentAppearance.textColor);
  NSString *label = nil;
  NSString *message = nil;

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
          label = diff.displayMarkup;
          color = [KBAppearance.currentAppearance errorColor];
          erroredTrack = YES;
          break;

        case KBRTrackDiffTypeUpgraded:
        case KBRTrackDiffTypeNew:
          color = [KBAppearance.currentAppearance greenColor];
          label = diff.displayMarkup;
          break;

        case KBRTrackDiffTypeRemoteFail:
        case KBRTrackDiffTypeRemoteChanged:
          label = diff.displayMarkup;
          color = [KBAppearance.currentAppearance warnColor];
          break;

        case KBRTrackDiffTypeRemoteWorking:
          label = diff.displayMarkup;
          break;
      }
    }

    if (_proofResult.result.proofStatus.status != 1) {
      message = NSStringWithFormat(@"%@ (%@)", _proofResult.result.proofStatus.desc, @(_proofResult.result.proofStatus.status));
      if (_proofResult.result.proofStatus.status < 200) {
        color = KBAppearance.currentAppearance.warnColor;
      } else {
        color = KBAppearance.currentAppearance.errorColor;
        erroredHard = YES;
      }
    } else if (!_proofResult.result.hint.humanUrl) {
      // No link
      color = [KBAppearance.currentAppearance textColor];
    }
  }

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = NSLeftTextAlignment;
  paragraphStyle.lineBreakMode = NSLineBreakByWordWrapping;
  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:[KBAppearance.currentAppearance fontForStyle:KBTextStyleDefault options:0], NSParagraphStyleAttributeName:paragraphStyle};

  NSMutableAttributedString *value = [[NSMutableAttributedString alloc] initWithString:proofResult.proof.value];
  [value setAttributes:attributes range:NSMakeRange(0, value.length)];

  if (erroredHard || erroredTrack) {
    [value addAttribute:NSStrikethroughStyleAttributeName value:@(YES) range:NSMakeRange(0, value.length)];
  }

  NSMutableAttributedString *result = [[NSMutableAttributedString alloc] init];
  [result appendAttributedString:value];

  if (label) {
    NSMutableAttributedString *infoStr = [[NSMutableAttributedString alloc] initWithString:NSStringWithFormat(@" (%@)", label)];
    [infoStr setAttributes:attributes range:NSMakeRange(0, infoStr.length)];
    [result appendAttributedString:infoStr];
  }

  if (message) {
    NSAttributedString *errorStr = [[NSAttributedString alloc] initWithString:NSStringWithFormat(@"\n(%@)", message) attributes:attributes];
    [result appendAttributedString:errorStr];
  }

  self.attributedText = result;
}

@end
