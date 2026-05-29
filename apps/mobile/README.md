# Welcome to your new ignited app!

> The latest and greatest boilerplate for Infinite Red opinions

This is the boilerplate that [Infinite Red](https://infinite.red) uses as a way to test bleeding-edge changes to our React Native stack.

- [Quick start documentation](https://github.com/infinitered/ignite/blob/master/docs/boilerplate/Boilerplate.md)
- [Full documentation](https://github.com/infinitered/ignite/blob/master/docs/README.md)

## Getting Started

```bash
cp .env.example .env
pnpm install
pnpm run start
```

Configure backend endpoints in `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.37.85:8000
EXPO_PUBLIC_MARKET_DATA_URL=http://192.168.37.85:8000
```

For real devices, use your machine's LAN IP instead of `localhost`.

## UI Stack (Tamagui + NativeWind Transition)

This app is migrating to a Tamagui-first design system while keeping NativeWind in
place for incremental compatibility.

- Tamagui foundation:
  - `src/design-system/tamagui/tamagui.config.ts`
  - `src/core/providers/AppProviders.tsx` (`TamaguiProvider` + app providers)
  - `babel.config.js` (optional Tamagui Babel plugin activation when installed)
- Existing NativeWind compatibility (temporary during migration):
  - `global.css`
  - `tailwind.config.js`
  - `metro.config.js` (`withNativeWind`)

## App Structure (MetaMask-Inspired)

The app now follows a cleaner module shape inspired by MetaMask's separation of
core runtime concerns vs feature code:

- `src/core/`: app-level providers and runtime wiring
- `src/design-system/`: tokens, themes, shared UI system configuration
- `src/features/`: feature modules with route-facing screens and logic

Current reference migration:

- Home route wrapper: `app/(tabs)/home.tsx`
- Feature implementation: `src/features/home/screens/HomeTabScreen.tsx`

To make things work on your local simulator, or on your phone, you need first to [run `eas build`](https://github.com/infinitered/ignite/blob/master/docs/expo/EAS.md). We have many shortcuts on `package.json` to make it easier:

```bash
pnpm run build:ios:sim # build for ios simulator
pnpm run build:ios:device # build for ios device
pnpm run build:ios:prod # build for ios device
```

### `./assets`

This directory is designed to organize and store various assets, making it easy for you to manage and use them in your application. The assets are further categorized into subdirectories, including `icons` and `images`:

```tree
assets
├── icons
└── images
```

**icons**
This is where your icon assets will live. These icons can be used for buttons, navigation elements, or any other UI components. The recommended format for icons is PNG, but other formats can be used as well.

Ignite comes with a built-in `Icon` component. You can find detailed usage instructions in the [docs](https://github.com/infinitered/ignite/blob/master/docs/boilerplate/app/components/Icon.md).

**images**
This is where your images will live, such as background images, logos, or any other graphics. You can use various formats such as PNG, JPEG, or GIF for your images.

Another valuable built-in component within Ignite is the `AutoImage` component. You can find detailed usage instructions in the [docs](https://github.com/infinitered/ignite/blob/master/docs/Components-AutoImage.md).

How to use your `icon` or `image` assets:

```typescript
import { Image } from 'react-native';

const MyComponent = () => {
  return (
    <Image source={require('assets/images/my_image.png')} />
  );
};
```

## Running Maestro end-to-end tests

Follow our [Maestro Setup](https://ignitecookbook.com/docs/recipes/MaestroSetup) recipe.

## Next Steps

### Ignite Cookbook

[Ignite Cookbook](https://ignitecookbook.com/) is an easy way for developers to browse and share code snippets (or “recipes”) that actually work.

### Upgrade Ignite boilerplate

Read our [Upgrade Guide](https://ignitecookbook.com/docs/recipes/UpdatingIgnite) to learn how to upgrade your Ignite project.

## Community

⭐️ Help us out by [starring on GitHub](https://github.com/infinitered/ignite), filing bug reports in [issues](https://github.com/infinitered/ignite/issues) or [ask questions](https://github.com/infinitered/ignite/discussions).

💬 Join us on [Slack](https://join.slack.com/t/infiniteredcommunity/shared_invite/zt-1f137np4h-zPTq_CbaRFUOR_glUFs2UA) to discuss.

📰 Make our Editor-in-chief happy by [reading the React Native Newsletter](https://reactnativenewsletter.com/).
