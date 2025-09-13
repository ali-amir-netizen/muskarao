export default {
  expo: {
    name: "Muskarao (Smile)",
    slug: "muskarao",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#ffffff" },
    updates: { enabled: true },
    assetBundlePatterns: ["**/*"],
    ios: { supportsTablet: false },
    android: {
      package: "com.muskarao.app",
      versionCode: 1,
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ffffff" },
      permissions: []
    },
    web: { favicon: "./assets/favicon.png" },
    extra: {
      eas: {
        projectId: "1e970aed-e1cb-4687-a263-d277297290f7"
      }
    }
  }
};