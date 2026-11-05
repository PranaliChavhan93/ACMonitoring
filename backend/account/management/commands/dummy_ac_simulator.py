import os
import json
import time
import random
import logging
import threading

from datetime import datetime, timezone

import paho.mqtt.client as mqtt


# $env:TEST_AC_01_USERNAME="TEST-AC-01"
# $env:TEST_AC_01_PASSWORD="TEST-AC-01"
# $env:TEST_AC_02_USERNAME="TEST-AC-02"
# $env:TEST_AC_02_PASSWORD="TEST-AC-02"

# ==========================================================
# MQTT BROKER CONFIGURATION
# ==========================================================

MQTT_HOST = "3tp.tapasyatech.in"
MQTT_PORT = 1883
MQTT_TOPIC = "v1/devices/me/telemetry"

PUBLISH_INTERVAL = 2


# ==========================================================
# DEVICE CONFIGURATION
# ==========================================================
# Configure credentials separately for every device.
#
# TEST-AC-01:
# The supplied x5dak... value is treated as its MQTT token.
# For a ThingsBoard-compatible broker, the token is username.
#
# TEST-AC-02:
# Uses the username/password credentials you supplied.
#
# If your 3TP broker uses a different authentication scheme,
# adjust these entries according to its device credentials.

DEVICES = [
    {
        "ac_id": "TEST-AC-01",
        "client_id": "TEST-AC-01",
        "username": os.getenv("TEST_AC_01_USERNAME", ""),
        "password": os.getenv("TEST_AC_01_PASSWORD", ""),
    },
    {
        "ac_id": "TEST-AC-02",
        "client_id": "TEST-AC-02",
        "username": os.getenv("TEST_AC_02_USERNAME", ""),
        "password": os.getenv("TEST_AC_02_PASSWORD", ""),
    },
    {
            "ac_id": "TEST-AC-03",
            "client_id": "TEST-AC-03",
            "username": os.getenv("TEST_AC_03_USERNAME", ""),
            "password": os.getenv("TEST_AC_03_PASSWORD", ""),
    },
    {
        "ac_id": "TEST-AC-04",
        "client_id": "TEST-AC-04",
        "username": os.getenv("TEST_AC_04_USERNAME", ""),
        "password": os.getenv("TEST_AC_04_PASSWORD", ""),
    },
]


# ==========================================================
# LOGGING
# ==========================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


# ==========================================================
# DEVICE SIMULATION STATE
# ==========================================================

device_states = {}

for device in DEVICES:
    device_states[device["ac_id"]] = {
        "temperature": random.uniform(25, 29),
        "humidity": random.uniform(45, 60),
        "energy": random.uniform(100, 500),
        "voltage": random.uniform(228, 238),
        "relay": 1,
    }


def generate_telemetry(ac_id):

    state = device_states[ac_id]

    # Simulate voltage fluctuations
    voltage = round(
        random.uniform(228, 238), 2
    )

    # Simulate AC ON/OFF
    if random.random() < 0.02:
        state["relay"] = 1 - state["relay"]

    relay = state["relay"]

    if relay == 1:

        current = round(
            random.uniform(0.45, 1.20), 3
        )

        power_factor = round(
            random.uniform(0.85, 0.98), 2
        )

        power = round(
            voltage * current * power_factor, 2
        )

        # Power is in watts.
        # Energy is cumulative kWh.
        energy_increment = (
            power * PUBLISH_INTERVAL
        ) / 3600000

        state["energy"] += energy_increment

        state["temperature"] += random.uniform(
            -0.15, 0.10
        )

        state["humidity"] += random.uniform(
            -0.3, 0.3
        )

    else:

        current = 0
        power = 0
        power_factor = 0

    temperature = round(
        max(18, min(38, state["temperature"])), 2
    )

    humidity = round(
        max(30, min(85, state["humidity"])), 2
    )

    telemetry = {
        "ac_id": ac_id,

        "indoor_temperature": temperature,
        "indoor_humidity": humidity,

        "voltage": voltage,
        "current": current,
        "power": power,

        "energy": round(state["energy"], 5),

        "frequency": round(
            random.uniform(49.8, 50.2), 2
        ),

        "power_factor": power_factor,

        "alarm_status": 0,
        "relay": relay,

        "timestamp": datetime.now(
            timezone.utc
        ).isoformat()
    }

    return telemetry


