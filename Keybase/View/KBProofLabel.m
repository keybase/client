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
  NSString *trackInfo = nil;

  if (!_proofResult.result) {
    // Loading the result
    color = [KBLookAndFeel disabledTextColor];
  } else {
    KBRTrackDiff *diff = proofResult.result.diff;
    switch (diff.type) {
      case KBRTrackDiffTypeNone:
        break;
      case KBRTrackDiffTypeError:
      case KBRTrackDiffTypeClash:
      case KBRTrackDiffTypeDeleted:
        trackInfo = diff.displayMarkup;
        color = [KBLookAndFeel errorColor];
        errored = YES;
        break;

      case KBRTrackDiffTypeUpgraded:
      case KBRTrackDiffTypeNew:
        color = [KBLookAndFeel greenColor];
        trackInfo = diff.displayMarkup;
        break;

      case KBRTrackDiffTypeRemoteFail:
      case KBRTrackDiffTypeRemoteChanged:
        trackInfo = diff.displayMarkup;
        color = [KBLookAndFeel warnColor];
        break;

      case KBRTrackDiffTypeRemoteWorking:
        trackInfo = diff.displayMarkup;
        break;
    }

    // What about _proofResult.result.proofStatus.status?
  }


  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:[NSFont systemFontOfSize:14]};
  NSMutableAttributedString *value = [[NSMutableAttributedString alloc] initWithString:proofResult.proof.value];
  [value setAttributes:attributes range:NSMakeRange(0, value.length)];

  if (errored) {
    [value addAttribute:NSStrikethroughStyleAttributeName value:@(YES) range:NSMakeRange(0, value.length)];
  }

  NSMutableAttributedString *result = [[NSMutableAttributedString alloc] init];
  [result appendAttributedString:value];

  if (trackInfo) {
    NSMutableAttributedString *info = [[NSMutableAttributedString alloc] initWithString:trackInfo];
    [info setAttributes:attributes range:NSMakeRange(0, info.length)];

    [result appendAttributedString:[[NSAttributedString alloc] initWithString:@" (" attributes:attributes]];
    [result appendAttributedString:info];
    [result appendAttributedString:[[NSAttributedString alloc] initWithString:@")" attributes:attributes]];
  }

  [self setAttributedTitle:result];
}

@end
