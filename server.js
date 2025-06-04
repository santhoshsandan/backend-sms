const mqtt = require("mqtt");
const https = require("https");
require("dotenv").config();
 
const MQTT_BROKER = "mqtt://test.mosquitto.org";
const MQTT_TOPIC = "devices/esp01/get/data";
 
const MSG91_AUTH_KEY = "445101Au92RrY4683eab53P1";
const TEMPLATE_ID = "683d712cd6fc0563ef7b2762";
const PHONE_NUMBER = "917396181785";
 
// Sensor mapping for the template
// Assumes reg5 = Temp, reg6 = ORP, reg8 = pH, reg10 = TDS
const SENSOR_MAP = {
  var1: "reg5",   // Water Temp (°C)
  var2: "reg6",   // ORP (mV)
  var3: "reg8",   // pH
  var4: "reg10"   // TDS (mg/L)
};
 
const client = mqtt.connect(MQTT_BROKER);
let lastMessage = {};
 
client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(MQTT_TOPIC);
});
 
client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const modbusData = data?.data?.modbus?.[0] || {};
 
    console.log("Received modbus data:", modbusData);
 
    const valuesToSend = {};
    let shouldSend = false;
 
    Object.entries(SENSOR_MAP).forEach(([varKey, regKey]) => {
      const currentVal = modbusData[regKey];
      console.log(`Checking sensor ${varKey} mapped to ${regKey}: value=${currentVal}, lastValue=${lastMessage[regKey]}`);
      if (currentVal !== undefined && currentVal !== lastMessage[regKey]) {
        valuesToSend[varKey] = currentVal;
        shouldSend = true;
      } else if (currentVal !== undefined) {
        valuesToSend[varKey] = currentVal;
      }
    });
 
    if (shouldSend) {
      console.log("Sending SMS with values:", valuesToSend);
      sendSms(valuesToSend);
    } else {
      console.log("No new values to send SMS for.");
    }
 
    lastMessage = modbusData;
  } catch (err) {
    console.error("Error processing MQTT message:", err);
  }
});
 
const sendSms = ({ var1, var2, var3, var4 }) => {
  const postData = JSON.stringify({
    template_id: TEMPLATE_ID,
    recipients: [
      {
        mobiles: PHONE_NUMBER,
        var1: var1 !== undefined ? var1.toString() : "NA",
        var2: var2 !== undefined ? var2.toString() : "NA",
        var3: var3 !== undefined ? var3.toString() : "NA",
        var4: var4 !== undefined ? var4.toString() : "NA"
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
    res.on("data", (chunk) => {
      response += chunk;
    });
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
