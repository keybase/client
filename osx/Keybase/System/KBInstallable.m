//
//  KBInstallable.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallable.h"

NSString *NSStringFromKBInstallStatus(KBInstallStatus status) {
  switch (status) {
    case KBInstallStatusError: return @"Install Error";
    case KBInstallStatusNotInstalled: return @"Not Installed";
    case KBInstallStatusNeedsUpgrade: return @"Needs Upgrade";
    case KBInstallStatusInstalledNotRunning: return @"Installed, Not Running";
    case KBInstallStatusInstalled: return @"Installed";
  }
}
