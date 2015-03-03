//
//  KBLabelRow.m
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabelRow.h"
#import "KBAppearance.h"

@interface KBLabelRow ()
@property (nonatomic) KBLabel *label;
@end

@implementation KBLabelRow

- (void)layout {
  [super layout];
  _label.frame = CGRectMake(16, 0, self.frame.size.width - 16, self.frame.size.height);
}

- (KBLabel *)label {
  if (!_label) {
    _label = [[KBLabel alloc] init];
    [self addSubview:_label];
  }
  return _label;
}

//- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
//  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
//  [_label setStyle:KBLabelStyleDefault appearance:appearance];
//}

@end
