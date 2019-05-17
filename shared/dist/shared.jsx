"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Styles = require("../styles");
const services = {
    contact: {
        color: '#000',
        icon: 'iconfont-identity-twitter',
        label: 'Your contacts',
    },
    facebook: {
        color: '#3B5998',
        icon: 'iconfont-identity-facebook',
        label: 'Facebook',
    },
    github: {
        color: '#333',
        icon: 'iconfont-identity-github',
        label: 'GitHub',
    },
    hackernews: {
        color: '#FF6600',
        icon: 'iconfont-identity-hn',
        label: 'Hacker News',
    },
    keybase: {
        color: '#4C8EFF',
        icon: 'iconfont-keybase',
        label: 'Keybase',
    },
    pgp: {
        color: '#000',
        icon: 'iconfont-identity-pgp',
        label: 'PGP',
    },
    reddit: {
        color: '#ff4500',
        icon: 'iconfont-identity-reddit',
        label: 'Reddit',
    },
    twitter: {
        color: '#1DA1F2',
        icon: 'iconfont-identity-twitter',
        label: 'Twitter',
    },
};
const serviceIdToAccentColor = (service) => services[service].color;
exports.serviceIdToAccentColor = serviceIdToAccentColor;
const serviceIdToIconFont = (service) => services[service].icon;
exports.serviceIdToIconFont = serviceIdToIconFont;
const serviceIdToLabel = (service) => services[service].label;
exports.serviceIdToLabel = serviceIdToLabel;
const inactiveServiceAccentColor = Styles.globalColors.black_50;
exports.inactiveServiceAccentColor = inactiveServiceAccentColor;
//# sourceMappingURL=shared.jsx.map