//
//  KBUserButtonView.m
//  Keybase
//
//  Created by Gabriel on 4/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserButtonView.h"

#import "KBUserImageView.h"

@interface KBUserButtonView ()
@property KBUserImageView *imageView;
@property KBLabel *nameLabel;

@property (nonatomic) KBRUser *user;
@end

@implementation KBUserButtonView

- (void)viewInit {
  [super viewInit];

  YOView *view = [YOView view];
  _imageView = [[KBUserImageView alloc] init];
  [view addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [_nameLabel kb_setBackgroundColor:NSColor.clearColor];
  [view addSubview:_nameLabel];

  YOSelf yself = self;
  view.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 5;
    CGFloat imageHeight = size.height > 0 ? size.height - 10 : 40;

    x += [layout setFrame:CGRectMake(x, y, imageHeight, imageHeight) view:yself.imageView].size.width + 10;

    CGSize textSize = [yself.nameLabel sizeThatFits:size];
    x += [layout centerWithSize:CGSizeMake(textSize.width, 0) frame:CGRectMake(x, 0, textSize.width, size.height) view:yself.nameLabel].size.width + 10;

    return CGSizeMake(x, size.height);
  }];

  [self setView:view];
}

- (void)refresh {
  [self setUser:_user];
}

- (void)setUser:(KBRUser *)user {
  _user = user;

  [_nameLabel setMarkup:NSStringWithFormat(@"<thin>keybase.io/</thin>%@", user.username) font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  self.imageView.username = user.username;

  [self setNeedsLayout];
}


@end

