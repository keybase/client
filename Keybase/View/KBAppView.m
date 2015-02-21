//
//  KBAppView.m
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppView.h"

#import "KBUsersAppView.h"
#import "KBUserProfileView.h"
#import "AppDelegate.h"

@interface KBAppView ()
@property KBSourceView *sourceView;
@property KBBox *border;

@property (nonatomic) NSView *contentView;
@property KBUsersAppView *usersMainView;

@property KBUserProfileView *userProfileView;
@end

@implementation KBAppView

- (void)viewInit {
  [super viewInit];

  _sourceView = [[KBSourceView alloc] init];
  _sourceView.delegate = self;
  [self addSubview:_sourceView];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 150;
    [layout setFrame:CGRectMake(0, 0, col1 - 1, size.height) view:yself.sourceView];
    [layout setFrame:CGRectMake(col1 - 1, 0, 1, size.height) view:yself.border];
    [layout setFrame:CGRectMake(col1, 0, size.width - col1, size.height) view:yself.contentView];
    return size;
  }];
}

- (void)setContentView:(NSView *)contentView {
  [_contentView removeFromSuperview];
  _contentView = contentView;
  if (_contentView) {
    [self addSubview:_contentView];
    [self setNeedsLayout];
  }
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_sourceView setProgressEnabled:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _sourceView.isProgressEnabled;
}

- (void)showUsers {
  if (!_usersMainView) _usersMainView = [[KBUsersAppView alloc] init];
  [_usersMainView setUser:_user];
  [self setContentView:_usersMainView];
}

- (void)showProfile {
  NSAssert(_user, @"No user");
  _userProfileView = [[KBUserProfileView alloc] init];
  [_userProfileView setUser:_user editable:YES];
  [self setContentView:_userProfileView];
}

- (void)logout {
  [KBAlert promptWithTitle:@"Log Out" description:@"Are you sure you want to log out?" style:NSInformationalAlertStyle buttonTitles:@[@"Yes, Log Out", @"No"] view:self completion:^(NSModalResponse response) {
    if (response == NSAlertFirstButtonReturn) {
      [self setProgressEnabled:YES];
      KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:AppDelegate.client];
      [login logout:^(NSError *error) {
        [self setProgressEnabled:NO];
        if (error) {
          [AppDelegate setError:error sender:self];
          return;
        }

        [AppDelegate.sharedDelegate checkStatus];
      }];
    }
  }];
}

- (void)setUser:(KBRUser *)user {
  _user = user;
  [self setContentView:nil];
}

- (void)sourceView:(KBSourceView *)sourceView didSelectItem:(KBSourceViewItem)item {
  switch (item) {
    case KBSourceViewItemDevices:
      [self setContentView:nil];
      break;
    case KBSourceViewItemFolders:
      [self setContentView:nil];
      break;
    case KBSourceViewItemProfile:
      [self showProfile];
      break;
    case KBSourceViewItemUsers:
      [self showUsers];
      break;
  }
}

- (NSWindow *)createWindow {
  NSAssert(!self.superview, @"Already has superview");
  NSWindow *window = [KBWindow windowWithContentView:self size:CGSizeMake(800, 500) retain:YES];
  window.minSize = CGSizeMake(600, 400);
  //window.restorable = YES;
  window.delegate = self;
  //window.maxSize = CGSizeMake(600, 900);
  window.titleVisibility = NO;
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSMiniaturizableWindowMask;

  window.restorable = YES;
  window.restorationClass = self.class;
  //window.navigation.titleView = [KBTitleView titleViewWithTitle:@"Keybase" navigation:window.navigation];
  //[window setLevel:NSStatusWindowLevel];
  return window;
}

- (void)openWindow {
  if (self.window) {
    [self.window makeKeyAndOrderFront:nil];
    return;
  }

  NSWindow *window = [self createWindow];
  [window center];
  [window makeKeyAndOrderFront:nil];
}

//- (void)encodeRestorableStateWithCoder:(NSCoder *)coder { }
//- (void)restoreStateWithCoder:(NSCoder *)coder { }
//invalidateRestorableState

//+ (void)restoreWindowWithIdentifier:(NSString *)identifier state:(NSCoder *)state completionHandler:(void (^)(NSWindow *window, NSError *error))completionHandler {
//  KBAppView *appView = [[KBAppView alloc] init];
//  NSWindow *window = [appView createWindow];
//  completionHandler(window, nil);
//}

@end
