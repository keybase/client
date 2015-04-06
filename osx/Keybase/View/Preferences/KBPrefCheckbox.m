//
//  KBPrefCheckbox.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefCheckbox.h"

@interface KBPrefCheckbox ()
@property KBButton *button;
@end

@implementation KBPrefCheckbox

- (void)viewInit {
  [super viewInit];

  _button = [KBButton button];
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(130, y, size.width - 150, 0) view:yself.button].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (void)dealloc {
  [_button removeObserver:self forKeyPath:@"cell.state"];
}

- (void)setLabelText:(NSString *)labelText identifier:(NSString *)identifier {
  [_button setText:labelText style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  self.identifier = identifier;
  _button.state = [[self.preferences valueForIdentifier:identifier] boolValue] ? NSOnState : NSOffState;
  [_button addObserver:self forKeyPath:@"cell.state" options:(NSKeyValueObservingOptionNew | NSKeyValueObservingOptionOld) context:NULL];

  [self setNeedsLayout];
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
  BOOL value = [object state] == NSOnState;
  [self.preferences setValue:@(value) forKey:self.identifier];
}

@end
