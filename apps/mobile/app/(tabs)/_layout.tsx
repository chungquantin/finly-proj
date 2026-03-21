/* eslint-disable no-restricted-imports */
import { View } from "react-native"
import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

const ACTIVE_BLUE = "#2453FF"
const INACTIVE_SURFACE = "#F3F6FC"
const INACTIVE_ICON = "#7A8699"
const LABEL_INACTIVE = "#6B7586"
const LABEL_ACTIVE = "#0F1728"

type TabIconProps = {
  focused: boolean
  activeIcon: keyof typeof Ionicons.glyphMap
  inactiveIcon?: keyof typeof Ionicons.glyphMap
}

function TabIcon({ focused, activeIcon, inactiveIcon }: TabIconProps) {
  const iconName = focused ? activeIcon : (inactiveIcon ?? activeIcon)

  return (
    <View
      className="rounded-full p-2.5"
      style={{ backgroundColor: focused ? ACTIVE_BLUE : INACTIVE_SURFACE }}
    >
      <Ionicons name={iconName} size={18} color={focused ? "#FFFFFF" : INACTIVE_ICON} />
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: LABEL_ACTIVE,
        tabBarInactiveTintColor: LABEL_INACTIVE,
        tabBarStyle: {
          position: "absolute",
          left: 22,
          right: 22,
          bottom: 14,
          height: 88,
          borderTopWidth: 0,
          borderRadius: 30,
          backgroundColor: "rgba(255,255,255,0.94)",
          borderWidth: 1,
          borderColor: "#EEF2F7",
          paddingTop: 10,
          paddingBottom: 16,
          shadowColor: "#0F1728",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.06,
          shadowRadius: 30,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="home" inactiveIcon="home-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: "Portfolio",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="pie-chart" inactiveIcon="pie-chart-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: "Board",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              activeIcon="chatbubble-ellipses"
              inactiveIcon="chatbubble-ellipses-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="person" inactiveIcon="person-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  )
}