# ==========================================================
# MQTT CALLBACKS
# ==========================================================

def on_connect(client, userdata, flags, reason_code, properties):

    if reason_code == 0:
        logging.info(
            "%s connected successfully to 3TP MQTT",
            userdata["ac_id"]
        )
        userdata["connected"].set()

    else:
        logging.error(
            "%s MQTT connection failed: %s",
            userdata["ac_id"],
            reason_code
        )


def on_disconnect(client, userdata, disconnect_flags,
                  reason_code, properties):

    logging.warning(
        "%s disconnected from MQTT: %s",
        userdata["ac_id"],
        reason_code
    )


# ==========================================================
# CREATE MQTT CLIENT
# ==========================================================

def create_mqtt_client(device):

    ac_id = device["ac_id"]

    if not device["username"]:
        raise ValueError(
            f"MQTT username/token missing for {ac_id}. "
            "Set its environment variable first."
        )

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=device["client_id"],
        protocol=mqtt.MQTTv311
    )

    client.username_pw_set(
        username=device["username"],
        password=device["password"] or None
    )

    client.user_data_set({
        "ac_id": ac_id,
        "connected": threading.Event()
    })

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect

    return client


# ==========================================================
# TELEMETRY PUBLISHER
# ==========================================================

def publish_device_telemetry(device):

    ac_id = device["ac_id"]

    client = create_mqtt_client(device)

    try:

        logging.info("Connecting device: %s", ac_id)

        client.connect(
            MQTT_HOST,
            MQTT_PORT,
            keepalive=60
        )

        client.loop_start()

        if not client._userdata["connected"].wait(timeout=15):
            raise TimeoutError(
                f"MQTT connection timeout for {ac_id}"
            )

        while True:

            telemetry = generate_telemetry(ac_id)

            # Your 3TP integration reads the telemetry
            # from the "data" key.
            payload = {
                "data": json.dumps(telemetry)
            }

            result = client.publish(
                MQTT_TOPIC,
                json.dumps(payload),
                qos=1
            )

            result.wait_for_publish(timeout=10)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:

                logging.info(
                    "%s | Temp: %.2f | Humidity: %.2f | "
                    "Voltage: %.2f | Current: %.3f | "
                    "Power: %.2f | Energy: %.5f | Relay: %s",
                    ac_id,
                    telemetry["indoor_temperature"],
                    telemetry["indoor_humidity"],
                    telemetry["voltage"],
                    telemetry["current"],
                    telemetry["power"],
                    telemetry["energy"],
                    telemetry["relay"]
                )

            else:
                logging.error(
                    "%s telemetry publish failed: %s",
                    ac_id,
                    result.rc
                )

            time.sleep(PUBLISH_INTERVAL)

    except Exception as exc:

        logging.exception(
            "%s simulator error: %s",
            ac_id,
            exc
        )

    finally:

        client.loop_stop()
        client.disconnect()


# ==========================================================
# MAIN
# ==========================================================

def main():

    threads = []

    for device in DEVICES:

        thread = threading.Thread(
            target=publish_device_telemetry,
            args=(device,),
            daemon=True
        )

        thread.start()
        threads.append(thread)

    logging.info(
        "Started simulator for %s devices",
        len(DEVICES)
    )

    try:

        while True:
            time.sleep(1)

    except KeyboardInterrupt:

        logging.info("Stopping AC simulator...")


if __name__ == "__main__":
    main()