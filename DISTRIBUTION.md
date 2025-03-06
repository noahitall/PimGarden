# Contact Manager - Distribution Guide

This document provides instructions for preparing, building, and submitting the Contact Manager app to app stores.

## Prerequisites

Before you begin the distribution process, ensure you have:

1. An Apple Developer account (for iOS distribution)
2. A Google Play Developer account (for Android distribution)
3. Expo Application Services (EAS) set up
4. Proper app signing credentials

## Configuration Checklist

- [ ] Update app metadata in `app.json`
- [ ] Configure feature flags for production in `src/config/FeatureFlags.ts`
- [ ] Test the app thoroughly in production mode
- [ ] Check all permissions are correctly configured
- [ ] Ensure app icons and splash screens are high quality
- [ ] Update version numbers for both platforms

## Building for Distribution

### Setting Up EAS

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Log in to your Expo account:
   ```bash
   eas login
   ```

3. Configure your project:
   ```bash
   eas build:configure
   ```

### Building Preview Versions

For internal testing or beta distribution:

```bash
npm run build:preview
```

This will create:
- For iOS: An IPA file that can be installed via TestFlight
- For Android: An APK file that can be installed directly on devices

### Building Production Versions

For app store submissions:

```bash
npm run build:production
```

This will create:
- For iOS: An IPA file ready for App Store submission
- For Android: An AAB (Android App Bundle) for Google Play submission

## Submitting to App Stores

### iOS App Store

1. Ensure your Apple Developer account is active
2. Set up your app in App Store Connect
3. Submit the build using:
   ```bash
   npm run submit:production -- --platform ios
   ```

### Google Play Store

1. Create your app listing in the Google Play Console
2. Set up your service account and download the key
3. Update the path to your service account key in `eas.json`
4. Submit the build using:
   ```bash
   npm run submit:production -- --platform android
   ```

## Over-the-Air Updates

After your app is in the stores, you can push updates without waiting for store approvals:

1. Make your changes to the app
2. Run:
   ```bash
   npm run update
   ```

This will publish an update that users will receive next time they open the app.

## Feature Flags in Production

The app uses a feature flag system to control which features are enabled. For production builds:

1. Development features like the debug button are disabled by default
2. Stable features are enabled
3. Users can toggle features from the Settings screen
4. Feature preferences are stored in AsyncStorage

## Troubleshooting

### Common Issues

- **iOS Provisioning Profile Issues**: Make sure your bundle identifier matches what's in your Apple Developer account
- **Android Signing Issues**: Verify your keystore information is correct
- **Missing Permissions**: Ensure all required permissions are declared in `app.json`
- **App Rejection**: Review app store guidelines for common rejection reasons

### Support Resources

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Guidelines](https://play.google.com/about/developer-content-policy/)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0   | TBD  | Initial release | 