"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import mqtt, { type IClientOptions, type MqttClient } from "mqtt"
import { ThemeToggle } from "./theme-toggle"
import { Droplets, Wifi, WifiOff, Power, PowerOff, Settings, Activity } from "lucide-react"
import { MoistureChart } from "./moisture-chart"

interface SensorData {
  persen: number
}

const MQTT_BROKER_HOST = "585a599a8f0a44dd860e5e1bc39a21c9.s1.eu.hivemq.cloud"
const MQTT_WS_PORT = 8884
const MQTT_USERNAME = "Sistemirigasi"
const MQTT_PASSWORD = "Tugasiot1"
const TOPIC_DATA = "sensor/tanah/data"
const TOPIC_KONTROL = "kontrol/pompa"
const TOPIC_POMPA_STATUS = "pompa/status"

type PumpStatus = "ON" | "OFF"
type ConnectionStatus = "connected" | "disconnected" | "connecting"

// Gauge Component
const SoilMoistureGauge: React.FC<{ value: number }> = ({ value }) => {
  const radius = 120
  const strokeWidth = 20
  const normalizedRadius = radius - strokeWidth * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - (value / 100) * circumference

  const getColor = (value: number) => {
    if (value <= 25) return "#ef4444" // kering
    if (value <= 40) return "#f59e0b" // lembap
    return "#10b981" // basah
  }

  const getStatus = (value: number) => {
    if (value <= 25) return "Kering"
    if (value <= 40) return "Lembap"
    return "Basah"
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            style={{ strokeDashoffset: 0 }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            stroke={getColor(value)}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-500 ease-in-out"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Droplets className="h-8 w-8 mb-2 text-blue-500" />
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}%</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{getStatus(value)}</span>
        </div>
      </div>
    </div>
  )
}

