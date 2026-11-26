# My Finance

A private-first Expo and React Native finance tracker for managing a monthly budget, savings, installments, investments, and optional AI financial analysis.

The app is designed primarily for Egyptian pounds (EGP) and supports stocks, gold, silver, and savings balances. All entered financial data is stored on the user's device.

## Features

- **Dashboard:** monthly income, spending allowance, remaining allowance, installment obligations, savings, investments, debt, and net worth
- **Expenses:** category-based expense tracking and a monthly spending summary
- **Savings:** multiple savings pools, deposits and withdrawals, annual yield estimates, and 30-day earnings projections
- **Installments:** payment plans, remaining balances, due dates, and monthly progress
- **Portfolio:** stock, gold, and silver holdings with average cost, quantity, realized and unrealized profit/loss, dividends, target, and stop-loss
- **AI assistant:** chat using Anthropic Claude or Google Gemini, with optional web search for market prices and savings yields
- **Sample data:** one-click sample portfolio and budget data for testing

## Tech stack

- Expo SDK 58
- React Native 0.88
- React 19
- Expo Router
- TypeScript
- AsyncStorage
- Expo SecureStore

## Project structure

```text
src/app/          Expo Router screens and tab navigation
src/components/   Reusable UI components
src/constants/    Theme constants
src/hooks/        React hooks
src/store.tsx     Financial state types and device persistence
src/calc.ts       Portfolio and savings calculations
src/ai.ts         Claude/Gemini chat and research integration
src/sample.ts     Local sample data
src/ui.tsx        Shared mobile UI primitives
assets/           App icons and images
app.json          Expo app configuration
eas.json          EAS build and submit profiles
```

## Data and privacy

- Financial records are saved locally in AsyncStorage.
- API keys are saved separately in Expo SecureStore on the device.
- Chats are saved locally in AsyncStorage.
- The app does not include a backend or cloud database.
- When AI chat is used, a generated summary of the user's financial snapshot and chat messages are sent directly to the selected provider.
- AI provider usage may be billed by the provider and is subject to that provider's privacy and data policies.
- API keys should be created by each user. Never commit or share them.
- Loaded sample data contains fictional examples only.
- Price and yield searches use public or provider web-search features and should be checked before use.

## Requirements

- Node.js 20 or newer
- npm
- Expo CLI through `npx expo`
- Android Studio/emulator, Xcode/simulator, or Expo Go

Some native setup and platform behavior may require a development build rather than Expo Go.

## Setup

1. Clone the repository and enter the project directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start Expo:

   ```bash
   npx expo start
   ```

4. Open the app on an emulator, simulator, device, or web browser.

No environment variables or server credentials are required to run the basic app.

## AI setup

1. Open the **AI** tab.
2. Choose **Claude** or **Gemini**.
3. In Settings, paste an API key created from the selected provider's console.
4. Save the key and choose a model.

Claude keys are created in the Anthropic console. Gemini keys are created in Google AI Studio.

The key is stored only on the user's device. The app sends a finance snapshot to the provider when the user sends an AI message.

## Commands

```bash
npx expo start       # start the development server
npx expo start --android
npx expo start --ios
npx expo start --web
npm run lint         # run Expo lint
npx tsc --noEmit     # run TypeScript checking
```

## EAS builds

The repository includes preview, development, and production build profiles:

```bash
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile development --platform android
npx eas-cli build --profile production --platform all
```

Before creating builds, configure the app with an EAS project of your own:

```bash
npx eas-cli init
npx eas-cli build:configure
```

Signing keys, credentials, and account-specific EAS configuration must remain outside source control.

## Calculations

- Savings: a base balance grows daily using the configured annual yield and an approximate 365-day year.
- Portfolio cost basis: buys, quantities, and fees are averaged by share or unit.
- Unrealized profit/loss: current value minus remaining cost basis.
- Realized profit/loss: sells minus fees and the cost basis of sold quantities.
- Installments: remaining balance is unpaid months multiplied by the monthly payment.
- Net worth: savings plus investment value minus remaining installment debt.

These values are estimates and are not financial advice.

## Before making the repository public

Check the repository for local credentials and account-specific files:

```bash
git --no-pager grep -n -E '(BEGIN .*PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|api[_-]?key|password|client[_-]?secret)'
git --no-pager status --short
```

Also review Git history before publishing. The repository should not contain `.env`, signing keys, provisioning files, private certificates, real API keys, or real personal financial data.

## Contributing

Contributions are welcome. Please keep API keys and personal financial data out of commits. Run lint and TypeScript checks before submitting changes.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
