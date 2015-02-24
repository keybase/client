//
//  KBSearchResultView.m
//  Keybase
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearchResultView.h"

@interface KBSearchResultView ()
@end

@implementation KBSearchResultView

- (void)setSearchResult:(KBSearchResult *)searchResult {
  [self.titleLabel setText:searchResult.userName style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self.descriptionLabel setAttributedText:[self attributedStringForSearchResult:searchResult] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self.imageView setURLString:searchResult.thumbnailURLString];
  self.imageView.roundedRatio = 0.5;
  self.imageSize = CGSizeMake(40, 40);
  [self setNeedsLayout];
}

- (NSMutableAttributedString *)attributedStringForSearchResult:(KBSearchResult *)searchResult {
  NSMutableArray *strings = [NSMutableArray array];
  if (searchResult.fullName) {
    [strings addObject:[[NSAttributedString alloc] initWithString:searchResult.fullName attributes:@{NSForegroundColorAttributeName: KBAppearance.currentAppearance.textColor, NSFontAttributeName: KBAppearance.currentAppearance.smallTextFont}]];
  }
  if (searchResult.twitter) {
    [strings addObject:[[NSAttributedString alloc] initWithString:NSStringWithFormat(@"%@@twitter", searchResult.twitter) attributes:@{NSForegroundColorAttributeName: KBAppearance.currentAppearance.secondaryTextColor, NSFontAttributeName: KBAppearance.currentAppearance.smallTextFont}]];
  }

  return [KBLabel join:strings delimeter:[[NSAttributedString alloc] initWithString:@" • "]];
}

@end
