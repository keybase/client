//
//  KBUserProfileView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserProfileView.h"

#import "KBUserHeaderView.h"
#import "KBProofsView.h"
#import "AppDelegate.h"

@interface KBUserProfileView ()
@property KBUserHeaderView *headerView;
//@property KBProofsView *proofsView;
@end

@implementation KBUserProfileView

- (void)viewInit {
  _headerView = [[KBUserHeaderView alloc] init];
  [self addSubview:_headerView];
  //_proofsView = [[KBProofsView alloc] init];
  //[self addSubview:_proofsView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width, 0) view:yself.headerView].size.height;
    //y += [layout setFrame:CGRectMake(x, y, size.width, 0) view:yself.proofsView sizeToFit:YES].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)loadUID:(NSString *)UID {
  [AppDelegate.APIClient userForKey:@"uids" value:UID fields:nil success:^(KBUser *user) {
    [self setUser:user];
  } failure:^(NSError *error) {
    [self setError:error];
  }];
}

- (void)setUser:(KBUser *)user {
  [_headerView setUser:user];
  //[_proofsView setUser:user editableTypes:[NSSet setWithArray:@[@(KBProofTypeTwitter), @(KBProofTypeGithub), @(KBProofTypeHackerNews)]]];

  [self setNeedsLayout];
}

@end
