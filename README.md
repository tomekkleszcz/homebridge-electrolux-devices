<p align="center">

<img src="images/logo.png" width="192">

</p>

# Homebridge Electrolux Devices

![NPM Downloads](https://img.shields.io/npm/dm/homebridge-electrolux-devices)
![NPM Version](https://img.shields.io/npm/v/homebridge-electrolux-devices)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/tomekkleszcz/homebridge-electrolux-devices/tests.yml?label=tests)

This is a plugin for connecting Electrolux/Frigidaire devices which are controlled by the [Electrolux](https://apps.apple.com/pl/app/electrolux/id1595816832) or [Frigidaire](https://apps.apple.com/us/app/frigidaire/id1599494923) app to Homekit.

## 🧰 Installation

1. Connect all your Electrolux devices to the app and ensure you are able to control them.
2. Install this plugin using the `npm install -g homebridge-electrolux-devices` command
3. Open the Electrolux for Developers Dashboard here: https://developer.electrolux.one/login
4. Sign in using your credentials from the Electrolux app
5. Create new API Key and enter it in the plugin's configuration
6. Generate new token under "Authorization" section
7. Copy the Refresh Token and paste it in the plugin's configuration.
8. Run the plugin :) The refresh token you generate expires in ~12h, so please make sure you enter a fresh one into the plugin's configuration. After you set it once, the plugin will handle token refresh for you automatically.

## 🌡️ Supported devices

### ❄️ Air conditioners

- Electrolux Comfort 600
- Frigidaire Gallery Inverter Window Room

### 🌬️ Air purifiers

- Electrolux Well A5/AX 5
- Electrolux Well A7
- Electrolux Pure A9/AX 9
- Electrolux UltimateHome 500

If your device is not on the list, please create the issue. I'll be more than happy to implement the support for your device. 😄

## 🐛 Known issues

### Air conditioners

When air conditioner is set to Auto mode the maximum range value is set to 32, and the target temperature is set by changing minimum range value. If someone knows how to disable the temperature range in Auto mode, and allow to set the target temperature the same way as in Cool and Heat mode the PR will be more than welcome. :)
