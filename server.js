const mqtt = require("mqtt");
const axios = require("axios");
require("dotenv").config();

const MQTT_BROKER = "mqtt://test.mosquitto.org"; // Use your broker
const MQTT_TOPIC = "devices/esp01/get/data"; // Replace with your MQTT topic

const SMS_API_URL = "https://smss-pepy.onrender.com/send-sms";
const PHONE_NUMBER = "+917396181785"; // Change to the recipient number

const sensorLabels = {
  reg5: "Water Temperature level = High",
  reg6: "Water ORP level = High",
  reg7: "Water ORP Level = Low",
  reg8: "Water PH Level = High",
  reg9: "Water PH Level = Low",
  reg10: "Water TDS Level = High",
  reg11: "Water TDS Level = Low",
  reg12: "Chlorine Pump On",
  reg13: "Chlorine Pump Off",
  reg14: "Chlorine Pump Trip",
  reg15: "HCL Pump On",
  reg16: "HCL Pump Off",
  reg17: "HCL Pump Trip",
  reg18: "Soda Ash Pump On",
  reg19: "Soda Ash Pump Off",
  reg20: "Soda Ash Pump Trip",
  reg21: "Chlorine Tank level = Low",
  reg22: "HCL Tank level = Low",
  reg23: "Soda Ash Tank level = Low"
};

// Connect to MQTT broker
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

    Object.keys(modbusData).forEach((key) => {
      const currentValue = modbusData[key];
      const previousValue = lastMessage[key];

      if (
        currentValue !== previousValue &&
        (
          (key.startsWith("reg") && parseInt(key.replace("reg", ""), 10) <= 4) || // reg1 to reg4: any change
          (currentValue === 1 && parseInt(key.replace("reg", ""), 10) >= 5 && parseInt(key.replace("reg", ""), 10) <= 23) // reg5 to reg23: only when value is 1
        )
      ) {
        const label = sensorLabels[key];
        if (label) {
          sendSms(label);
        }
      }
    });

    lastMessage = modbusData;
  } catch (error) {
    console.error("Error processing MQTT message:", error);
  }
});

const sendSms = async (message) => {
  try {
    const response = await axios.post(SMS_API_URL, {
      to: PHONE_NUMBER,
      message: message,
    });

    console.log("SMS sent successfully:", response.data);
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
};
