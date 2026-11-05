# Nepal Flood & Vibration Monitoring Website

A mobile-friendly dashboard for the school prototype using:
- One Arduino Uno
- Three HC-SR04 ultrasonic sensors
- One analogue rain sensor
- One SW-420 vibration sensor
- One nRF24L01+ link
- One ESP8266 NodeMCU
- Render hosting

## Project files

- `server.js` — Express API and static website server
- `public/index.html` — dashboard structure
- `public/style.css` — responsive dashboard styling
- `public/app.js` — live dashboard updates
- `render.yaml` — Render deployment configuration

## 1. Create an API key

Create a long random secret string. Example format only:

`replace-this-with-a-long-random-secret`

Use your own value. Do not publish it in a public GitHub repository.

## 2. Upload to GitHub

Create a new GitHub repository. Upload all files and folders while preserving the structure.

## 3. Deploy on Render

1. Sign in to Render.
2. Choose **New +** → **Blueprint** (or create a Web Service).
3. Connect your GitHub repository.
4. If using Blueprint, Render reads `render.yaml`.
5. Add the environment variable `API_KEY` with your secret value.
6. Keep `WARNING_LEVEL_CM` and `DANGER_LEVEL_CM` matched to your ESP8266 flood thresholds.
7. Deploy.

For a manual Web Service:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

## 4. Configure ESP8266

In `esp8266_receiver.ino`, set:

- `WIFI_SSID` to your Wi-Fi name
- `WIFI_PASSWORD` to your Wi-Fi password
- `SERVER_URL` to `https://YOUR-SERVICE.onrender.com/api/telemetry`
- `API_KEY` to exactly the same value configured in Render

Do not upload your Wi-Fi password or API key to a public GitHub repository. For a public repository, keep secrets out of committed source files and use a private repository or a safer provisioning method.

## 5. Match flood thresholds

The sample ESP8266 code uses:
- Warning: 4 cm
- Critical: 6 cm

The website uses the Render variables `WARNING_LEVEL_CM` and `DANGER_LEVEL_CM`. Keep these values identical. Calibrate them for your miniature channel before testing.

## 6. Test

1. Deploy the website.
2. Open `https://YOUR-SERVICE.onrender.com`.
3. Power the Arduino and ESP8266.
4. Open the ESP8266 Serial Monitor at 9600 baud.
5. Confirm `Server response: 200`.
6. Check that the website changes from DEVICE OFFLINE to DEVICE ONLINE.

## Important limitations

- The server keeps recent readings and event history in memory. They reset when the Render service restarts or redeploys. This starter project does not include a permanent database.
- On Render's free web service, the service may sleep when idle; the first request can take time to wake it.
- The SW-420 detects vibration, not earthquakes. It cannot identify an earthquake or estimate magnitude.
- The rain sensor's analogue output is a raw 0–1023 value, not rainfall in millimetres.
- This is an educational prototype, not a real emergency warning system.
