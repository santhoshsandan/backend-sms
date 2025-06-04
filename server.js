const mqtt = require("mqtt");
const https = require("https");
const http = require("http");
require("dotenv").config();

const MQTT_BROKER = "mqtt://test.mosquitto.org";
const MQTT_TOPIC = "devices/esp01/get/data";

const MSG91_AUTH_KEY = "445101Au92RrY4683eab53P1";
const TEMPLATE_ID = "683d712cd6fc0563ef7b2762";
const PHONE_NUMBER = "917396181785";

const SENSOR_MAP = {
  var1: "reg5",   // Water Temp (°C)
  var2: "reg6",   // ORP (mV)
  var3: "reg8",   // pH
  var4: "reg10"   // TDS (mg/L)
};

const client = mqtt.connect(MQTT_BROKER);

let latestValues = {
  var1: "NA",
  var2: "NA",
  var3: "NA",
  var4: "NA"
};

client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(MQTT_TOPIC);
});

client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const modbusData = data?.data?.modbus?.[0] || {};

    // Update latest values regardless of change, so SMS always sends latest data
    Object.entries(SENSOR_MAP).forEach(([varKey, regKey]) => {
      const currentVal = modbusData[regKey];
      if (currentVal !== undefined) {
        latestValues[varKey] = currentVal.toString();
      }
    });
  } catch (err) {
    console.error("Error processing MQTT message:", err);
  }
});

// Function to send SMS with the latest values
const sendSms = ({ var1, var2, var3, var4 }) => {
  const postData = JSON.stringify({
    template_id: TEMPLATE_ID,
    recipients: [
      {
        mobiles: PHONE_NUMBER,
        VAR1: var1 || "NA",
        VAR2: var2 || "NA",
        VAR3: var3 || "NA",
        VAR4: var4 || "NA"
      }
    ]
  });

  console.log("Sending SMS POST data:", postData);

  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    path: "/api/v5/flow",
    headers: {
      authkey: MSG91_AUTH_KEY,
      accept: "application/json",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let response = "";
    res.on("data", (chunk) => (response += chunk));
    res.on("end", () => {
      console.log("SMS API Response statusCode:", res.statusCode);
      console.log("SMS API Response body:", response);
      try {
        const jsonResponse = JSON.parse(response);
        if (jsonResponse.type === "success") {
          console.log("SMS sent successfully!");
        } else {
          console.warn("SMS sending failed or returned error:", jsonResponse);
        }
      } catch (e) {
        console.error("Error parsing SMS response JSON:", e);
      }
    });
  });

  req.on("error", (error) => {
    console.error("Error sending SMS:", error);
  });

  req.write(postData);
  req.end();
};

// Send SMS every 1 hour (3600000 milliseconds)
setInterval(() => {
  console.log("Sending hourly SMS with latest values:", latestValues);
  sendSms(latestValues);
}, 3600000);

// Minimal HTTP server to bind port for Render (or similar hosts)
const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("MQTT SMS service running\n");
  })
  .listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