// Status Card Component
const StatusCard: React.FC<{
  title: string
  children: React.ReactNode
  icon: React.ReactNode
  className?: string
}> = ({ title, children, icon, className }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm ${className || ''}`}>
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
    </div>
    <div className="px-1">{children}</div>
  </div>
)

// Control Button Component
const ControlButton: React.FC<{
  onClick: () => void
  variant: "primary" | "secondary" | "danger"
  children: React.ReactNode
  disabled?: boolean
}> = ({ onClick, variant, children, disabled = false }) => {
  const baseClasses =
    "w-full px-4 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"

  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
  }

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  )
}

export default function Dashboard() {
  const [client, setClient] = useState<MqttClient | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [soilMoisture, setSoilMoisture] = useState<number>(0)
  const [pumpStatus, setPumpStatus] = useState<PumpStatus>("OFF")
  const [reconnectKey, setReconnectKey] = useState(0)
  
  useEffect(() => {
    let isActive = true
    const url = `wss://${MQTT_BROKER_HOST}:${MQTT_WS_PORT}/mqtt`;

    const options: IClientOptions = {
      clientId: `iot_dashboard_${Math.random().toString(16).substr(2, 8)}`,
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clean: true,
      protocolVersion: 4,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };

    setConnectionStatus("connecting");
    console.log(`Menghubungkan ke MQTT Broker: ${url}`);

    const mqttClient = mqtt.connect(url, options);

    mqttClient.on("connect", () => {
      if (!isActive) return;

      console.log("Terhubung ke MQTT broker");
      setConnectionStatus("connected");

      mqttClient.subscribe(TOPIC_DATA, { qos: 0 }, (err) => {
        if (err) {
          console.warn(`Gagal subscribe topic ${TOPIC_DATA}: ${err.message}`);
        }
      });

      mqttClient.subscribe(TOPIC_POMPA_STATUS, { qos: 0 }, (err) => {
        if (err) {
          console.warn(`Gagal subscribe topic ${TOPIC_POMPA_STATUS}: ${err.message}`);
        }
      });
    });

    mqttClient.on("reconnect", () => {
      if (!isActive) return;

      console.log("MQTT reconnecting");
      setConnectionStatus("connecting");
    });

    mqttClient.on("error", (err) => {
      if (!isActive) return;

      console.warn(`MQTT connection error: ${err.message}`);
      setConnectionStatus("disconnected");
    });

    mqttClient.on("close", () => {
      if (!isActive) return;

      console.log("MQTT connection closed");
      setConnectionStatus("disconnected");
    });
    
    mqttClient.on("offline", () => {
      if (!isActive) return;

      console.log("MQTT client offline");
      setConnectionStatus("disconnected");
    });
    
    mqttClient.on("message", (topic, message) => {
      if (!isActive) return;

      const messageStr = message.toString();
      console.log(`Received message on ${topic}:`, messageStr);
      try {
        if (topic === TOPIC_DATA) {
          const data: SensorData = JSON.parse(messageStr);
          setSoilMoisture(data.persen);
        } else if (topic === TOPIC_POMPA_STATUS) {
          setPumpStatus(messageStr as PumpStatus);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });

    setClient(mqttClient);

    // Fungsi cleanup
    return () => {
      isActive = false;
      mqttClient.end(true);
    };
  }, [reconnectKey]);

  // Fungsi publishCommand tetap sama...
  const publishCommand = useCallback(
    (command: string) => {
      if (client && connectionStatus === "connected") {
        client.publish(TOPIC_KONTROL, command);
      }
    },
    [client, connectionStatus],
  )

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Wifi className="h-5 w-5" />
            <span className="font-medium">Terhubung</span>
          </div>
        )
      case "connecting":
        return (
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Activity className="h-5 w-5 animate-pulse" />
            <span className="font-medium">Menghubungkan...</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <WifiOff className="h-5 w-5" />
            <span className="font-medium">Terputus</span>
          </div>
        )
    }
  }

  const getPumpStatusDisplay = () => {
    return (
      <div
        className={`flex items-center gap-2 ${
          pumpStatus === "ON" ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
        }`}
      >
        {pumpStatus === "ON" ? <Power className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
        <span className="font-medium">Pompa {pumpStatus === "ON" ? "Menyala" : "Mati"}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">IoT Sistem Irigasi Pintar</h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Main Gauge */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm h-full">
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                  Kelembapan Tanah
                </h2>
                <div className="flex-1 flex flex-col justify-center items-center">
                  <SoilMoistureGauge value={soilMoisture} />
                  <div className="mt-6">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      <span>Kering 0-25% | Lembap 26-40% |  Basah40-100%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Status and Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Status Cards */}
            <StatusCard title="Status Koneksi" icon={<Wifi className="h-5 w-5 text-blue-500" />}>
              <div className="mb-3">
                {getConnectionStatusDisplay()}
              </div>
              <button
                onClick={() => {
                  setConnectionStatus("connecting");
                  setReconnectKey((key) => key + 1);
                }}
                disabled={connectionStatus === "connecting"}
                className="w-full mt-2 py-2 px-3 text-sm bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {connectionStatus === "connecting" ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4" />
                    <span>Hubungkan Ulang</span>
                  </>
                )}
              </button>
            </StatusCard>

            <StatusCard title="Status Pompa" icon={<Settings className="h-5 w-5 text-gray-500" />}>
              <div className="py-2">
                {getPumpStatusDisplay()}
              </div>
            </StatusCard>

            {/* Control Panel */}
            <StatusCard 
              title="Panel Kontrol" 
              icon={<Settings className="h-5 w-5 text-purple-500" />}
              className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
            >
              <div className="space-y-3 mt-2">
                <ControlButton
                  onClick={() => publishCommand("MANUAL_ON")}
                  variant="primary"
                  disabled={connectionStatus !== "connected"}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Power className="h-4 w-4" />
                    Nyalakan Pompa
                  </div>
                </ControlButton>

                <ControlButton
                  onClick={() => publishCommand("MANUAL_OFF")}
                  variant="danger"
                  disabled={connectionStatus !== "connected"}
                >
                  <div className="flex items-center justify-center gap-2">
                    <PowerOff className="h-4 w-4" />
                    Matikan Pompa
                  </div>
                </ControlButton>

                <ControlButton
                  onClick={() => publishCommand("AUTO")}
                  variant="secondary"
                  disabled={connectionStatus !== "connected"}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Settings className="h-4 w-4" />
                    Mode Otomatis
                  </div>
                </ControlButton>
              </div>

              {connectionStatus !== "connected" && (
                <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-md">
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 text-center">
                    Hubungkan ke MQTT untuk mengontrol pompa
                  </p>
                </div>
              )}
            </StatusCard>
          </div>
        </div>

        {/* Moisture Chart */}
        <div className="mt-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
              Riwayat Kelembapan
            </h2>
            <MoistureChart currentMoisture={soilMoisture} />
          </div>
        </div>
      </main>
    </div>
  )
}
