//
//  KBUserView.m
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserView.h"

@interface KBUserView ()
@property KBImageView *imageView;
@property KBLabel *nameLabel;
//@property KBLabel *descriptionLabel;
@property KBBox *border;
@end

@implementation KBUserView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  [self.layer setBackgroundColor:NSColor.clearColor.CGColor];

  _imageView = [[KBImageView alloc] init];
  _imageView.roundedRatio = 1.0;
  [self addSubview:self.imageView];

  _nameLabel = [[KBLabel alloc] init];
  _nameLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_nameLabel];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

//  self.descriptionLabel = [[KBLabel alloc] init];
//  [self addSubview:self.descriptionLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;

    [layout setFrame:CGRectMake(x, y, 40, 40) view:yself.imageView];
    x += 50;

    y += [layout setFrame:CGRectMake(x, y, size.width - x, 40) view:yself.nameLabel].size.height;
    //y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 30) view:yself.descriptionLabel].size.height + 10;

    if (y < 60) y = 60;

    [layout setFrame:CGRectMake(0, y - 0.5, size.width, 1) view:yself.border];
    return CGSizeMake(size.width, y);
  }];
}

- (void)setUser:(KBRUser *)user {
  [self.nameLabel setText:user.username font:[NSFont boldSystemFontOfSize:16] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];

//  NSMutableArray *strings = [NSMutableArray array];
//  [strings addObject:[[NSAttributedString alloc] initWithString:user.fullName attributes:@{NSForegroundColorAttributeName: [KBAppearance.currentAppearance textColor], NSFontAttributeName: [NSFont systemFontOfSize:15]}]];
//
//  NSString *twitter = [[[user proofsForType:KBProofTypeTwitter] gh_firstObject] displayName];
//  if (twitter) {
//    [strings addObject:[[NSAttributedString alloc] initWithString:NSStringWithFormat(@"@%@", twitter) attributes:@{NSForegroundColorAttributeName: [KBAppearance.currentAppearance textColor], NSFontAttributeName: [NSFont systemFontOfSize:15]}]];
//  }
//
//  _descriptionLabel.attributedText = [KBLabel join:strings delimeter:[[NSAttributedString alloc] initWithString:@" • "]];

  self.imageView.URLString = user.image.url;
  [self setNeedsLayout];
}

@end
